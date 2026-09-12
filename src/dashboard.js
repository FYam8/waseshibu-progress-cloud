export function dashboardHtml(nonce){
  const years=[2024,2023,2022,2021,2020,2019,2025,2026];
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WaseShibu Progress Admin</title>
<style nonce="${nonce}">
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#f6f7f8}*{box-sizing:border-box}body{margin:0}main{max-width:880px;margin:0 auto;padding:20px 14px 48px}.card{background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.04)}h1{font-size:22px;margin:4px 0 14px}h2{font-size:17px;margin:0 0 12px}.apps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.appCard{border:1px solid #ddd;border-radius:10px;padding:12px}.appTitle{display:flex;justify-content:space-between;gap:8px;align-items:center}.appTitle h3{font-size:16px;margin:0}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}.metric{background:#f7f7f7;border-radius:8px;padding:8px;font-size:12px}.metric b{display:block;font-size:16px;margin-top:3px}.years{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.year{border:1px solid #ddd;border-radius:7px;padding:6px;text-align:center;font-size:12px}.done{background:#ecf8ef;border-color:#a8d7b1}.started{background:#fff8e8;border-color:#e9c971}.notstarted{color:#777}.progressLabel{font-size:13px;color:#555;margin-top:8px}.device{border-top:1px solid #eee;padding:13px 0}.device:first-child{border-top:0}.deviceHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.code{font-weight:700}.meta,.small{font-size:13px;color:#666;margin-top:3px}.status{font-size:12px;border:1px solid #ccc;border-radius:999px;padding:3px 8px;white-space:nowrap}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}button{border:1px solid #bbb;background:white;border-radius:7px;padding:7px 10px;cursor:pointer}button.primary{background:#171717;color:white;border-color:#171717}button.danger{color:#a00}button:disabled{opacity:.45;cursor:default}.notice{font-size:13px;color:#666}.error{color:#a00}.empty{color:#777;font-size:14px}@media(max-width:700px){.apps{grid-template-columns:1fr}}@media(max-width:520px){.summary{grid-template-columns:1fr}.years{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
</head>
<body><main>
<h1>WaseShibu Progress Admin</h1>
<div id="message" class="notice">読み込み中…</div>
<section class="card">
<h2>学習進捗</h2>
<div id="apps" class="apps"></div>
<p class="notice">進捗は production 端末だけを対象にします。まだCloud同期していない教科は0件表示です。</p>
</section>
<section class="card">
<h2>端末</h2>
<div id="devices"></div>
</section>
</main>
<script nonce="${nonce}">
const YEARS=${JSON.stringify(years)};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function when(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function statusLabel(v){return({production:'production',unclassified:'unclassified',ignored:'ignored',revoked:'revoked'})[v]||'unclassified';}
async function api(path,options){const r=await fetch(path,{credentials:'same-origin',headers:{'content-type':'application/json',...(options?.headers||{})},...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.code||('HTTP '+r.status));return d;}
function examText(exam){const hasScore=exam&&exam.score!=null&&Number.isFinite(Number(exam.score));const hasMax=exam&&exam.maxScore!=null&&Number.isFinite(Number(exam.maxScore));return hasScore?(Number(exam.score)+(hasMax?'/'+Number(exam.maxScore):'')+'点'):'—';}
function appHtml(app){
  const states=app.years||{};
  const years=Object.keys(states).length?'<div class="years">'+YEARS.map(y=>{const s=states[String(y)]||'notstarted';const label=s==='done'?'✅ 完了':s==='started'?'▶ 途中':'－ 未着手';return '<div class="year '+s+'"><b>'+y+'</b><br>'+label+'</div>';}).join('')+'</div>':'';
  const progress=app.progressLabel?'<div class="progressLabel">'+esc(app.progressLabel)+'</div>':'';
  return '<div class="appCard"><div class="appTitle"><h3>'+esc(app.label||app.appId)+'</h3><span class="small">'+esc(app.appId)+'</span></div>'+
    '<div class="summary"><div class="metric">最終学習<b>'+esc(when(app.lastLearningAt))+'</b></div><div class="metric">直近過去問<b>'+esc(examText(app.latestExam))+'</b></div><div class="metric">学習記録<b>'+Number(app.recordCount||0)+'件</b></div></div>'+years+progress+'</div>';
}
function render(data){
  $('message').textContent='更新 '+new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  $('message').className='notice';
  const apps=data.apps||[];$('apps').innerHTML=apps.length?apps.map(appHtml).join(''):'<p class="empty">教科データはまだありません。</p>';
  const devices=data.devices||[];
  $('devices').innerHTML=devices.length?devices.map(d=>{
    const disabled=d.status==='revoked';
    return '<div class="device" data-id="'+esc(d.registrationId)+'">'+
      '<div class="deviceHead"><div><div class="code">'+esc(d.deviceCode||'NO-CODE')+'</div><div class="meta">'+esc([d.osFamily,d.browserFamily].filter(Boolean).join(' / '))+'</div></div><span class="status">'+esc(statusLabel(d.status))+'</span></div>'+
      '<div class="small">最終アクセス '+esc(when(d.lastSeenAt))+' ・ records '+Number(d.eventCount||0)+'</div>'+
      '<div class="actions">'+
        '<button class="primary" data-action="production" '+(disabled||d.status==='production'?'disabled':'')+'>production</button>'+
        '<button data-action="ignored" '+(disabled||d.status==='ignored'?'disabled':'')+'>ignored</button>'+
        '<button class="danger" data-action="revoke" '+(disabled?'disabled':'')+'>revoke</button>'+
      '</div></div>';
  }).join(''):'<p class="empty">端末はまだありません。</p>';
}
async function load(){try{render(await api('/admin/api/summary'));}catch(e){$('message').textContent='読み込み失敗: '+e.message;$('message').className='notice error';}}
$('devices').addEventListener('click',async e=>{
  const button=e.target.closest('button[data-action]');if(!button)return;
  const row=button.closest('[data-id]'),registrationId=row?.dataset.id,action=button.dataset.action;if(!registrationId)return;
  if(action==='revoke'&&!confirm('この端末を無効化します。今後のCloud同期は停止します。端末内の学習履歴と、production端末として既に保存された正式進捗は削除されません。'))return;
  button.disabled=true;
  try{if(action==='revoke')await api('/admin/api/revoke',{method:'POST',body:JSON.stringify({registrationId})});else await api('/admin/api/classify',{method:'POST',body:JSON.stringify({registrationId,status:action})});await load();}catch(err){alert('更新に失敗しました: '+err.message);button.disabled=false;}
});
load();
</script></body></html>`;
}
