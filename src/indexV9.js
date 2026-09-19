import baseWorker, { HouseholdProgress as BaseHouseholdProgress } from './indexV8.js';

function cleanIp(value){
  const ip=String(value||'').trim();
  if(!ip||ip.length>45||!/^[0-9a-f:.]+$/i.test(ip))return null;
  return ip;
}

function withClientIp(env,lastIp){
  if(!lastIp)return env;
  return new Proxy(env,{
    get(target,property,receiver){
      if(property!=='PROGRESS')return Reflect.get(target,property,receiver);
      return{
        getByName(name,...args){
          const stub=target.PROGRESS.getByName(name,...args);
          return{
            async fetch(input,init={}){
              if(typeof init.body!=='string')return stub.fetch(input,init);
              let body;
              try{body=JSON.parse(init.body);}catch{return stub.fetch(input,init);}
              return stub.fetch(input,{...init,body:JSON.stringify({...body,lastIp})});
            }
          };
        }
      };
    }
  });
}

function json(data,response){
  return new Response(JSON.stringify(data),{
    status:response.status,
    statusText:response.statusText,
    headers:response.headers
  });
}

export default{
  fetch(request,env,ctx){
    const lastIp=cleanIp(request.headers.get('cf-connecting-ip'));
    return baseWorker.fetch(request,withClientIp(env,lastIp),ctx);
  }
};

export class HouseholdProgress extends BaseHouseholdProgress{
  constructor(ctx,env){
    super(ctx,env);
    const cols=this.sql.exec('PRAGMA table_info(registrations)').toArray().map(row=>row.name);
    if(!cols.includes('last_ip'))this.sql.exec('ALTER TABLE registrations ADD COLUMN last_ip TEXT');
  }

  async fetch(request){
    const url=new URL(request.url);
    const body=request.method==='POST'?await request.clone().json().catch(()=>null):null;
    const response=await super.fetch(request);

    if(request.method==='POST'&&url.pathname==='/internal/admin/dashboard-summary'){
      const data=await response.clone().json().catch(()=>null);
      if(!response.ok||!data?.ok||!Array.isArray(data.devices))return response;
      const rows=this.sql.exec('SELECT id,last_ip FROM registrations').toArray();
      const ips=new Map(rows.map(row=>[String(row.id),cleanIp(row.last_ip)]));
      for(const device of data.devices)device.lastIp=ips.get(String(device.registrationId))||null;
      return json(data,response);
    }

    const lastIp=cleanIp(body?.lastIp);
    if(!response.ok||!lastIp)return response;
    if(url.pathname==='/internal/register-anonymous'||url.pathname==='/internal/enroll'){
      this.sql.exec('UPDATE registrations SET last_ip=? WHERE id=?',lastIp,String(body?.registrationId||''));
    }else if(url.pathname==='/internal/events'||url.pathname==='/internal/snapshot'||url.pathname==='/internal/control'){
      this.sql.exec('UPDATE registrations SET last_ip=? WHERE credential_hash=?',lastIp,String(body?.credentialHash||''));
    }
    return response;
  }
}
