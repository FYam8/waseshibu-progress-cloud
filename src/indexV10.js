import baseWorker,{HouseholdProgress as BaseHouseholdProgress} from './indexV9.js';
import {verifyAccess} from './indexV4.js';
import {SCHOOL_PROFILE} from './deploymentProfile.js';
import {APP_ID_SET} from './platformConfig.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {async fetch(request,env,ctx){
  const u=new URL(request.url);
  if(u.pathname==='/admin/api/answers'){
    const auth=await verifyAccess(request,env);if(!auth.ok)return json({ok:false,code:auth.code},auth.status);
    if(request.method!=='GET')return json({ok:false,code:'method_not_allowed'},405);
    const registrationId=u.searchParams.get('device')||'',appId=u.searchParams.get('app')||'',outcome=u.searchParams.get('outcome')||'mistakes',examId=u.searchParams.get('exam')||'',questionId=u.searchParams.get('question')||'',cursor=Number(u.searchParams.get('cursor')||0);
    if(!/^[a-f0-9-]{36}$/i.test(registrationId)||(appId&&!APP_ID_SET.has(appId))||!['mistakes','all','wrong','partial','unanswered','correct','ungraded'].includes(outcome)||examId.length>12||questionId.length>200||!Number.isSafeInteger(cursor)||cursor<0)return json({ok:false,code:'invalid_filter'},400);
    const stub=env.PROGRESS.getByName(String(env.HOUSEHOLD_OBJECT_NAME||SCHOOL_PROFILE.objectName));
    return stub.fetch('https://internal/internal/admin/answers',{method:'POST',body:JSON.stringify({registrationId,appId,outcome,examId,questionId,cursor})});
  }
  return baseWorker.fetch(request,env,ctx);
}};
export class HouseholdProgress extends BaseHouseholdProgress{
  constructor(ctx,env){super(ctx,env);this.sql.exec('CREATE INDEX IF NOT EXISTS answers_lookup ON events(registration_id,event_type,app_id)');}
  async fetch(request){
    if(new URL(request.url).pathname!=='/internal/admin/answers')return super.fetch(request);
    const b=await request.json(),where=["e.registration_id=?","e.event_type='answer_record'","NOT EXISTS(SELECT 1 FROM events newer WHERE newer.registration_id=e.registration_id AND newer.app_id=e.app_id AND newer.source_record_id=e.source_record_id AND newer.revision>e.revision)"],args=[b.registrationId];
    if(b.appId){where.push('e.app_id=?');args.push(b.appId);}
    if(b.examId){where.push("json_extract(e.payload_json,'$.examId')=?");args.push(b.examId);}
    if(b.questionId){where.push("json_extract(e.payload_json,'$.questionId')=?");args.push(b.questionId);}
    if(b.outcome==='mistakes')where.push("json_extract(e.payload_json,'$.outcome') IN ('wrong','partial','unanswered')");
    else if(b.outcome!=='all'){where.push("json_extract(e.payload_json,'$.outcome')=?");args.push(b.outcome);}
    if(b.cursor){where.push('e.rowid<?');args.push(b.cursor);}
    const rows=this.sql.exec('SELECT e.rowid AS cursor,e.app_id,e.occurred_at,e.received_at,e.payload_json FROM events e WHERE '+where.join(' AND ')+' ORDER BY e.rowid DESC LIMIT 51',...args).toArray();
    return json({ok:true,records:rows.slice(0,50).map(r=>({cursor:r.cursor,appId:r.app_id,occurredAt:r.occurred_at,receivedAt:r.received_at,...JSON.parse(r.payload_json)})),nextCursor:rows.length>50?rows[49].cursor:null});
  }
}
