export function dashboardHtml(nonce){
  const years=[2026,2025,2024,2023,2022,2021,2020,2019];
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WaseShibu Progress Admin</title>
<style nonce="${nonce}">
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#f6f7f8}*{box-sizing:border-box}body{margin:0}main{max-width:980px;margin:0 auto;padding:20px 14px 48px}.card{background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0;box-shadow:0 1px 2px rgba(0,0,0,.04)}h1{font-size:22px;margin:4px 0 14px}h2{font-size:17px;margin:0 0 12px}.device{border:1px solid #ddd;border-radius:12px;padding:14px;margin:12px 0;background:#fff}.deviceHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.nickname{font-weight:800;font-size:18px;line-height:1.3}.code{font-weight:700;font-size:14px;color:#555;margin-top:2px}.meta,.small{font-size:13px;color:#666;margin-top:3px}.status{font-size:12px;border:1px solid #ccc;border-radius:999px;padding:3px 8px;white-space:nowrap}.apps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.appCard{border:1px solid #ddd;border-radius:10px;padding:12px}.appTitle{display:flex;justify-content:space-between;gap:8px;align-items:center}.appTitle h3{font-size:16px;margin:0}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}.metric{background:#f7f7f7;border-radius:8px;padding:8px;font-size:12px}.metric b{display:block;font-size:16px;margin-top:3px}.years{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.year{border:1px solid #ddd;border-radius:7px;padding:6px;text-align:center;font-size:12px}.done{background:#ecf8ef;border-color:#a8d7b1}.started{background:#fff8e8;border-color:#e9c971}.notstarted{color:#777}.progressLabel{font-size:13px;color:#555;margin-top:8px}.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}button{border:1px solid #bbb;background:white;border-radius:7px;padding:7px 10px;cursor:pointer}button.primary{background:#171717;color:white;border-color:#171717}button.danger{color:#a00}button:disabled{opacity:.45;cursor:default}.notice{font-size:13px;color:#666}.error{color:#a00}.empty{color:#777;font-size:14px}.formal{margin-top:8px;padding-top:8px;border-top:1px dashed #ddd}@media(max-width:700px){.apps{grid-template-columns:1fr}}@media(max-width:520px){.summary{grid-template-columns:1fr}.years{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
</head>
<body><main>
<h1>WaseShibu Progress Admin</h1>
<div id="message" class="notice">読み込み中…</div>
<section class="card">
<h2>登録端末ごとのCloud同期済み学習進捗</h2>
<p class="notice">この画面にはCloudへ同期済みの履歴だけを表示します。端末内にのみ存在する未同期履歴は含みません。学習記録件数は、現在状態を送る教科ではその要約件数を優先し、未対応の教科ではEvent明細の論理件数を表示します。Snapshotの集計値は加算しません。端末ごとにNicknameを付けると、自分の端末を判別しやすくなります。</p>
<div id="devices"></div>
</section>
<section class="card">
<h2>production端末の正式進捗（参考）</h2>
<p class="notice">production指定された登録端末だけを対象にした従来の統合集計です。端末別確認を主表示とし、この欄は参考情報として残しています。</p>
<div id="formalApps" class="apps formal"></div>
</section>
</main>
<script nonce="${nonce}">
const YEARS=${JSON.stringify(years)};
const YEAR_APPS=new Set(['kokugo','math','english']);
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function when(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function statusLabel(v){return({production:'production',unclassified:'unclassified',ignored:'ignored',revoked:'revoked'})[v]||'unclassified';}
async function api(path,options){const r=await fetch(path,{credentials:'same-origin',headers:{'content-type':'application/json',...(options?.headers||{})},...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.code||('HTTP '+r.status));return d;}
function examText(exam){
  const hasScore=exam&&exam.score!=null&&Number.isFinite(Number(exam.score));if(!hasScore)return '—';
  const hasMax=exam.maxScore!=null&&Number.isFinite(Number(exam.maxScore));
  const year=/^20\d{2}$/.test(String(exam.year||''))?String(exam.year)+'年 ':'';
  const kind=({'first-look':'初見',reference:'参考',first:'初回',retake:'再受験'})[String(exam.kind||'')]||'';
  return year+Number(exam.score)+(hasMax?'/'+Number(exam.maxScore):'')+'点'+(kind?'（'+kind+'）':'');
}
function appHtml(app){
  const states=app.years||{};
  const hasYearState=Object.keys(states).length>0||Number(app.recordCount||0)>0||!!app.lastLearningAt||!!app.latestExam||!!app.progressLabel;
  const years=YEAR_APPS.has(String(app.appId))&&hasYearState?'<div class="years">'+YEARS.map(y=>{const s=states[String(y)]||'notstarted';const label=s==='done'?'✅ 完了':s==='started'?'▶ 途中':'－ 未着手';return '<div class="year '+s+'"><b>'+y+'</b><br>'+label+'</div>';}).join('')+'</div>':'';
  const progress=app.progressLabel?'<div class="progressLabel">'+esc(app.progressLabel)+'</div>':'';
  return '<div class="appCard"><div class="appTitle"><h3>'+esc(app.label||app.appId)+'</h3><span class="small">'+esc(app.appId)+'</span></div>'+
    '<div class="summary"><div class="metric">最終学習<b>'+esc(when(app.lastLearningAt))+'</b></div><div class="metric">直近過去問<b>'+esc(examText(app.latestExam))+'</b></div><div class="metric">学習記録<b>'+Number(app.recordCount||0)+'件</b></div></div>'+years+progress+'</div>';
}
function deviceHtml(d){
  const disabled=d.status==='revoked';
  const deviceMeta=[d.deviceType,d.osFamily,d.browserFamily].filter(Boolean).join(' / ')||'端末情報なし';
  const apps=Array.isArray(d.apps)?d.apps:[];
  const identity=d.nickname?'<div class="nickname">'+esc(d.nickname)+'</div><div class="code">'+esc(d.deviceCode||'NO-CODE')+'</div>':'<div class="code">'+esc(d.deviceCode||'NO-CODE')+'</div><div class="meta">Nickname未設定</div>';
  return '<div class="device" data-id="'+esc(d.registrationId)+'" data-nickname="'+esc(d.nickname||'')+'">'+
    '<div class="deviceHead"><div>'+identity+'<div class="meta">'+esc(deviceMeta)+'</div></div><span class="status">'+esc(statusLabel(d.status))+'</span></div>'+
    '<div class="small">最終アクセス '+esc(when(d.lastSeenAt))+' ・ Cloud学習記録 '+Number(d.eventCount||0)+'件'+(d.productionFrom?' ・ production開始 '+esc(when(d.productionFrom)):'')+'</div>'+
    '<div class="apps">'+(apps.length?apps.map(appHtml).join(''):'<p class="empty">Cloud同期済み教科データはありません。</p>')+'</div>'+
    '<div class="actions">'+
      '<button data-action="nickname">'+(d.nickname?'Nickname変更':'Nickname設定')+'</button>'+
      '<button class="primary" data-action="production" '+(disabled||d.status==='production'?'disabled':'')+'>production</button>'+
      '<button data-action="ignored" '+(disabled||d.status==='ignored'?'disabled':'')+'>ignored</button>'+
      '<button class="danger" data-action="revoke" '+(disabled?'disabled':'')+'>revoke</button>'+
    '</div></div>';
}
function render(data){
  $('message').textContent='更新 '+new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  $('message').className='notice';
  const devices=data.devices||[];
  $('devices').innerHTML=devices.length?devices.map(deviceHtml).join(''):'<p class="empty">登録端末はまだありません。</p>';
  const formalApps=data.apps||[];
  $('formalApps').innerHTML=formalApps.length?formalApps.map(appHtml).join(''):'<p class="empty">正式進捗はまだありません。</p>';
}
async function load(){try{render(await api('/admin/api/summary'));}catch(e){$('message').textContent='読み込み失敗: '+e.message;$('message').className='notice error';}}
$('devices').addEventListener('click',async e=>{
  const button=e.target.closest('button[data-action]');if(!button)return;
  const row=button.closest('[data-id]'),registrationId=row?.dataset.id,action=button.dataset.action;if(!registrationId)return;
  if(action==='nickname'){
    const next=prompt('この端末のNicknameを入力してください（60文字まで）。空欄で保存するとNicknameを解除します。',row.dataset.nickname||'');
    if(next===null)return;
    if(next.trim().length>60){alert('Nicknameは60文字以内で入力してください。');return;}
    button.disabled=true;
    try{await api('/admin/api/nickname',{method:'POST',body:JSON.stringify({registrationId,nickname:next})});await load();}catch(err){alert('Nicknameの更新に失敗しました: '+err.message);button.disabled=false;}
    return;
  }
  if(action==='revoke'&&!confirm('この登録端末を無効化します。今後のCloud同期は停止します。端末内の学習履歴とCloudに保存済みの履歴は削除されません。'))return;
  button.disabled=true;
  try{if(action==='revoke')await api('/admin/api/revoke',{method:'POST',body:JSON.stringify({registrationId})});else await api('/admin/api/classify',{method:'POST',body:JSON.stringify({registrationId,status:action})});await load();}catch(err){alert('更新に失敗しました: '+err.message);button.disabled=false;}
});
load();
</script></body></html>`;
}
