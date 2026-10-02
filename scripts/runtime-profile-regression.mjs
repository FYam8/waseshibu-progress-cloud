// Uses Wrangler's installed local Worker simulator; never calls production.
import * as simulator from 'miniflare';
import { createHash,randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { SCHOOL_PROFILE as p } from '../src/deploymentProfile.js';
import { createProgressFormatter } from '../src/dashboardFormatting.js';
const options={
  modules:true,scriptPath:fileURLToPath(new URL('../dist/indexV9.js',import.meta.url)),
  compatibilityDate:'2026-09-12',
  durableObjects:{PROGRESS:{className:'HouseholdProgress',useSQLite:true}},
  bindings:{HOUSEHOLD_OBJECT_NAME:p.objectName,ALLOWED_ORIGINS:p.allowedOrigin,ANONYMOUS_REGISTRATION_ENABLED:'1',ADMIN_SECRET:'local-test-only'},
};
const mf=new simulator.Miniflare(simulator.convertV4MiniflareOptions?simulator.convertV4MiniflareOptions(options):options);
const credential='synthetic-local-credential';
const registrationId=randomUUID();
const call=(path,method='GET',body,extra={})=>mf.dispatchFetch('https://local.test'+path,{method,headers:{origin:p.allowedOrigin,'content-type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})});
const learner={authorization:'Bearer '+credential};
const admin={'x-admin-secret':'local-test-only'};
try{
  const health=await (await call('/health')).json();
  assert.equal(health.service,p.workerName);assert.deepEqual(health.supportedApps,Object.keys(p.apps));
  assert.equal((await call('/admin')).status,403);
  assert.equal((await call('/admin/api/summary')).status,403);
  assert.equal((await call('/v1/admin/summary')).status,401);
  let r=await call('/v1/register-anonymous','POST',{registrationId,credentialHash:createHash('sha256').update(credential).digest('hex'),device:{deviceType:'desktop'}});
  assert.equal(r.status,200);let registration=await r.json();assert.equal(registration.status,'unclassified');assert.match(registration.deviceCode,/^WS-/);
  const namespace=await mf.getDurableObjectNamespace('PROGRESS');
  const stub=namespace.get(namespace.idFromName(p.objectName));
  const dashboard=async()=> (await stub.fetch('https://internal/internal/admin/dashboard-summary',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).json();
  const today=app=>createProgressFormatter(p.exams).today(app.lastLearningAt,new Date(),app);
  let before=await dashboard();assert.equal(today(before.devices[0].apps.find(x=>x.appId==='english')),'未同期');
  for(const [appId,eventCount] of [['math',2],['vocab',0]]){
    r=await call('/v1/progress/snapshot','PUT',{appId,generation:1,payload:{baseline:true,eventCount,capturedAt:new Date().toISOString()}},learner);assert.equal(r.status,200);
  }
  before=await dashboard();assert.equal(today(before.devices[0].apps.find(x=>x.appId==='math')),'学習日時不明');assert.equal(today(before.devices[0].apps.find(x=>x.appId==='vocab')),'今日の記録なし');
  const unknown={eventId:'english:unknown:r1',appId:'english',sourceRecordId:'unknown',revision:1,eventType:'learning',occurredAt:'1970-01-01T00:00:00.000Z',payload:{clockUnknown:true}};
  assert.equal((await call('/v1/events/batch','POST',{events:[unknown]},learner)).status,200);
  before=await dashboard();assert.equal(today(before.devices[0].apps.find(x=>x.appId==='english')),'学習日時不明');
  const event={eventId:'english:synthetic:r1',appId:'english',sourceRecordId:'synthetic',revision:1,eventType:'exam_completed',occurredAt:'2026-10-02T12:00:00.000Z',payload:{year:'2024',score:70,maxScore:100}};
  r=await call('/v1/events/batch','POST',{events:[event]},learner);assert.equal(r.status,200);assert.deepEqual((await r.json()).accepted,[event.eventId]);
  r=await call('/v1/events/batch','POST',{events:[event]},learner);assert.deepEqual((await r.json()).duplicate,[event.eventId]);
  for(const field of ['rawAnswer','answerText','passageText','backup']){
    r=await call('/v1/events/batch','POST',{events:[{...event,payload:{...event.payload,[field]:'synthetic prohibited content'}}]},learner);
    assert.equal(r.status,400);assert.equal((await r.json()).rejected[0].code,'payload_field_not_allowed');
  }
  r=await call('/v1/events/batch','POST',{events:[{...event,appId:'other-school'}]},learner);
  assert.equal(r.status,400);assert.equal((await r.json()).rejected[0].code,'app_not_allowed');
  r=await call('/v1/progress/snapshot','PUT',{appId:'english',generation:1,payload:{baseline:true,eventCount:1,eventsByYear:{'2024':1},capturedAt:event.occurredAt}},learner);assert.equal(r.status,200);
  const v2={...event,eventId:'english:exam-state:r1',sourceRecordId:'state:exam:2024',payload:{progressVersion:2,examId:'2024',year:'2024',examStatus:'done',completed:true,correct:23,total:30,referenceAccuracy:77}};
  const latest={...v2,eventId:'english:latest-state:r1',sourceRecordId:'state:latest-exam'};
  const summary={...event,eventId:'english:summary-state:r1',sourceRecordId:'state:summary',eventType:'progress_state',payload:{progressVersion:2,total:4,lastLearningAt:event.occurredAt,weaknessCount:3,retentionPending:2}};
  r=await call('/v1/events/batch','POST',{events:[v2,latest,summary]},learner);assert.equal(r.status,200);assert.equal((await r.json()).accepted.length,3);
  let view=await dashboard(),english=view.devices[0].apps.find(x=>x.appId==='english');
  assert.equal(english.exams['2024'].status,'done');assert.equal(english.latestExam.score,undefined);assert.equal(english.latestExam.correct,23);assert.equal(english.progressMetrics.weaknessCount,3);
  await call('/v1/admin/registrations/classify','POST',{registrationId,status:'production',historyMode:'all'},admin);
  view=await dashboard();assert.equal(view.apps.find(x=>x.appId==='english').latestExam.correct,23);
  assert.equal(today(view.apps.find(x=>x.appId==='math')),'学習日時不明');assert.equal(today(view.apps.find(x=>x.appId==='vocab')),'今日の記録なし');assert.equal(today(view.apps.find(x=>x.appId==='kokugo')),'未同期');
  await call('/v1/admin/registrations/classify','POST',{registrationId,status:'production',historyMode:'from_now'},admin);
  view=await dashboard();assert.equal(view.apps.find(x=>x.appId==='english').recordCount,0);assert.equal(view.apps.find(x=>x.appId==='english').progressMetrics,undefined);
  r=await call('/v1/events/batch','POST',{events:[{...v2,payload:{...v2.payload,examId:'unconfigured-exam'}}]},learner);assert.equal(r.status,400);assert.equal((await r.json()).rejected[0].code,'exam_not_allowed');
  for(const status of ['production','ignored']){
    r=await call('/v1/admin/registrations/classify','POST',{registrationId,status},admin);assert.equal(r.status,200);
    assert.equal((await (await call('/v1/control','GET',undefined,learner)).json()).status,status);
  }
  r=await call('/v1/events/batch','POST',{events:[{...event,eventId:'english:synthetic:r2',revision:2}]},learner);assert.equal(r.status,403);
  r=await call('/v1/admin/registrations/revoke','POST',{registrationId},admin);assert.equal(r.status,200);
  assert.equal((await call('/v1/control','GET',undefined,learner)).status,401);
  console.log('Local Worker runtime PASS: health, registration, Access deny, event, duplicate, payload allowlist, school app rejection, snapshot, v2 exam/metrics, from-now boundary, classify, ignored, revoke');
}finally{await mf.dispose();}
