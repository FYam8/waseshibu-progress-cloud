// Real browser/IndexedDB, synthetic state, intercepted network; no production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const esbuild=createRequire(path.join(root,'waseshibu-math/package.json'))('esbuild');
const math=esbuild.buildSync({stdin:{contents:fs.readFileSync(path.join(root,'waseshibu-math/src/progressSync.ts'),'utf8')+'\nexport {buildBaseline,buildStateRecords};',loader:'ts',resolveDir:path.join(root,'waseshibu-math/src')},bundle:true,format:'iife',globalName:'MathAdapter',write:false,define:{'import.meta.env':'{}'}}).outputFiles[0].text;
const API='https://waseshibu-progress-api.fyam8.workers.dev';
const iso='2026-10-03T01:02:03.000Z';
const fixture={english:{goal:60,attempts:[{id:'synthetic-exam',year:2024,status:'graded',gradedAt:iso,writtenScore:55,answers:{secret:'PRIVATE-RAW-ANSWER'}}],drillLog:[],weak:{}},vocab:{words:{synthetic:{correct:3,incorrect:1,mastery:3,lastStudied:iso,nextReview:iso,recentResults:[{answer:'PRIVATE-RAW-ANSWER'}]}},stats:{todayCount:1},settings:{sessionSize:20}},math:[{id:'synthetic-math',questionId:'2024-Q1',at:iso,topic:'2024年度',status:'correct',answer:'PRIVATE-RAW-ANSWER'}]};
const event={id:'synthetic-kokugo',year:2024,at:iso,type:'exam',score:55,maxScore:100,answerText:'PRIVATE-RAW-ANSWER'};
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://local').pathname;
  if(pathname==='/math.js'){res.setHeader('content-type','text/javascript');return res.end(math);}
  if(pathname.startsWith('/tab/')){
    const app=pathname.split('/').at(-1);let scripts='';
    if(app==='kokugo')scripts=`<script type="module">import * as sync from '/waseshibu-source/src/lib/progressSyncV4.js';window.qaEvents=${JSON.stringify([event])};window.qaSync=sync;window.qaReady=await sync.initKokugoProgressSync({loadExistingEvents:async()=>window.qaEvents});</script>`;
    if(app==='math')scripts='<script src="/math.js"></script><script>MathAdapter.initMathProgressSync();window.qaReady=true;</script>';
    for(const [id,repo] of [['english','waseshibu-english'],['vocab','english-vocab']])if(app===id)scripts=`<script src="/${repo}/shared-progress-transport.js"></script><script src="/${repo}/progress-sync.js"></script><script>window.qaReady=true;</script>`;
    res.setHeader('content-type','text/html');return res.end('<!doctype html><meta name="viewport" content="width=device-width"><title>Isolated progress QA</title>'+scripts);
  }
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!file.endsWith('.js'))return res.writeHead(404).end();
  try{res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const result=[];
try{
for(const width of [390,1280]){
  const registrations=new Map(),calls=[],errors=[];let mode='accept',status='production';
  let context;
  async function setup(storageState){
    const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:width===390,serviceWorkers:'block',storageState});
    ctx.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
    await ctx.addInitScript(({fixture,API})=>{
      if(location.protocol!=='http:')return;
      window.__WASESHIBU_PROGRESS_API__=API;
      for(const [key,value] of [['waseshibu.adaptive.v3',fixture.english],['waseshibu_vocab_state',fixture.vocab],['waseshibu-math-attempts',fixture.math]])if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(value));
    },{fixture,API});
    await ctx.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());if(url.origin===origin)return route.continue();
      if(url.origin!==API)return route.abort();
      const body=req.postData()?JSON.parse(req.postData()):null,authorization=req.headers().authorization;
      calls.push({path:url.pathname,body,authorization});
      const registrationId=body?.registrationId||[...registrations.keys()][0];let code=200,data={ok:true};
      if(url.pathname==='/v1/register-anonymous'){registrations.set(registrationId,body.credentialHash);data={ok:true,registrationId,status,deviceCode:'WS-SYNTHETIC'};}
      if(url.pathname==='/v1/control'){code=status==='revoked'?401:200;data={ok:code===200,registrationId,status,deviceCode:'WS-SYNTHETIC',collectionEnabled:status!=='ignored'};}
      if(url.pathname==='/v1/events/batch'){
        if(mode==='500'){code=503;data={ok:false};}
        else if(mode==='partial')data={ok:true,accepted:[],duplicate:[],rejected:[]};
        else if(mode==='malformed')data={ok:false,accepted:body.events.map(e=>e.eventId)};
        else data={ok:true,accepted:body.events.map(e=>e.eventId),duplicate:[],rejected:[]};
      }
      await route.fulfill({status:code,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
    });return ctx;
  }
  context=await setup();
  const pages=await Promise.all(['english','math','kokugo','vocab'].map(async app=>{const p=await context.newPage();await p.goto(origin+'/tab/'+app);await p.waitForFunction(()=>window.qaReady);return p;}));
  const rows=(page,name)=>page.evaluate(name=>new Promise((resolve,reject)=>{const r=indexedDB.open('waseshibu-progress-sync',7);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction(name,'readonly'),q=tx.objectStore(name).getAll();tx.oncomplete=()=>{db.close();resolve(q.result)};tx.onerror=()=>reject(tx.error);};}),name);
  await pages[1].evaluate(()=>MathAdapter.buildBaseline());
  const deadline=Date.now()+20000;
  while((await rows(pages[0],'control')).filter(x=>x.key.includes(':baselineSent:')).length!==4&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
  await pages[2].evaluate(()=>qaSync.flushProgressSync());
  assert.equal(registrations.size,1);assert.equal(new Set(calls.filter(x=>x.authorization).map(x=>x.authorization)).size,1);
  assert.ok(calls.filter(x=>x.path==='/v1/progress/snapshot').length>=4,JSON.stringify({width,calls:calls.map(x=>({path:x.path,appId:x.body?.appId})),controls:(await rows(pages[0],'control')).map(x=>x.key)}));
  assert.equal((await rows(pages[0],'seen_v2')).find(x=>x.sourceRecordId===event.id).state,'baseline');
  await pages[2].evaluate(e=>{qaEvents.push(e);return qaSync.notifyKokugoEventSaved(e);},{...event,id:'new-event'});
  await pages[2].evaluate(()=>qaSync.flushProgressSync());
  assert.ok(calls.some(x=>x.body?.events?.some(e=>e.sourceRecordId==='new-event')));
  assert.ok(!JSON.stringify(calls).includes('PRIVATE-RAW-ANSWER'));
  assert.equal(await pages[0].evaluate(()=>JSON.parse(localStorage.getItem('waseshibu-math-attempts'))[0].answer),'PRIVATE-RAW-ANSWER');
  mode='500';await pages[0].evaluate(()=>{const s=JSON.parse(localStorage.getItem('waseshibu.adaptive.v3'));s.attempts[0].writtenScore=57;localStorage.setItem('waseshibu.adaptive.v3',JSON.stringify(s));return __WASESHIBU_ENGLISH_PROGRESS_SYNC__.sync();});
  assert.ok((await rows(pages[0],'outbox')).length>0);
  for(const failure of ['partial','malformed']){mode=failure;await pages[0].evaluate(()=>__WASESHIBU_ENGLISH_PROGRESS_SYNC__.sync());assert.ok((await rows(pages[0],'outbox')).length>0);}
  const saved=await context.storageState({indexedDB:true});await context.close();context=await setup(saved);
  const reopened=await context.newPage();await reopened.goto(origin+'/tab/english');await reopened.waitForFunction(()=>window.qaReady);
  assert.equal(registrations.size,1);assert.ok((await rows(reopened,'outbox')).length>0);
  await context.setOffline(true);await reopened.evaluate(()=>__WASESHIBU_ENGLISH_PROGRESS_SYNC__.sync());assert.ok((await rows(reopened,'outbox')).length>0);
  mode='accept';await context.setOffline(false);await reopened.evaluate(()=>__WASESHIBU_ENGLISH_PROGRESS_SYNC__.sync());
  await reopened.waitForFunction(()=>new Promise(resolve=>{const r=indexedDB.open('waseshibu-progress-sync',7);r.onsuccess=()=>{const db=r.result,tx=db.transaction('outbox','readonly'),q=tx.objectStore('outbox').getAll();tx.oncomplete=()=>{db.close();resolve(!q.result.some(e=>e.appId==='english'))};};}));
  status='ignored';await reopened.evaluate(()=>__WASESHIBU_ENGLISH_PROGRESS_SYNC__.sync());assert.equal((await rows(reopened,'control')).find(x=>x.key==='collectionDisabled').value,true);
  status='revoked';await reopened.evaluate(()=>__WASESHIBU_ENGLISH_PROGRESS_SYNC__.sync());assert.equal((await rows(reopened,'control')).find(x=>x.key==='syncRevoked').value,true);
  assert.deepEqual(errors,[]);await context.close();result.push({width,touch:width===390,oneDevice:true,privateDataAbsent:true,restartOutboxPreserved:true,offlineRetry:true,baselinePreserved:true,ignoredRevoked:true});
}
console.log(JSON.stringify({status:'PASS',scope:'four real adapters and browser IndexedDB; synthetic network',result},null,2));
}finally{await browser.close();server.close();}
