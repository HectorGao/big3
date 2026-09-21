(function(){
 const key='three-lift-v1';let user=null,revision=0,base='',status='仅本机',pending=false,busy=null,timer,conflict=false,enabled=true,connected=false;
 let debugToken=sessionStorage.getItem('big3-debug-token')||'',debugContext=null,switching=false;
 const clearDebug=()=>{debugToken='';debugContext=null;sessionStorage.removeItem('big3-debug-token');};
 const namespace=()=>user?'-account-'+user.id:'';
 const rawKey=()=>key+namespace(),metaKey=()=>rawKey()+'-sync';
 const emit=()=>window.dispatchEvent(new CustomEvent('sync-status',{detail:{user,status,conflict}}));
 async function api(route,method='GET',body){const r=await fetch('/api/'+route,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{}),...(user?{'X-Big3-Account':user.id}:{}),...(debugToken?{'X-Big3-Debug':debugToken}:{})},signal:AbortSignal.timeout(15000),body:body?JSON.stringify(body):undefined});let d;try{d=await r.json();}catch{throw Error('当前无法连接在线账号服务，登录、跨设备同步和留言板暂不可用。你可以继续使用本机训练功能，已有记录仍保存在当前浏览器。');}if(!r.ok){const e=Error(d.error||'请求失败');e.status=r.status;throw e;}return d;}
 function remember(){localStorage.setItem(metaKey(),JSON.stringify({revision,base}));}
 const current=()=>localStorage.getItem(rawKey())||JSON.stringify(MuscleStore.empty());
 async function flush(allowConnecting=false){
  clearTimeout(timer);if(!user||!enabled||conflict)return;if(!connected&&!allowConnecting)throw Error('账号尚未连接，请刷新重试；本机数据未改变');if(busy){await busy;if(pending)return flush(allowConnecting);return;}
  pending=false;const snapshot=current();if(snapshot===base){status='已同步';emit();return;}
  status='正在同步';emit();
  busy=(async()=>{try{const result=await api('state','PUT',{revision,data:JSON.parse(snapshot)});revision=result.revision;base=snapshot;remember();status='已同步';}
   catch(e){pending=true;if(e.status===409){conflict=true;status='同步冲突，记录已保留';}else status=e.status===401?'登录已过期，记录保留在本机':'未同步，已保存在此设备';throw e;}
   finally{busy=null;emit();}})();
  await busy;if(current()!==base)return flush(allowConnecting);
 }
 function changed(){if(!user||!enabled)return;pending=true;status='待同步';emit();clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),600);}
 async function connect(next){
  connected=false;user=next;conflict=false;pending=false;revision=0;base='';const meta=JSON.parse(localStorage.getItem(metaKey())||'null');if(meta){revision=meta.revision;base=meta.base;}
  let remote;try{remote=await api('state');}catch(e){status='账号连接失败，请刷新重试；原数据已保留';emit();throw e;}const local=localStorage.getItem(rawKey());
  if(local&&meta&&local!==base){if(remote.revision!==revision){conflict=true;connected=true;status='同步冲突，记录已保留';emit();return;}await flush(true);}
  else{revision=remote.revision;base=JSON.stringify(MuscleStore.validate(remote.data));localStorage.setItem(rawKey(),base);remember();status='已同步';}
  connected=true;emit();
 }
 async function refresh(){if(!user||!connected||busy||conflict)return;if(current()!==base){await flush();return;}const remote=await api('state');if(remote.revision!==revision){revision=remote.revision;base=JSON.stringify(MuscleStore.validate(remote.data));localStorage.setItem(rawKey(),base);remember();window.dispatchEvent(new Event('sync-data'));}status='已同步';emit();}
 const sync={api,get debug(){return debugContext;},get user(){return connected?user:null;},get status(){return status;},get conflict(){return conflict;},flush,refresh,
  driver(qa){if(qa!==null){enabled=false;return {getStorageSync:k=>localStorage.getItem(k+'-qa-'+qa),setStorageSync:(k,v)=>localStorage.setItem(k+'-qa-'+qa,v)};}return {getStorageSync:k=>localStorage.getItem(k+namespace()),setStorageSync:(k,v)=>{if(switching||user&&!connected)throw Error('账号正在连接，请稍后再保存');localStorage.setItem(k+namespace(),v);if(k===key)changed();}};},
  async init(){if(!enabled)return;try{let result;try{result=await api('auth/me');}catch(e){if(debugToken&&(e.status===403||e.status===401)){clearDebug();result=await api('auth/me');}else throw e;}this.setupRequired=result.setupRequired;debugContext=result.debug||null;if(result.user)await connect(result.user);emit();window.dispatchEvent(new Event('sync-data'));}catch{status='账号服务未连接 · 本地可用';emit();}},
  async startDebug(id){if(switching)throw Error('正在切换账号，请稍候');switching=true;try{await flush();if(conflict||pending)throw Error('请先完成同步或处理冲突，再切换账号');const r=await api('admin/debug','POST',{userId:id});debugToken=r.token;debugContext=r.debug;sessionStorage.setItem('big3-debug-token',debugToken);await connect(r.user);window.dispatchEvent(new Event('sync-data'));}finally{switching=false;}},
  async stopDebug(){if(switching)throw Error('正在切换账号，请稍候');switching=true;try{let expired=false;try{await flush();}catch(e){if(e.status!==403)throw e;expired=true;}if(!expired&&(conflict||pending))throw Error('请先同步调试数据或处理冲突');const r=await api('admin/debug/stop','POST',{});clearDebug();await connect(r.user);window.dispatchEvent(new Event('sync-data'));return {retainedLocally:expired};}finally{switching=false;}},
  async login(kind,values){const result=await api('auth/'+kind,'POST',values);await connect(result.user);window.dispatchEvent(new Event('sync-data'));},
  async logout(){let expired=false;try{await flush();}catch(e){if(e.status!==401)throw e;expired=true;}if(!expired&&(conflict||pending))throw Error('请先处理同步冲突或等待联网，数据仍保留在本机');if(!expired){try{await api('auth/logout','POST',{});}catch(e){if(e.status!==401)throw e;}}pending=false;conflict=false;clearDebug();user=null;revision=0;base='';status='仅本机';connected=false;emit();window.dispatchEvent(new Event('sync-data'));},
  async resolve(useLocal){if(!user)return;const remote=await api('state');localStorage.setItem(rawKey()+'-conflict-backup',current());revision=remote.revision;base=JSON.stringify(MuscleStore.validate(remote.data));conflict=false;if(useLocal){remember();await flush();}else{localStorage.setItem(rawKey(),base);remember();status='已同步';emit();window.dispatchEvent(new Event('sync-data'));}},
  importGuest(){if(!user)throw Error('请先登录');const raw=localStorage.getItem(key);if(!raw)throw Error('没有本地访客档案');const d=MuscleStore.validate(JSON.parse(raw));localStorage.setItem(rawKey()+'-import-backup',current());localStorage.setItem(rawKey(),JSON.stringify(d));changed();window.dispatchEvent(new Event('sync-data'));},
  async consent(value){const r=await api('account','PATCH',{consent:value});user=r.user;emit();}
 };
 window.addEventListener('online',()=>refresh().catch(()=>{}));window.addEventListener('beforeunload',e=>{if(user&&(pending||busy||conflict)){e.preventDefault();e.returnValue='';}});
 setInterval(()=>{if(!document.hidden&&enabled)refresh().catch(()=>{status='离线，数据保留在本机';emit();});},20000);
 globalThis.MuscleSync=sync;
})();
