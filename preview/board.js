let ribbonMessages=[],ribbonPaused=false,ribbonSignature='';
const echoTopics={training:{name:'训练日常',icon:'dumbbell',emoji:'💪'},idea:{name:'改进建议',icon:'lightbulb',emoji:'💡'},question:{name:'一起讨论',icon:'messages-square',emoji:'💬'}};
const echoStyles={ribbon:{name:'轻盈横滑',icon:'gallery-horizontal-end'},diagonal:{name:'斜向弹幕',icon:'move-up-right'},vertical:{name:'双列上浮',icon:'gallery-vertical-end'},quiet:{name:'静态精选',icon:'pause'}};
let echoSite={revision:0,config:{...MuscleEchoSettings.defaults},updatedAt:null},echoPersonalStyle=null,echoStyle='ribbon';
try{const saved=localStorage.getItem('big3-echo-style-v1');if(echoStyles[saved])echoPersonalStyle=saved;}catch{}
function applyEchoSettings(snapshot){if(!snapshot)return;const config=MuscleEchoSettings.validate(snapshot.config);echoSite={revision:snapshot.revision,config,updatedAt:snapshot.updatedAt};echoStyle=config.allowPersonalStyle&&echoPersonalStyle?echoPersonalStyle:config.topStyle;}
const echoEmojis=['💪','🔥','👏','🏋️','🎯','🏆','✨','🙌','😄','🤝','✅','❤️'];
function echoEmojiPicker(){return `<div class="echo-emoji-tools">${echoEmojis.slice(0,3).map(e=>button(e,'emoji','emoji-button',`type="button" data-emoji="${e}" aria-label="添加 ${e}"`)).join('')}<details class="echo-emoji-more"><summary aria-label="更多表情" title="更多表情">${icon('smile-plus')}</summary><div class="echo-emoji-grid">${echoEmojis.map(e=>button(e,'emoji','emoji-button',`type="button" data-emoji="${e}" aria-label="添加 ${e}"`)).join('')}</div></details></div>`;}
function echoStyleDialog(){const allowed=echoSite.config.allowPersonalStyle;showDialog(`<div class="dialog-heading"><h2>回声风格</h2>${button(icon('x'),'close','icon-button','aria-label="关闭"')}</div><label class="echo-follow"><input type="radio" name="echo-style" value="site" ${!echoPersonalStyle||!allowed?'checked':''}>跟随全站 · ${echoStyles[echoSite.config.topStyle].name}</label>${allowed?'':'<p class="muted">当前使用全站统一样式，仍可暂停动态。</p>'}<fieldset class="echo-style-options" ${allowed?'':'disabled'}><legend class="sr-only">选择回声展示风格</legend>${Object.entries(echoStyles).map(([id,s])=>`<label class="echo-style-option"><input type="radio" name="echo-style" value="${id}" ${allowed&&id===echoPersonalStyle?'checked':''}><span class="echo-style-sample sample-${id}" aria-hidden="true"><span>💪<i></i></span><span>🔥<i></i></span><span>💡<i></i></span></span><span class="echo-style-name">${icon(s.icon)}${s.name}${icon('circle-check')}</span></label>`).join('')}</fieldset>${MuscleSync.user?.role==='admin'||MuscleSync.debug?button(icon('settings-2')+'全站回声设置','admin-echo','outline'):''}`);dialog.classList.add('echo-style-dialog');}
function echoTopic(m){return echoTopics[m.topic]?m.topic:'training';}
function echoAvatar(name){return `<span class="echo-avatar" aria-hidden="true">${esc(String(name).slice(0,2).toUpperCase())}</span>`;}
function echoCard(m,compact=false,duplicate=false){
 const topic=echoTopic(m),t=echoTopics[topic],date=new Date(m.created),time=Number.isNaN(date.getTime())?'':date.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'});
 if(compact)return `<button class="echo-card echo-${topic}" data-action="community" ${duplicate?'tabindex="-1"':''}><span class="echo-mini-author">${echoAvatar(m.username)}<b>${esc(m.username)}</b>${m.demo?'<small>模拟</small>':''}<span class="echo-topic"><span aria-hidden="true">${t.emoji}</span>${t.name}</span></span><span class="echo-excerpt">${esc(m.body)}</span></button>`;
 const admin=MuscleSync.user?.role==='admin'||MuscleSync.debug,owner=m.userId===MuscleSync.user?.id;
 return `<article class="message echo-post echo-${topic} ${m.hidden?'is-hidden':''}"><header>${echoAvatar(m.username)}<div><strong>${esc(m.username)}</strong><small>${m.demo?'模拟账号 · ':''}${esc(time)}</small></div><span class="echo-topic"><span aria-hidden="true">${t.emoji}</span>${t.name}</span></header><p>${esc(m.body)}</p><footer>${m.hidden?'<span class="echo-hidden">已隐藏</span>':''}${admin?button(icon(m.hidden?'eye':'eye-off')+(m.hidden?'恢复显示':'隐藏'),'visibility-message','link',`data-id="${m.id}" data-hidden="${!m.hidden}"`):''}${owner||admin?button(icon('trash-2'),'delete-message','icon-button',`data-id="${m.id}" aria-label="删除留言" title="删除这条内容"`):''}</footer></article>`;
}
function renderEchoWall(target,items,config){
 target.setAttribute('data-echo-wall','');target.dataset.wallStyle=config.backgroundStyle;target.dataset.wallMotion=config.backgroundMotion;
 target.style.setProperty('--wall-color',config.backgroundColor);target.style.setProperty('--wall-opacity',config.backgroundOpacity);target.style.setProperty('--wall-angle',config.backgroundAngle+'deg');target.style.setProperty('--wall-blur',config.backgroundBlur+'px');
 const rgb=config.backgroundColor.slice(1).match(/../g).map(s=>parseInt(s,16)).join(',');target.style.setProperty('--wall-rgb',rgb);
 if(!items.length||config.backgroundStyle==='off'){target.replaceChildren();return;}
 const vertical=config.backgroundMotion==='columns';
 const groups=Array.from({length:Math.min(3,items.length)},(_,i)=>items.filter((_,n)=>n%Math.min(3,items.length)===i));
 target.innerHTML=groups.map((items,i)=>{const notes=items.map(m=>`<div class="echo-bg-note"><span><b>${echoTopics[echoTopic(m)].emoji}</b><strong>${esc(m.username)}</strong></span><p>${esc(m.body)}</p></div>`).join(''),group=`<div class="echo-bg-group">${notes}</div>`;return `<div class="echo-wall-lane ${i%2?'reverse':''}"><div class="echo-bg-track" data-axis="${vertical?'y':'x'}" data-speed="${config.backgroundSpeed}">${group}${group}</div></div>`;}).join('');
 target.setAttribute('aria-hidden','true');
}
function measureEchoMotion(){
 document.querySelectorAll('.echo-track,.echo-vertical-track,.echo-bg-track').forEach(track=>{
  const group=track.firstElementChild;if(!group)return;const vertical=track.classList.contains('echo-vertical-track')||track.dataset.axis==='y',gap=parseFloat(getComputedStyle(track).gap)||0,distance=(vertical?group.offsetHeight:group.offsetWidth)+gap,speed=track.classList.contains('echo-bg-track')?Number(track.dataset.speed):echoSite.config.topSpeed;
  track.style.setProperty('--echo-distance',distance+'px');track.style.setProperty('--echo-duration',Math.max(1,distance/(speed||1))+'s');track.style.setProperty('--echo-play-state',speed===0?'paused':'running');
 });
}
function renderRibbon(){
 const host=document.querySelector('#message-ribbon'),background=document.querySelector('#message-background');if(!host)return;
 applyEchoSettings(echoSite);const latest=ribbonMessages.slice(-8).reverse();document.body.dataset.echoStyle=echoStyle;
 const group=(items,duplicate=false)=>`<div class="echo-group" ${duplicate?'aria-hidden="true"':''}>${items.map(m=>echoCard(m,true,duplicate)).join('')}</div>`;
 const cards=echoStyle==='vertical'?`<div class="echo-columns ${latest.length===1?'single':''}">${(latest.length===1?[0]:[0,1]).map(i=>{const items=latest.filter((_,n)=>n%2===i);return `<div class="echo-vertical-window"><div class="echo-vertical-track">${group(items)}${group(items,true)}</div></div>`;}).join('')}</div>`:`<div class="echo-track">${group(latest)}${echoStyle==='quiet'?'':group(latest,true)}</div>`;
 host.innerHTML=`<div class="echo-band-heading"><div>${icon('messages-square')}<h2 id="echo-title">训练回声</h2><span>${ribbonMessages.length} 条交流</span></div><div>${button(icon('sliders-horizontal')+'风格','echo-style','outline',`aria-label="选择回声风格，当前${echoStyles[echoStyle].name}"`)}${button(icon(ribbonPaused?'play':'pause'),'ribbon-pause','icon-button',`aria-label="${ribbonPaused?'继续':'暂停'}动态" title="${ribbonPaused?'继续':'暂停'}动态" aria-pressed="${ribbonPaused}" ${echoStyle==='quiet'?'disabled':''}`)}${button(icon('square-pen')+'写点想法','community','outline')}</div></div><div class="echo-window">${latest.length?cards:`<div class="echo-empty">${icon('message-circle')}<span>第一条回声，等你来写。</span></div>`}</div>`;
 if(background)renderEchoWall(background,ribbonMessages.slice(-12).reverse(),echoSite.config);
 document.body.classList.toggle('motion-paused',ribbonPaused);globalThis.lucide?.createIcons();requestAnimationFrame(measureEchoMotion);
}
async function refreshRibbon(){try{const result=await MuscleSync.api('board'),signature=JSON.stringify([result.messages,result.settings]);if(signature===ribbonSignature)return;ribbonSignature=signature;ribbonMessages=result.messages;applyEchoSettings(result.settings);renderRibbon();}catch{if(!document.querySelector('.echo-band-heading'))renderRibbon();}}
document.addEventListener('click',event=>{if(event.target.closest('[data-action="echo-style"]'))echoStyleDialog();const t=event.target.closest('[data-action="ribbon-pause"]');if(t){ribbonPaused=!ribbonPaused;document.body.classList.toggle('motion-paused',ribbonPaused);t.innerHTML=icon(ribbonPaused?'play':'pause');t.setAttribute('aria-label',(ribbonPaused?'继续':'暂停')+'动态');t.setAttribute('aria-pressed',String(ribbonPaused));t.title=(ribbonPaused?'继续':'暂停')+'动态';globalThis.lucide?.createIcons();}});
document.addEventListener('input',event=>{if(event.target.id==='message-body'){const count=document.querySelector('#echo-count');if(count)count.textContent=event.target.value.length+' / 280';}});
document.addEventListener('close',()=>dialog.classList.remove('echo-dialog','echo-style-dialog'),true);
document.addEventListener('change',event=>{if(event.target.name!=='echo-style'||(!echoStyles[event.target.value]&&event.target.value!=='site'))return;if(!echoSite.config.allowPersonalStyle&&event.target.value!=='site')return;echoPersonalStyle=event.target.value==='site'?null:event.target.value;try{if(echoPersonalStyle)localStorage.setItem('big3-echo-style-v1',echoPersonalStyle);else localStorage.removeItem('big3-echo-style-v1');}catch{toast('本次风格已应用，但浏览器未允许保存偏好');}renderRibbon();});
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('echo-page-hidden',document.hidden));
// Reflect the pointer in the material, without moving the card or its hit target.
let echoGlassFrame=0,echoGlassTarget=null,echoGlassPoint=null;
document.addEventListener('pointermove',event=>{
 if(event.pointerType==='touch'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const card=event.target.closest('#message-ribbon .echo-card');
 if(echoGlassTarget&&echoGlassTarget!==card)echoGlassTarget.style.removeProperty('--glass-angle');
 echoGlassTarget=card;if(!card)return;echoGlassPoint={x:event.clientX,y:event.clientY};
 if(echoGlassFrame)return;
 echoGlassFrame=requestAnimationFrame(()=>{echoGlassFrame=0;if(!echoGlassTarget?.isConnected)return;const box=echoGlassTarget.getBoundingClientRect(),x=(echoGlassPoint.x-box.left)/box.width,y=(echoGlassPoint.y-box.top)/box.height;echoGlassTarget.style.setProperty('--glass-angle',Math.round(110+x*45+y*15)+'deg');});
});
document.addEventListener('DOMContentLoaded',()=>{refreshRibbon();new ResizeObserver(measureEchoMotion).observe(document.querySelector('#message-ribbon'));setInterval(()=>{if(!document.hidden)refreshRibbon();},30000);});
