// 公开资料卡与状态页（自包含 HTML/CSS/JS，无 CDN）。所有用户内容都经过转义。
export const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
const isUrl = (s) => /^https?:\/\/[^\s]+$/i.test(s || '');
const PLACE_ICON = { cafe: '☕', restaurant: '🍜', bar: '🍸', park: '🌳', gym: '💪', online: '💻', other: '📍' };
const JSON_FOR_SCRIPT = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const CSS = `
:root{--bg:#fff7f2;--ink:#2b2230;--mute:#7b6f80;--pri:#ff5d73;--pri2:#ff9a5a;--card:#fff;--line:#f0e4e0;--ok:#22a06b}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif;padding-bottom:96px}
.wrap{max-width:560px;margin:0 auto}
.hero{background:linear-gradient(160deg,var(--pri),var(--pri2));color:#fff;padding:36px 20px 70px;text-align:center;border-radius:0 0 36px 36px;position:relative}
.av{width:132px;height:132px;border-radius:50%;background:#fff;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:76px;box-shadow:0 8px 28px rgba(0,0,0,.18);overflow:hidden}
.av img{width:100%;height:100%;object-fit:cover}
h1{margin:0;font-size:28px}.sub{opacity:.95;margin-top:2px}
.tag{margin:10px auto 0;font-size:17px;max-width:420px}
.online{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.25);padding:4px 10px;border-radius:99px;font-size:12px}
.online:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#7CFFB2;margin-right:6px}
.card{background:var(--card);margin:-40px 14px 14px;border-radius:20px;padding:18px;box-shadow:0 6px 24px rgba(80,40,40,.08)}
.card+.card{margin-top:14px}
h2{font-size:15px;margin:0 0 8px;color:var(--mute);font-weight:600;letter-spacing:.05em}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{background:#fff0ee;color:#d94a5c;border-radius:99px;padding:5px 12px;font-size:14px}
.chip.b{background:#eef4ff;color:#3b62c9}
p{margin:0}.sec+.sec{margin-top:16px}
.place{display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed var(--line)}.place:last-child{border:0}.place small{color:var(--mute)}
.cta{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:flex;gap:10px;max-width:560px;margin:0 auto;border-top:1px solid var(--line)}
button,.btn{font:inherit;border:0;border-radius:14px;padding:13px 16px;cursor:pointer;flex:1;font-weight:600;text-align:center;text-decoration:none;display:inline-block}
.b1{background:#fff;color:var(--pri);border:1.5px solid var(--pri)}.b2{background:linear-gradient(90deg,var(--pri),var(--pri2));color:#fff}
.b3{background:#f4eeee;color:var(--ink)}
dialog{border:0;border-radius:22px;padding:0;width:min(520px,94vw);max-height:92vh;box-shadow:0 20px 60px rgba(0,0,0,.35)}
dialog::backdrop{background:rgba(30,10,20,.5)}
.dlg{padding:20px;overflow:auto;max-height:88vh}
.dlg h3{margin:0 0 12px;font-size:20px}
label{display:block;font-size:13px;color:var(--mute);margin:12px 0 5px}
input,textarea,select{width:100%;font:inherit;padding:11px 12px;border:1.5px solid var(--line);border-radius:12px;background:#fff;color:var(--ink)}
textarea{min-height:76px;resize:vertical}
.opts{display:flex;flex-wrap:wrap;gap:8px}
.opt{border:1.5px solid var(--line);border-radius:12px;padding:8px 12px;cursor:pointer;font-size:14px;background:#fff;user-select:none}
.opt.on{border-color:var(--pri);background:#fff0ee;color:#d94a5c;font-weight:600}
.day{font-size:13px;color:var(--mute);margin:12px 0 6px}
.hp{position:absolute;left:-9999px;opacity:0;height:0;overflow:hidden}
.msg{margin-top:10px;font-size:14px}.err{color:#d63a4a}.good{color:var(--ok)}
.row{display:flex;gap:10px;margin-top:16px}
.big{font-size:44px;text-align:center}.center{text-align:center}
.kv{padding:6px 0;border-bottom:1px dashed var(--line)}.kv b{display:inline-block;min-width:4.5em;color:var(--mute);font-weight:500}
.foot{text-align:center;color:var(--mute);font-size:12px;padding:20px}
.foot a{color:var(--mute)}
`;

function chips(list, cls = '') { return (list || []).map((x) => `<span class="chip ${cls}">${esc(x)}</span>`).join(''); }
function section(title, inner) { return inner ? `<div class="sec"><h2>${esc(title)}</h2>${inner}</div>` : ''; }

export function renderCard(p, { tz } = {}) {
  const av = isUrl(p.avatar) ? `<img src="${esc(p.avatar)}" alt="">` : esc(p.avatar || '🙂');
  const meta = [p.age ? `${esc(p.age)} 岁` : '', p.gender ? esc(p.gender) : '', p.city ? esc(p.city) : ''].filter(Boolean).join(' · ');
  const places = (p.favoritePlaces || []).map((x) => `<div class="place"><span>${PLACE_ICON[x.type] || '📍'}</span><div><b>${esc(x.name)}</b>${x.area ? ` <small>${esc(x.area)}</small>` : ''}${x.note ? `<br><small>${esc(x.note)}</small>` : ''}</div></div>`).join('');
  const client = { handle: p.handle, nickname: p.nickname, meetupTypes: p.meetupTypes || [], places: (p.favoritePlaces || []).map((x) => x.name), tz: tz || '' };
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(p.nickname)} · 搭子 Dazi</title><meta name="robots" content="noindex">
<meta property="og:title" content="${esc(p.nickname)}｜搭子 Dazi"><meta property="og:description" content="${esc(p.tagline || '想认识你，约个见面吧')}">
<style>${CSS}</style></head><body><div class="wrap">
<div class="hero"><span class="online">在线</span><div class="av">${av}</div><h1>${esc(p.nickname)}</h1>
<div class="sub">${meta}</div>${p.tagline ? `<div class="tag">${esc(p.tagline)}</div>` : ''}</div>
<div class="card">
${p.bio ? `<div class="sec"><p>${esc(p.bio).replace(/\n/g, '<br>')}</p></div>` : ''}
${section('爱好', chips(p.hobbies))}${section('最近在迷', chips(p.recentInterests, 'b'))}
${section('想认识什么样的人', p.lookingFor ? `<p>${esc(p.lookingFor)}</p>` : '')}
${section('我能提供', p.canOffer ? `<p>${esc(p.canOffer)}</p>` : '')}
${section('喜欢约在', places)}
${section('可以这样见', chips(p.meetupTypes))}
${(p.languages || []).length ? section('语言', chips(p.languages)) : ''}
</div>
<div class="foot">这是 ${esc(p.nickname)} 的个人 AI 搭子 · 你看不到 TA 的日历，只会看到 TA 愿意给的时间<br>你的 AI 也可以直接对接：<a href="/llms.txt">/llms.txt</a> · <a href="https://github.com/Maxthonzx/dazi">Dazi（开源）</a></div>
</div>
<div class="cta"><button class="b1" id="hiBtn">👋 打个招呼</button><button class="b2" id="meetBtn">☕ 约 TA 见面</button></div>

<dialog id="hiDlg"><form class="dlg" id="hiForm" autocomplete="off"><h3>👋 跟 ${esc(p.nickname)} 打个招呼</h3>
<label>你的称呼</label><input name="name" maxlength="40" required>
<label>一句话介绍自己</label><input name="intro" maxlength="200">
<label>联系方式（可选）</label><input name="contact" maxlength="100" placeholder="微信 / 邮箱 / IG…">
<label>想说的话</label><textarea name="message" maxlength="500"></textarea>
<input class="hp" name="website" tabindex="-1" autocomplete="off">
<div class="msg" id="hiMsg"></div>
<div class="row"><button type="button" class="b3" data-close>取消</button><button type="submit" class="b2">发送</button></div></form></dialog>

<dialog id="meetDlg"><form class="dlg" id="meetForm" autocomplete="off"><h3>☕ 约 ${esc(p.nickname)} 见面</h3>
<label>想怎么见</label><div class="opts" id="typeOpts"></div>
<label>时长</label><select name="durationMin" id="dur"><option value="30">30 分钟</option><option value="60" selected>1 小时</option><option value="90">1.5 小时</option><option value="120">2 小时</option></select>
<label>约在哪儿</label><div class="opts" id="placeOpts"></div>
<label>挑个 TA 方便的时间</label><div id="slots">加载中…</div>
<label>你的称呼</label><input name="name" maxlength="40" required>
<label>一句话介绍自己</label><input name="intro" maxlength="300">
<label>联系方式（必填，TA 同意后才会联系你）</label><input name="contact" maxlength="100" required placeholder="微信 / 手机 / 邮箱…">
<label>留言</label><textarea name="note" maxlength="500"></textarea>
<input class="hp" name="website" tabindex="-1" autocomplete="off">
<div class="msg" id="meetMsg"></div>
<div class="row"><button type="button" class="b3" data-close>取消</button><button type="submit" class="b2">发送邀约</button></div></form></dialog>
<script>
const C=${JSON_FOR_SCRIPT(client)};
const $=s=>document.querySelector(s);
const hiDlg=$('#hiDlg'),meetDlg=$('#meetDlg');
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#hiBtn').onclick=()=>hiDlg.showModal();
let type='',place='',slot=null;
function opts(box,items,get,set,extra){box.textContent='';const all=extra?items.concat(extra):items;all.forEach(t=>{const d=document.createElement('div');d.className='opt';d.textContent=t;d.onclick=()=>{box.querySelectorAll('.opt').forEach(x=>x.classList.remove('on'));if(get()===t){set('');}else{d.classList.add('on');set(t);}};box.appendChild(d);});}
opts($('#typeOpts'),C.meetupTypes,()=>type,v=>type=v);
opts($('#placeOpts'),C.places,()=>place,v=>place=v,['你来推荐']);
const dayFmt=(iso)=>{try{return new Date(iso).toLocaleString('zh-CN',{month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false})}catch(e){return ''}};
const myTz=Intl.DateTimeFormat().resolvedOptions().timeZone;
async function loadSlots(){const box=$('#slots');box.textContent='加载中…';slot=null;
 try{const r=await fetch('/api/slots?duration='+$('#dur').value);const j=await r.json();box.textContent='';
  if(!j.slots.length){box.textContent='TA 近期没有空闲时间，先打个招呼吧';return;}
  let cur='',wrap=null;
  j.slots.forEach(s=>{const i=s.label.indexOf(' ');const day=s.label.slice(0,i),time=s.label.slice(i+1);
   if(day!==cur){cur=day;const h=document.createElement('div');h.className='day';h.textContent=day;box.appendChild(h);wrap=document.createElement('div');wrap.className='opts';box.appendChild(wrap);}
   const d=document.createElement('div');d.className='opt';d.textContent=time;
   if(j.timezone&&myTz&&j.timezone!==myTz){d.title='你所在时区：'+dayFmt(s.start);d.textContent=time+'（你那儿 '+dayFmt(s.start)+'）';}
   d.onclick=()=>{box.querySelectorAll('.opt').forEach(x=>x.classList.remove('on'));d.classList.add('on');slot={start:s.start,end:s.end};};wrap.appendChild(d);});
 }catch(e){box.textContent='时间加载失败，请刷新重试';}}
$('#meetBtn').onclick=()=>{meetDlg.showModal();loadSlots();};
$('#dur').onchange=loadSlots;
async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {s:r.status,j:await r.json().catch(()=>({}))};}
function form(f){return Object.fromEntries(new FormData(f).entries());}
$('#hiForm').onsubmit=async e=>{e.preventDefault();const m=$('#hiMsg');m.className='msg';m.textContent='发送中…';
 const {j}=await post('/api/hi',form(e.target));if(j.ok){m.className='msg good';m.textContent='✅ 已送达！TA 看到后可能会回你～';e.target.reset();setTimeout(()=>hiDlg.close(),1800);}else{m.className='msg err';m.textContent=j.error||'发送失败';}};
$('#meetForm').onsubmit=async e=>{e.preventDefault();const m=$('#meetMsg');m.className='msg err';
 if(!slot){m.textContent='请先选一个时间';return;}
 const b=form(e.target);b.meetupType=type;b.place=place;b.slot=slot;b.title=(type||'见面')+' · '+C.nickname;b.durationMin=Number(b.durationMin);
 m.className='msg';m.textContent='发送中…';const {j}=await post('/api/meetup',b);
 if(j.ok){location.href=j.url;}else{m.className='msg err';m.textContent=j.error||'发送失败';if(j.freeSlots)loadSlots();}};
</script></body></html>`;
}

export function renderStatusPage(id, p) {
  const name = p?.nickname || 'TA';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>见面请求状态 · 搭子 Dazi</title><meta name="robots" content="noindex"><style>${CSS}body{padding:20px 0}.card{margin:14px}</style></head><body><div class="wrap">
<div class="card" id="app">加载中…</div>
<div class="foot">此页面链接是你的专属凭证，请勿分享 · <a href="/">回到 ${esc(name)} 的主页</a></div></div>
<script>
const id=${JSON_FOR_SCRIPT(id)};const t=new URLSearchParams(location.search).get('t')||'';
const app=document.getElementById('app');
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function render(r){app.textContent='';
 const nick=r.owner?r.owner.nickname:'TA';
 if(r.status==='pending'){app.append(el('div','big','⏳'),el('h3','center','等 '+nick+' 确认中'),el('p','center','时间：'+r.requestedLabels.join(' / ')+'。\\n本页会自动刷新，也可以稍后再回来看。'));}
 else if(r.status==='declined'){app.append(el('div','big','🍃'),el('h3','center',nick+' 这次先不约了'),el('p','center','谢谢你的邀请，也许下次～'));}
 else if(r.status==='counter'){app.append(el('div','big','🔁'),el('h3','center',nick+' 建议换个时间'),el('p','center',r.counterLabel+(r.counterPlace?' @'+r.counterPlace:'')));
  const row=el('div','row');const ok=el('button','b2','好，就这个时间');ok.onclick=async()=>{ok.disabled=true;const x=await fetch('/api/requests/'+id+'/confirm?t='+encodeURIComponent(t),{method:'POST'});const j=await x.json();if(j.ok)load();else{app.append(el('div','msg err',j.error||'确认失败'));}};row.append(ok);app.append(row);}
 else if(r.status==='accepted'){app.append(el('div','big','🎉'),el('h3','center',nick+' 接受了！'));
  [['时间',r.slotLabel],['地点',r.place||'见面前再商量']].forEach(([k,v])=>{const d=el('div','kv');d.append(el('b','',k),document.createTextNode(v));app.append(d);});
  const cs=Object.entries(r.contacts||{});if(cs.length){app.append(el('h2','','TA 的联系方式'));cs.forEach(([k,v])=>{const d=el('div','kv');d.append(el('b','',k),document.createTextNode(v));app.append(d);});}
  const row=el('div','row');const a=el('a','btn b2','📅 下载 .ics（iPhone/Mac）');a.href=r.addLinks.icsUrl;const g=el('a','btn b1','添加到 Google 日历');g.href=r.addLinks.google;g.target='_blank';g.rel='noopener';row.append(a,g);app.append(row);}
 else app.append(el('p','',r.status));}
async function load(){try{const x=await fetch('/api/requests/'+id+'?t='+encodeURIComponent(t));const j=await x.json();if(!j.ok){app.textContent='找不到这个请求（链接不完整？）';return false;}render(j.request);return j.request.status==='pending';}catch(e){app.textContent='网络出错，稍后刷新重试';return false;}}
(async function loop(){const again=await load();if(again)setTimeout(loop,15000);})();
</script></body></html>`;
}
