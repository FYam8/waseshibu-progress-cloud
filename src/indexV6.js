import baseWorker, { HouseholdProgress as BaseHouseholdProgress } from './indexV5.js';

function jsonResponse(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
}
function safePayload(value){try{return JSON.parse(value||'{}')}catch{return{}}}
function currentRows(rows,registrationId,appId){
  return rows.filter(row=>String(row.registration_id)===String(registrationId)&&String(row.app_id)===String(appId));
}
function applyCurrentState(app,current){
  const summary=current.find(row=>String(row.source_record_id)==='state:summary');
  if(summary&&Number.isFinite(Number(summary.payload?.total)))app.recordCount=Math.max(0,Math.floor(Number(summary.payload.total)));

  const exam=current.find(row=>String(row.source_record_id)==='state:latest-exam');
  if(exam){
    if(exam.payload?.completed===false||!Number.isFinite(Number(exam.payload?.score)))app.latestExam=null;
    else app.latestExam={occurredAt:String(exam.occurred_at),year:/^20\d{2}$/.test(String(exam.payload?.year||''))?String(exam.payload.year):null,score:Number(exam.payload.score),maxScore:Number.isFinite(Number(exam.payload?.maxScore))?Number(exam.payload.maxScore):null,kind:typeof exam.payload?.kind==='string'?exam.payload.kind:null};
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
    app.years=years;
  }
}

export default baseWorker;

export class HouseholdProgress extends BaseHouseholdProgress{
  async fetch(request){
    const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/internal/admin/dashboard-summary'){
      const base=await super.fetch(request);
      const data=await base.clone().json().catch(()=>null);
      if(!base.ok||!data?.ok||!Array.isArray(data.apps))return base;

      const rows=this.sql.exec(`SELECT e.registration_id,e.app_id,e.source_record_id,e.revision,e.event_type,e.occurred_at,e.payload_json
        FROM events e
        ORDER BY e.registration_id,e.app_id,e.source_record_id,e.revision DESC`).toArray();
      const latest=[];const seen=new Set();
      for(const row of rows){
        const key=`${row.registration_id}:${row.app_id}:${row.source_record_id}`;
        if(seen.has(key))continue;
        seen.add(key);
        latest.push({...row,payload:safePayload(row.payload_json)});
      }

      for(const app of data.apps){
        const appId=String(app.appId||'');
        const current=latest.filter(row=>String(row.app_id)===appId);
        applyCurrentState(app,current);
      }
      for(const device of data.devices||[]){
        for(const app of device.apps||[]){
          applyCurrentState(app,currentRows(latest,device.registrationId,app.appId));
        }
        device.eventCount=(device.apps||[]).reduce((n,app)=>n+Number(app.recordCount||0),0);
      }
      return jsonResponse(data,base.status,Object.fromEntries(base.headers.entries()));
    }
    return super.fetch(request);
  }
}
