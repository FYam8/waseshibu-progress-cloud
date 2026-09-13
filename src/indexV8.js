import baseWorker, { HouseholdProgress as BaseHouseholdProgress } from './indexV7.js';

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));}
function cleanNickname(v){
  if(typeof v!=='string')return null;
  const value=v.trim();
  if(value.length>60||/[\u0000-\u001f\u007f]/.test(value))return null;
  return value;
}
function progressStub(env){return env.PROGRESS.getByName(String(env.HOUSEHOLD_OBJECT_NAME||'family-main'));}
async function internal(env,path,body={}){
  const r=await progressStub(env).fetch(`https://internal${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  return{response:r,data:await r.json().catch(()=>({}))};
}
async function requireDashboardAccess(request,env){
  // Reuse the existing Cloudflare Access verification without generating the
  // full dashboard summary (which scans learning-history tables). GET /admin
  // performs the same Access check but only renders the protected shell.
  const u=new URL(request.url);u.pathname='/admin';u.search='';
  return baseWorker.fetch(new Request(u.toString(),{method:'GET',headers:request.headers}),env);
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/admin/api/nickname'){
      const auth=await requireDashboardAccess(request,env);
      if(!auth.ok)return auth;
      let body;
      try{
        if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return json({ok:false,code:'invalid_content_type'},400);
        body=await request.json();
      }catch{return json({ok:false,code:'invalid_json'},400);}
      const registrationId=String(body?.registrationId||'');
      const nickname=cleanNickname(body?.nickname);
      if(!uuid(registrationId))return json({ok:false,code:'invalid_registration_id'},400);
      if(nickname===null)return json({ok:false,code:'invalid_nickname'},400);
      const x=await internal(env,'/internal/admin/nickname',{registrationId,nickname,now:new Date().toISOString()});
      return json(x.data,x.response.status);
    }
    return baseWorker.fetch(request,env,ctx);
  }
};

export class HouseholdProgress extends BaseHouseholdProgress{
  constructor(ctx,env){
    super(ctx,env);
    const cols=this.sql.exec('PRAGMA table_info(registrations)').toArray().map(x=>x.name);
    if(!cols.includes('nickname'))this.sql.exec('ALTER TABLE registrations ADD COLUMN nickname TEXT');
  }

  async fetch(request){
    const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/internal/admin/nickname'){
      const body=await request.json().catch(()=>null);
      const registrationId=String(body?.registrationId||'');
      const nickname=cleanNickname(body?.nickname);
      if(!uuid(registrationId))return json({ok:false,code:'invalid_registration_id'},400);
      if(nickname===null)return json({ok:false,code:'invalid_nickname'},400);
      const exists=this.sql.exec('SELECT id FROM registrations WHERE id=? LIMIT 1',registrationId).toArray()[0];
      if(!exists)return json({ok:false,code:'registration_not_found'},404);
      this.sql.exec('UPDATE registrations SET nickname=? WHERE id=?',nickname||null,registrationId);
      return json({ok:true,registrationId,nickname:nickname||null});
    }

    if(request.method==='POST'&&url.pathname==='/internal/admin/dashboard-summary'){
      const base=await super.fetch(request);
      const data=await base.clone().json().catch(()=>null);
      if(!base.ok||!data?.ok||!Array.isArray(data.devices))return base;
      const rows=this.sql.exec('SELECT id,nickname FROM registrations').toArray();
      const nicknames=new Map(rows.map(row=>[String(row.id),row.nickname||null]));
      for(const device of data.devices)device.nickname=nicknames.get(String(device.registrationId))||null;
      return json(data,base.status,Object.fromEntries(base.headers.entries()));
    }

    return super.fetch(request);
  }
}
