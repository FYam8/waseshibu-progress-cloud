import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
const source=await readFile(new URL('../src/client/progress-transport.js',import.meta.url),'utf8');
function fixture(){
  const indexedDB=new IDBFactory(),requests=[];let status='production',mode='accept',count=1;
  const registrations=new Map();
  async function fetch(url,init={}){
    const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):null;
    requests.push({path,body,authorization:init.headers?.authorization});
    const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
    if(path==='/v1/register-anonymous'){
      registrations.set(body.registrationId,body.credentialHash);
      return json({ok:true,registrationId:body.registrationId,status,deviceCode:'WS-TEST'});
    }
    const id=[...registrations.keys()][0];
    if(path==='/v1/control')return status==='revoked'?json({ok:false},401):json({ok:true,registrationId:id,status,collectionEnabled:status!=='ignored'});
    if(path==='/v1/progress/snapshot')return json({ok:true});
    if(path==='/v1/events/batch'){
      if(mode==='500')return json({ok:false},500);
      if(mode==='timeout')return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
      if(mode==='partial')return json({ok:true,accepted:[],duplicate:[],rejected:[]});
      if(mode==='retry')return json({ok:true,rejected:body.events.map(e=>({eventId:e.eventId,code:'event_rate_limited',retryable:true}))});
      if(mode==='fatal')return json({ok:true,rejected:body.events.map(e=>({eventId:e.eventId,code:'invalid_payload_field'}))});
      return json({ok:true,accepted:body.events.map(e=>e.eventId),duplicate:[],rejected:[]});
    }
    throw new Error('unexpected endpoint');
  }
  const state={answers:{private:'DO NOT SEND'},total:()=>count};
  function client(appId,{dbName='test-school-sync',schoolId='test-school',endpoint='https://test-school.invalid',legacyEndpoint,bad=false}={}){
    const ctx={indexedDB,crypto:webcrypto,TextEncoder,AbortController,Response,fetch,setTimeout,clearTimeout,setInterval,clearInterval,btoa,navigator:{userAgent:'test',onLine:true},document:{addEventListener(){},removeEventListener(){}}};ctx.window=ctx;ctx.addEventListener=()=>{};ctx.removeEventListener=()=>{};vm.createContext(ctx);vm.runInContext(source,ctx);
    return ctx.SHARED_PROGRESS_TRANSPORT.createTransport({appId,dbName,dbVersion:7,schoolId,endpoint,legacyEndpoint,timeoutMs:5,
      loadState:()=>state,
      buildStateRecords:()=>[{sourceRecordId:'state:summary',eventType:'progress_state',occurredAt:new Date().toISOString(),payload:bad?{total:count,rawAnswer:state.answers.private}:{total:count}}],
      buildOccurrenceRecords:()=>[],occurrenceSignature:()=>String(count),
      buildBaseline:()=>({baseline:true,eventCount:count,eventsByYear:{},capturedAt:new Date().toISOString()}),
    });
  }
  async function rows(storeName,dbName='test-school-sync'){
    return new Promise((resolve,reject)=>{const open=indexedDB.open(dbName,7);open.onsuccess=()=>{const db=open.result,tx=db.transaction(storeName,'readonly'),req=tx.objectStore(storeName).getAll();tx.oncomplete=()=>{db.close();resolve(req.result)};tx.onerror=()=>reject(tx.error)};open.onerror=()=>reject(open.error)});
  }
  async function forgetScope(){return new Promise((resolve,reject)=>{const req=indexedDB.open('test-school-sync',7);req.onsuccess=()=>{const db=req.result,tx=db.transaction('control','readwrite');tx.objectStore('control').delete('deploymentScope');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}})}
  return {client,rows,requests,registrations,state,forgetScope,setStatus:v=>status=v,setMode:v=>mode=v,setCount:v=>count=v};
}
test('four concurrent app clients share one registration without mixing records or learner state',async()=>{
  const f=fixture();
  const apps=['english','math','kokugo','vocab'];
  await Promise.all(apps.map(app=>f.client(app).sync()));
  assert.equal(f.registrations.size,1);
  assert.equal(new Set(f.requests.filter(x=>x.authorization).map(x=>x.authorization)).size,1);
  assert.equal((await f.rows('seen_v2')).length,4);
  assert.equal((await f.rows('outbox')).length,0);
  assert.equal(f.state.answers.private,'DO NOT SEND');
  assert.ok(!JSON.stringify(f.requests).includes('DO NOT SEND'));
  // Recreated client models a restart; unchanged summaries do not create revisions.
  await f.client('english').sync();
  assert.equal((await f.rows('seen_v2')).find(x=>x.appId==='english').revision,1);
});
test('5xx, timeout, incomplete acknowledgments and retryable rejections preserve outbox',async()=>{
  const f=fixture(),client=f.client('english');
  for(const mode of ['500','timeout','partial','retry']){
    f.setMode(mode);await client.sync();assert.equal((await f.rows('outbox')).length,1,mode);assert.equal((await f.rows('deadletter')).length,0,mode);
  }
  f.setMode('accept');await client.sync();assert.equal((await f.rows('outbox')).length,0);
  f.setCount(2);await client.sync();assert.equal((await f.rows('seen_v2'))[0].revision,2);
});
test('ignored stops collection, production resumes, revoke never creates replacement registration',async()=>{
  const f=fixture(),client=f.client('english');
  f.setStatus('ignored');await client.sync();assert.equal((await f.rows('seen_v2')).length,0);
  f.setStatus('production');await client.sync();assert.equal((await f.rows('seen_v2')).length,1);
  f.setStatus('revoked');await client.sync();const n=f.requests.length;await f.client('math').sync();assert.equal(f.requests.length,n);assert.equal(f.registrations.size,1);
});
test('fatal summary rejection goes to deadletter and prohibited fields never leave the browser',async()=>{
  const f=fixture();f.setMode('fatal');await f.client('english').sync();assert.equal((await f.rows('deadletter')).length,1);
  const before=f.requests.filter(x=>x.path==='/v1/events/batch').length;
  await f.client('math',{bad:true}).sync();assert.equal(f.requests.filter(x=>x.path==='/v1/events/batch').length,before);
  assert.ok(!JSON.stringify(f.requests).includes('rawAnswer'));
});
test('stored deployment scope blocks credential reuse with another endpoint or school',async()=>{
  const f=fixture();await f.client('english').sync();const before=f.requests.length;
  await f.client('math',{endpoint:'https://other-school.invalid',schoolId:'other-school'}).sync();
  assert.equal(f.requests.length,before);assert.equal(f.registrations.size,1);
});

test('existing registration and pending seed survive adoption only at the declared legacy endpoint',async()=>{
  const f=fixture();await f.client('english').sync();
  const before=(await f.rows('control')).filter(x=>['registration','pendingRegistration'].includes(x.key));
  await f.forgetScope();const count=f.requests.length;
  await f.client('english').sync();assert.equal(f.requests.length,count);
  await f.client('english',{legacyEndpoint:'https://test-school.invalid'}).sync();
  const after=(await f.rows('control')).filter(x=>['registration','pendingRegistration'].includes(x.key));
  assert.deepEqual(after,before);assert.equal(f.registrations.size,1);
});
