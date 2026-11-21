// 主人后台页面（本机 127.0.0.1 专用）。静态 HTML + 原生 JS，全部用 textContent 构建 DOM。
export function renderAdmin() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>约我 Hit Me Up · 后台</title><style>
:root{--pri:#ff5d73;--ink:#2b2230;--mute:#7b6f80;--line:#eee3e0}
*{box-sizing:border-box}body{margin:0;background:#fff7f2;color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
.w{max-width:860px;margin:0 auto;padding:16px}h1{font-size:22px;margin:4px 0}h3{margin:0 0 8px}
.card{background:#fff;border-radius:16px;padding:16px;margin:12px 0;box-shadow:0 2px 12px rgba(80,40,40,.06)}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.tab{padding:7px 14px;border-radius:99px;background:#fff;cursor:pointer;border:1px solid var(--line)}.tab.on{background:var(--pri);color:#fff;border-color:var(--pri)}
button,.btn{font:inherit;border:0;border-radius:10px;padding:8px 14px;cursor:pointer;background:#f1e9e7;color:var(--ink);text-decoration:none;display:inline-block;margin:2px}
.p{background:var(--pri);color:#fff}.d{background:#fff;border:1px solid #d9b;color:#a35}
input,textarea,select{font:inherit;width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:10px}textarea{min-height:70px}
label{display:block;font-size:13px;color:var(--mute);margin:10px 0 3px}
.m{color:var(--mute);font-size:13px}.ok{color:#22a06b}.er{color:#d63a4a}
.badge{display:inline-block;padding:1px 9px;border-radius:99px;font-size:12px;background:#eee}.badge.pending{background:#fff1c9}.badge.accepted{background:#d5f5e3}.badge.declined{background:#eee}.badge.counter{background:#dde9ff}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:600px){.g2{grid-template-columns:1fr}}
.slot{display:inline-block;border:1px solid var(--line);border-radius:10px;padding:5px 10px;margin:3px;cursor:pointer}.slot.on{border-color:var(--pri);background:#fff0ee}
pre{white-space:pre-wrap;background:#faf5f3;padding:8px;border-radius:8px;font-size:12px}
</style></head><body><div class="w"><h1>🤝 约我 Hit Me Up 后台 <span class="m">仅本机可见</span></h1>
<div class="card" id="top">加载中…</div><div class="tabs" id="tabs"></div><div id="view"></div></div>
<script>
const $=s=>document.querySelector(s);
function h(tag,attrs,...kids){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e[k]=v;else if(v!==undefined&&v!==null&&v!==false)e.setAttribute(k,v===true?'':v);}
 for(const c of kids.flat()){if(c===null||c===undefined||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)));}return e;}
async function api(path,method,body){const r=await fetch(path,{method:method||'GET',headers:{'content-type':'application/json','x-hitmeup-admin':'1'},body:body?JSON.stringify(body):undefined});return r.json();}
let S=null,tab='req',flash='';
const TABS=[['req','📬 请求'],['out','🚀 主动约'],['hi','👋 招呼'],['up','📅 日程'],['prof','🧑 资料'],['set','⚙️ 设置']];
const STATUS={pending:'待处理',accepted:'已接受',declined:'已婉拒',counter:'等对方确认',failed:'已失效'};
const badge=s=>h('span',{class:'badge '+s},STATUS[s]||s);
async function reload(){S=await api('/api/state');draw();}
function say(t,err){flash={t,err};draw();setTimeout(()=>{flash='';draw()},6000);}
function draw(){
 const top=$('#top');top.textContent='';
 const link=S.shareLink||S.publicUrl||S.localPublicUrl||'';
 top.append(h('div',{},S.online?h('span',{class:'ok'},'● 在线'):h('span',{class:'er'},'● 仅本机（隧道未启动）'),'  ',S.profile?S.profile.nickname+'（'+S.profile.handle+'）':''),
  h('div',{},'分享链接：',h('b',{},link||'—'),' ',link?h('button',{onclick:()=>{navigator.clipboard.writeText(link);say('已复制')}},'复制'):null),
  S.calendarError?h('div',{class:'er'},'日历读取出错：'+S.calendarError):null,
  flash?h('div',{class:flash.err?'er':'ok'},flash.t):null);
 const tabs=$('#tabs');tabs.textContent='';
 const pend=S.requests.filter(r=>r.direction==='in'&&r.status==='pending').length;
 TABS.forEach(([k,t])=>tabs.append(h('div',{class:'tab'+(tab===k?' on':''),onclick:()=>{tab=k;draw()}},t+(k==='req'&&pend?' ('+pend+')':''))));
 const v=$('#view');v.textContent='';v.append(({req:vReq,out:vOut,hi:vHi,up:vUp,prof:vProf,set:vSet})[tab]());
}
async function act(path,body,okMsg){const r=await api(path,'POST',body||{});if(r.ok){say(okMsg||'完成');}else{say(r.error||'失败',true);}await reload();}
function vReq(){
 const list=S.requests.filter(r=>r.direction==='in');
 if(!list.length)return h('div',{class:'card m'},'还没有人约你。把分享链接发出去吧～');
 return h('div',{},list.map(r=>{
  let sel=0;const box=h('div',{class:'card'});
  const slots=h('div',{},r.slotLabels.map((l,i)=>h('span',{class:'slot'+(i===0?' on':''),onclick:e=>{sel=i;slots.querySelectorAll('.slot').forEach(x=>x.classList.remove('on'));e.target.classList.add('on')}},l)));
  box.append(h('h3',{},r.from.name,' ',badge(r.status),' ',h('span',{class:'m'},new Date(r.createdAt).toLocaleString())),
   h('div',{},r.meeting.meetupType||'见面','（',r.meeting.durationMin,' 分钟）',r.meeting.place?' @ '+r.meeting.place:''),
   r.from.intro?h('div',{class:'m'},'介绍：'+r.from.intro):null,h('div',{class:'m'},'联系方式：'+(r.from.contact||r.from.agentUrl||'—')+(r.source==='a2a'?'（来自 AI 代理）':'')),
   r.meeting.note?h('div',{class:'m'},'留言：'+r.meeting.note):null);
  if(r.status==='pending'){
   box.append(h('div',{},'TA 选的时间：'),slots);
   const place=h('input',{placeholder:'确认地点（可留空，沿用对方选的）',value:r.meeting.place||''});
   const alt=h('div',{});
   box.append(place,h('div',{},
    h('button',{class:'p',onclick:()=>act('/api/requests/'+r.id+'/accept',{slotIndex:sel,place:place.value},'已接受，联系方式已放行')},'接受'),
    h('button',{onclick:async()=>{alt.textContent='加载中…';const x=await api('/api/requests/'+r.id+'/slots');alt.textContent='';alt.append(h('div',{class:'m'},'选一个你方便的时间：'),x.slots.map(s=>h('span',{class:'slot',onclick:()=>act('/api/requests/'+r.id+'/counter',{slot:{start:s.start,end:s.end},place:place.value},'已发出新时间')},s.label)));}},'换个时间'),
    h('button',{class:'d',onclick:()=>confirm('婉拒这个邀约？')&&act('/api/requests/'+r.id+'/decline',{},'已婉拒')},'婉拒')),alt);
  }
  if(r.status==='counter')box.append(h('div',{class:'m'},'已建议：'+r.counterLabel+'，等对方确认'));
  if(r.status==='accepted')box.append(meetLinks(r));
  return box;}));
}
function meetLinks(r){return h('div',{},h('b',{},'✅ '+r.label+(r.result&&r.result.place?' @ '+r.result.place:'')),' ',
  r.written?h('span',{class:'ok'},'已写入你的日历'):h('span',{class:'m'},'未自动写入日历：'),
  r.written?null:[h('a',{class:'btn',href:r.addLinks.google,target:'_blank',rel:'noopener'},'添加到 Google 日历'),h('a',{class:'btn',href:r.addLinks.icsUrl},'下载 .ics')],
  r.calendarError?h('div',{class:'er'},'写日历失败：'+r.calendarError):null);}
function vOut(){
 const f=h('form',{},h('label',{},'对方（handle 或链接）'),h('input',{name:'target',required:true,placeholder:'例如 lily 或 https://xxx.trycloudflare.com'}),
  h('div',{class:'g2'},h('div',{},h('label',{},'事由'),h('input',{name:'title',value:'喝咖啡'})),h('div',{},h('label',{},'类型'),h('input',{name:'meetupType',value:'喝咖啡'}))),
  h('div',{class:'g2'},h('div',{},h('label',{},'时长（分钟）'),h('input',{name:'durationMin',type:'number',value:S.config.availability.defaultDurationMin||60})),h('div',{},h('label',{},'地点（可选）'),h('input',{name:'place'}))),
  h('label',{},'留言'),h('textarea',{name:'note'}),h('div',{},h('button',{class:'p',type:'submit'},'发出邀约')));
 const res=h('div',{});
 f.onsubmit=async e=>{e.preventDefault();res.textContent='正在联系对方…';const b=Object.fromEntries(new FormData(f).entries());const r=await api('/api/outbound','POST',b);
  if(!r.ok){res.textContent='';res.append(h('div',{class:'er'},r.error||'失败'));return;}
  res.textContent='';const p=r.profile;res.append(h('div',{class:'card'},h('h3',{},'已发出 → '+(p?p.nickname:'对方')),p?h('div',{class:'m'},[p.tagline,p.city,(p.hobbies||[]).join('、')].filter(Boolean).join(' · ')):null,h('div',{},'状态：',badge(r.request.status),r.request.note?' '+r.request.note:'')));await reload();};
 const mine=S.requests.filter(r=>r.direction==='out');
 return h('div',{},h('div',{class:'card'},h('h3',{},'主动约 TA'),f,res),
  mine.length?h('div',{class:'card'},h('h3',{},'我发出的'),mine.map(r=>h('div',{style:'padding:8px 0;border-top:1px solid #eee'},h('b',{},(r.peer&&r.peer.name)||r.from.name),' ',badge(r.status),' ',h('span',{class:'m'},r.meeting.title),
   r.status==='accepted'?[h('div',{},'时间：'+r.label+(r.result.place?' @ '+r.result.place:'')),r.result.contacts&&Object.keys(r.result.contacts).length?h('div',{},'联系方式：'+Object.entries(r.result.contacts).map(([k,v])=>k+':'+v).join('  ')):null,meetLinks(r)]:null,
   r.status==='counter'?h('div',{},'对方建议 '+r.counterLabel+' ',h('button',{class:'p',onclick:()=>act('/api/outbound/'+r.id+'/confirm',{},'已确认')},'确认')):null,
   r.status==='pending'?h('div',{class:'m'},'等待对方确认（每分钟自动查询）'):null))):null);
}
function vHi(){if(!S.inbox.length)return h('div',{class:'card m'},'还没有人打招呼');return h('div',{},S.inbox.map(i=>h('div',{class:'card'},h('b',{},i.name),' ',h('span',{class:'m'},new Date(i.at).toLocaleString(),i.source==='a2a'?' · AI 代理':''),i.intro?h('div',{class:'m'},i.intro):null,h('div',{},i.message),i.contact?h('div',{class:'m'},'联系方式：'+i.contact):null)));}
function vUp(){const now=Date.now();const l=S.requests.filter(r=>r.status==='accepted'&&r.slot&&Date.parse(r.slot.end)>now).sort((a,b)=>Date.parse(a.slot.start)-Date.parse(b.slot.start));
 if(!l.length)return h('div',{class:'card m'},'近期没有已确定的见面');return h('div',{},l.map(r=>h('div',{class:'card'},h('div',{},(r.direction==='in'?'来自 ':'约 ')+(r.direction==='in'?r.from.name:(r.peer&&r.peer.name))),meetLinks(r))));}
const PT=['cafe','restaurant','bar','park','gym','online','other'],CK=[['wechat','微信'],['phone','手机'],['email','邮箱'],['instagram','Instagram'],['xiaohongshu','小红书'],['telegram','Telegram'],['other','其他']];
function vProf(){const p=S.profile||{};const f=h('form',{});
 const t=(n,l,v,ph)=>h('div',{},h('label',{},l),h('input',{name:n,value:v===undefined?'':v,placeholder:ph||''}));
 const ta=(n,l,v)=>h('div',{},h('label',{},l),h('textarea',{name:n},v||''));
 const arr=a=>(a||[]).join('，');
 const places=(p.favoritePlaces||[]).map(x=>[x.name,x.type,x.area,x.note].join('|')).join('\\n');
 f.append(h('div',{class:'g2'},t('handle','handle（链接里的名字）',p.handle),t('nickname','昵称',p.nickname),t('avatar','头像（emoji 或图片链接）',p.avatar),t('city','城市',p.city),t('age','年龄',p.age),t('gender','性别（可选）',p.gender)),
  t('tagline','一句话签名',p.tagline),ta('bio','自我介绍',p.bio),t('hobbies','爱好（逗号分隔）',arr(p.hobbies)),t('recentInterests','最近在迷（逗号分隔）',arr(p.recentInterests)),
  ta('lookingFor','想认识什么样的人',p.lookingFor),ta('canOffer','我能提供什么',p.canOffer),
  h('label',{},'喜欢约在（每行：名称|类型 cafe/restaurant/bar/park/gym/online/other|区域|备注）'),h('textarea',{name:'places'},places),
  t('meetupTypes','想怎么见（逗号分隔）',arr(p.meetupTypes)),t('languages','语言（逗号分隔）',arr(p.languages)),
  h('label',{},'联系方式（绝不公开，接受后才给对方；勾选要给的）'),
  CK.map(([k,l])=>h('div',{class:'g2'},t('c_'+k,l,(p.contacts||{})[k]),h('label',{style:'margin-top:26px'},h('input',{type:'checkbox',style:'width:auto',name:'s_'+k,checked:(p.contactsToShare||[]).includes(k)}),' 接受后分享'))),
  h('label',{},h('input',{type:'checkbox',style:'width:auto',name:'listed',checked:!!p.listed}),' 在目录页公开展示我（可被陌生人发现）'),
  h('div',{},h('button',{class:'p',type:'submit'},'保存')));
 f.onsubmit=async e=>{e.preventDefault();const fd=new FormData(f);const g=n=>fd.get(n)||'';
  const places=g('places').split('\\n').map(l=>l.trim()).filter(Boolean).map(l=>{const[x,y,z,w]=l.split('|').map(s=>(s||'').trim());return{name:x,type:PT.includes(y)?y:'other',area:z,note:w};});
  const contacts={},share=[];CK.forEach(([k])=>{if(g('c_'+k))contacts[k]=g('c_'+k);if(fd.get('s_'+k))share.push(k);});
  const body={handle:g('handle'),nickname:g('nickname'),avatar:g('avatar'),city:g('city'),age:g('age'),gender:g('gender'),tagline:g('tagline'),bio:g('bio'),hobbies:g('hobbies'),recentInterests:g('recentInterests'),lookingFor:g('lookingFor'),canOffer:g('canOffer'),favoritePlaces:places,meetupTypes:g('meetupTypes'),languages:g('languages'),contacts,contactsToShare:share,listed:!!fd.get('listed')};
  const r=await api('/api/profile','PUT',body);say(r.ok?'已保存（目录卡片会在下次登记时更新）':r.error,!r.ok);if(r.ok)await reload();};
 return h('div',{class:'card'},f);}
function vSet(){const c=S.config;
 const mk=(l,v,rows)=>{const ta=h('textarea',{style:'min-height:'+rows+'px;font-family:monospace;font-size:12px'},JSON.stringify(v,null,2));return[h('label',{},l),ta,ta];};
 const [,a1,A]=mk('可约时间（weekly / bufferMin / minNoticeHours / maxMeetupsPerDay / horizonDays / defaultDurationMin）',c.availability,220);
 const [,c1,C]=mk('日历 calendar：{"type":"none|ics|icloud|feishu", ...}',c.calendar,90);
 const [,n1,N]=mk('通知 notify：{"bark":{"key":"…"},"webhook":{"url":"…","kind":"feishu|generic"}}',c.notify,90);
 const tz=h('input',{value:c.timezone});const out=h('div',{});
 return h('div',{class:'card'},h('h3',{},'设置'),h('label',{},'时区（IANA，如 Asia/Shanghai / America/New_York）'),tz,
  h('label',{},'可约时间'),A,h('label',{},'日历 calendar：{"type":"none|ics|icloud|feishu", ...}'),C,h('label',{},'通知 notify：{"bark":{"key":"…"},"webhook":{"url":"…","kind":"feishu|generic"}}'),N,
  h('div',{},h('button',{class:'p',onclick:async()=>{try{const r=await api('/api/config','PUT',{timezone:tz.value,availability:JSON.parse(A.value),calendar:JSON.parse(C.value),notify:JSON.parse(N.value)});say(r.ok?'已保存':r.error,!r.ok);await reload();}catch(e){say('JSON 格式有误：'+e.message,true);}}},'保存'),
   h('button',{onclick:async()=>{out.textContent='检测中…';const r=await api('/api/calendar-check');out.textContent=r.ok?r.message:'❌ '+r.error;out.className=r.ok?'ok':'er';}},'检测日历连接'),
   h('button',{onclick:async()=>{const r=await api('/api/notify-test','POST',{});out.textContent='通知结果：'+JSON.stringify(r.results||r.error);out.className='m';}},'发送测试通知')),out,
  h('p',{class:'m'},'目录：'+S.directory+'　·　本机公开端口：'+(S.localPublicUrl||'')));}
reload();setInterval(()=>{if(document.activeElement&&['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;reload();},20000);
</script></body></html>`;
}
