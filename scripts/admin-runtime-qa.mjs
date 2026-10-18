import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync,sign,randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {SCHOOL_PROFILE as p} from '../src/deploymentProfile.js';
const require=createRequire(new URL('../package.json',import.meta.url));
const sim=require('miniflare');
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'isolated-qa',alg:'RS256',use:'sig'};
const jwt=(extra={})=>{const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=b({alg:'RS256',kid:jwk.kid})+'.'+b({iss:p.access.teamDomain,aud:[p.access.audience],email:'qa@example.invalid',exp:Math.floor(Date.now()/1000)+600,...extra});return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');};
const options={modules:true,scriptPath:fileURLToPath(new URL('../dist/indexV10.js',import.meta.url)),compatibilityDate:'2026-09-12',durableObjects:{PROGRESS:{className:'HouseholdProgress',useSQLite:true}},bindings:{HOUSEHOLD_OBJECT_NAME:p.objectName,ALLOWED_ORIGINS:p.allowedOrigin,ANONYMOUS_REGISTRATION_ENABLED:'1',ACCESS_ALLOWED_EMAILS:'qa@example.invalid'},outboundService:async req=>{assert.equal(req.url,p.access.teamDomain+'/cdn-cgi/access/certs');return new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}});}};
const mf=new sim.Miniflare(sim.convertV4MiniflareOptions?sim.convertV4MiniflareOptions(options):options);
const call=(url,method='GET',body,headers={})=>mf.dispatchFetch('https://isolated.test'+url,{method,headers:{origin:p.allowedOrigin,'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const admin={'cf-access-jwt-assertion':jwt()};
try{
 for(const payload of [{aud:['other-school']},{iss:'https://other.invalid'},{email:'other@example.invalid'},{exp:1}])assert.equal((await call('/admin','GET',null,{'cf-access-jwt-assertion':jwt(payload)})).status,403);
 const page=await call('/admin','GET',null,admin);assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/nonce-/);assert.match(await page.text(),/Nickname/);
 const registrationId=randomUUID(),credential='local-admin-qa-'+randomUUID();
 let r=await call('/v1/register-anonymous','POST',{registrationId,credentialHash:createHash('sha256').update(credential).digest('hex'),device:{deviceType:'desktop'}},{'cf-connecting-ip':'192.0.2.1'});assert.equal(r.status,200);const reg=await r.json();
 const summary=async()=>{const r=await call('/admin/api/summary','GET',null,admin);assert.equal(r.status,200);return r.json();};
 let d=(await summary()).devices.find(d=>d.registrationId===registrationId);assert.equal(d.status,'unclassified');assert.equal(d.lastIp,'192.0.2.1');assert.ok(d.lastSeenAt);assert.equal(d.deviceCode,reg.deviceCode);
 r=await call('/admin/api/nickname','POST',{registrationId,nickname:'仮の検証端末'},admin);assert.equal(r.status,200);assert.equal((await summary()).devices.find(d=>d.registrationId===registrationId).nickname,'仮の検証端末');
 assert.equal((await call('/admin/api/nickname','POST',{registrationId,nickname:'x'.repeat(61)},admin)).status,400);

 const apps=Object.keys(p.apps),learner={authorization:'Bearer '+credential};
 const query=async(filters={})=>{const r=await call('/admin/api/answers?'+new URLSearchParams({device:registrationId,...filters}),'GET',null,admin);assert.equal(r.status,200);return r.json();};
 assert.equal((await call('/admin/api/answers?device='+registrationId)).status,403);
 assert.equal((await call('/admin/api/answers?device=invalid','GET',null,admin)).status,400);
 const at='2026-10-18T09:00:00.000Z';
 const make=(i,appId=apps[i%apps.length])=>({eventId:'qa-answer-'+i,appId,sourceRecordId:'answer:qa-'+i,revision:1,eventType:'answer_record',occurredAt:at,payload:{answerVersion:1,questionId:'Q'+i,questionLabel:'大問1',answerText:'<script>not executable</script>',expectedText:'registered answer',outcome:i%2?'correct':'wrong',gradingMethod:'客観採点'}});
 for(let i=0;i<65;i+=10){const events=Array.from({length:Math.min(10,65-i)},(_,j)=>make(i+j));const r=await call('/v1/events/batch','POST',{events},learner);assert.equal(r.status,200);assert.equal((await r.json()).accepted.length,events.length);}
 assert.equal((await query()).records.length,33);
 const first=await query({outcome:'all'});assert.equal(first.records.length,50);assert.ok(first.nextCursor);assert.equal((await query({outcome:'all',cursor:first.nextCursor})).records.length,15);
 assert.ok((await query({app:apps[0]})).records.every(r=>r.appId===apps[0]));
 assert.equal((await query({question:'Q0'})).records[0].answerText,'<script>not executable</script>');
 let duplicate=await(await call('/v1/events/batch','POST',{events:[make(0)]},learner)).json();assert.equal(duplicate.duplicate.length,1);
 const newer={...make(0),eventId:'qa-revision-2',revision:2,payload:{...make(0).payload,outcome:'correct'}};
 assert.equal((await call('/v1/events/batch','POST',{events:[newer]},learner)).status,200);
 assert.equal((await query({question:'Q0'})).records.length,0);assert.equal((await query({question:'Q0',outcome:'all'})).records.length,1);
 assert.equal((await summary()).devices.find(d=>d.registrationId===registrationId).eventCount,0,'answer details must not inflate aggregate count');
 const invalid={...make(99),payload:{...make(99).payload,answerText:{nested:'forbidden'}}};assert.equal((await call('/v1/events/batch','POST',{events:[invalid]},learner)).status,400);
 const other=randomUUID(),secret='other-'+randomUUID();await call('/v1/register-anonymous','POST',{registrationId:other,credentialHash:createHash('sha256').update(secret).digest('hex')});
 const isolated=await(await call('/admin/api/answers?'+new URLSearchParams({device:other,outcome:'all'}),'GET',null,admin)).json();assert.equal(isolated.records.length,0);
 console.log('Answer runtime PASS: four subjects, exact answers, auth, validation, duplicate/revision, device isolation, filters, 50-row pagination, aggregate unchanged');
 for(const status of ['production','ignored']){assert.equal((await call('/admin/api/classify','POST',{registrationId,status},admin)).status,200);assert.equal((await summary()).devices.find(d=>d.registrationId===registrationId).status,status);}
 assert.equal((await call('/admin/api/revoke','POST',{registrationId},admin)).status,200);assert.equal((await summary()).devices.find(d=>d.registrationId===registrationId).status,'revoked');
 assert.equal((await call('/v1/control','GET',null,{authorization:'Bearer '+credential})).status,401);
 console.log('Admin runtime PASS: signed JWT allow, wrong audience/issuer/email/expiry deny, CSP, nickname, classify, revoke, IP and access timestamp');
}finally{await mf.dispose();}

