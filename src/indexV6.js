import baseWorker, { HouseholdProgress as BaseHouseholdProgress } from './indexV5.js';
import { APP_CONFIG, APP_IDS } from './platformConfig.js';

function jsonResponse(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
}
function safePayload(value){try{return JSON.parse(value||'{}')}catch{return{}}}
function blankApp(appId){const cfg=APP_CONFIG[appId];return{appId,label:cfg.label,lastLearningAt:null,latestExam:null,recordCount:0,years:{},progressLabel:null};}
function appSet(){return Object.fromEntries(APP_IDS.map(id=>[id,blankApp(id)]));}
function currentRows(rows,registrationId,appId,from=null){
  return rows.filter(row=>String(row.registration_id)===String(registrationId)&&String(row.app_id)===String(appId)&&(!from||String(row.occurred_at)>=String(from)));
}
function applyGenericEvent(app,row){
  app.recordCount++;
  if(!app.lastLearningAt||String(row.occurred_at)>String(app.lastLearningAt))app.lastLearningAt=String(row.occurred_at);
  const year=String(row.payload?.year||'');
  if(APP_CONFIG[app.appId].supportsYears&&/^20\d{2}$/.test(year)&&!app.years[year])app.years[year]='started';
  if((row.event_type==='exam_completed'||row.event_type==='year_completed')&&APP_CONFIG[app.appId].supportsYears&&/^20\d{2}$/.test(year))app.years[year]='done';
  if(row.event_type==='exam_completed'&&APP_CONFIG[app.appId].supportsExamScore&&(!app.latestExam||String(row.occurred_at)>String(app.latestExam.occurredAt))){
    app.latestExam={occurredAt:String(row.occurred_at),year:year||null,score:row.payload?.score!=null&&Number.isFinite(Number(row.payload.score))?Number(row.payload.score):null,maxScore:row.payload?.maxScore!=null&&Number.isFinite(Number(row.payload.maxScore))?Number(row.payload.maxScore):null,kind:typeof row.payload?.kind==='string'?row.payload.kind:null};
  }
}
function applySnapshot(app,p){
  if(APP_CONFIG[app.appId].supportsYears)for(const [year,count] of Object.entries(p.eventsByYear||{})){if(Number(count)>0&&!app.years[year])app.years[year]='started';}
  if(!app.progressLabel&&typeof p.progressLabel==='string')app.progressLabel=p.progressLabel;
}
function applyCurrentState(app,current){
  let applied=false;
  const summary=current.find(row=>String(row.source_record_id)==='state:summary');
  if(summary&&Number.isFinite(Number(summary.payload?.total))){
    const total=Math.max(0,Math.floor(Number(summary.payload.total)));
    app.recordCount=total;
    if(total===0){
      app.lastLearningAt=null;
    }else{
      const reported=summary.payload?.lastLearningAt;
      app.lastLearningAt=typeof reported==='string'&&Number.isFinite(Date.parse(reported))&&Date.parse(reported)>0?reported:String(summary.occurred_at);
    }
    const target=/^target-(60|70|75)$/.exec(String(summary.payload?.kind||''));
    if(target)app.progressLabel=`目標 ${target[1]}点`;
    applied=true;
  }

  const exam=current.find(row=>String(row.source_record_id)==='state:latest-exam');
  if(exam){
    if(exam.payload?.completed===false||!Number.isFinite(Number(exam.payload?.score)))app.latestExam=null;
    else app.latestExam={occurredAt:String(exam.occurred_at),year:/^20\d{2}$/.test(String(exam.payload?.year||''))?String(exam.payload.year):null,score:Number(exam.payload.score),maxScore:Number.isFinite(Number(exam.payload?.maxScore))?Number(exam.payload.maxScore):null,kind:typeof exam.payload?.kind==='string'?exam.payload.kind:null};
    applied=true;
  }

  const yearRows=current.filter(row=>String(row.source_record_id).startsWith('state:year:'));
  if(yearRows.length){
    const years={};
    for(const row of yearRows){
      const year=String(row.source_record_id).slice('state:year:'.length);
      if(!/^20\d{2}$/.test(year))continue;
      const payloadYear=String(row.payload?.year||'');
      if(payloadYear!==year)continue;
      years[year]=row.payload?.completed===true||row.event_type==='year_completed'?'done':'started';
    }
    app.years=years;applied=true;
  }
  return applied;
}
function mergeFormalState(target,part){
  target.recordCount+=Number(part.recordCount||0);
  if(part.lastLearningAt&&(!target.lastLearningAt||String(part.lastLearningAt)>String(target.lastLearningAt)))target.lastLearningAt=part.lastLearningAt;
  if(part.latestExam&&(!target.latestExam||String(part.latestExam.occurredAt)>String(target.latestExam.occurredAt)))target.latestExam=part.latestExam;
  for(const [year,state] of Object.entries(part.years||{}))if(state==='done'||target.years[year]!=='done')target.years[year]=state;
  if(!target.progressLabel&&part.progressLabel)target.progressLabel=part.progressLabel;
}

export default baseWorker;

export class HouseholdProgress extends BaseHouseholdProgress{
  async fetch(request){
    const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/internal/admin/dashboard-summary'){
      const base=await super.fetch(request);
      const data=await base.clone().json().catch(()=>null);
      if(!base.ok||!data?.ok||!Array.isArray(data.apps))return base;

      const registrations=this.sql.exec(`SELECT id,status,production_from,revoked_at FROM registrations`).toArray();
      const registrationMap=new Map(registrations.map(row=>[String(row.id),row]));
      const eventRows=this.sql.exec(`SELECT registration_id,app_id,source_record_id,revision,event_type,occurred_at,payload_json
        FROM events ORDER BY registration_id,app_id,source_record_id,revision DESC`).toArray();
      const latest=[];const seen=new Set();
      for(const row of eventRows){
        const key=`${row.registration_id}:${row.app_id}:${row.source_record_id}`;
        if(seen.has(key))continue;
        seen.add(key);
        latest.push({...row,payload:safePayload(row.payload_json)});
      }

      for(const device of data.devices||[]){
        for(const app of device.apps||[])applyCurrentState(app,currentRows(latest,device.registrationId,app.appId));
        device.eventCount=(device.apps||[]).reduce((n,app)=>n+Number(app.recordCount||0),0);
      }

      const productionRegistrations=registrations.filter(reg=>String(reg.status||'')==='production');
      const perRegistration=new Map(productionRegistrations.map(reg=>[String(reg.id),appSet()]));
      for(const row of latest){
        const reg=registrationMap.get(String(row.registration_id));
        const apps=perRegistration.get(String(row.registration_id));
        const app=apps?.[String(row.app_id)];
        if(!reg||!app)continue;
        if(reg.production_from&&String(row.occurred_at)<String(reg.production_from))continue;
        applyGenericEvent(app,row);
      }
      const snapshotRows=this.sql.exec(`SELECT registration_id,app_id,payload_json FROM snapshots`).toArray();
      for(const row of snapshotRows){
        const reg=registrationMap.get(String(row.registration_id));
        const apps=perRegistration.get(String(row.registration_id));
        const app=apps?.[String(row.app_id)];
        if(!reg||!app||reg.production_from!=null)continue;
        applySnapshot(app,safePayload(row.payload_json));
      }
      for(const reg of productionRegistrations){
        const apps=perRegistration.get(String(reg.id));
        for(const appId of APP_IDS)applyCurrentState(apps[appId],currentRows(latest,reg.id,appId,reg.production_from||null));
      }

      const formal=appSet();
      for(const apps of perRegistration.values())for(const appId of APP_IDS)mergeFormalState(formal[appId],apps[appId]);
      data.apps=APP_IDS.map(id=>formal[id]);
      return jsonResponse(data,base.status,Object.fromEntries(base.headers.entries()));
    }
    return super.fetch(request);
  }
}
