const equipmentClass=name=>({'杠铃':'barbell','哑铃':'dumbbell','自重':'bodyweight','器械':'machine','绳索':'cable'}[name]||'');
const equipmentBadge=name=>`<span class="equipment-badge ${equipmentClass(name)}">${esc(name)}</span>`;
let pickerState=null,addedExercises=[];
const exerciseFolds=new Map();
function foldKey(id,session=false){return JSON.stringify([MuscleSync.user?.id||'guest',session?'actual':'plan',data.session?.id||selectedDate,lift,session?data.session.mode:freeMode,id]);}
function compactDose(e,rows){
 const values=rows||[e],known=values.filter(r=>r.weight!==null&&r.weight!==undefined&&r.weight!==''&&!r.calibrationRequired),weights=[...new Set(known.map(r=>Number(r.weight)))].sort((a,b)=>a-b),reps=[...new Set(values.filter(r=>r.reps!==''&&r.reps!==null&&Number.isFinite(Number(r.reps))&&Number(r.reps)>0).map(r=>Number(r.reps)))].sort((a,b)=>a-b);
 const range=ns=>ns.length<2?ns[0]:ns[0]+'–'+ns.at(-1);
 const convention=e.loadConvention||C.byId(e.id||e.exercise)?.loadConvention;
 const unit={'barbell-total':'kg 总重','per-hand':'kg / 只','single-implement':'kg 单只','machine-stack':'kg 标重',assistance:'kg 助力'}[convention]||e.weightUnit||'kg';
 const weight=!known.length?'待试重':convention==='bodyweight'&&weights.every(w=>w===0)?'自重':range(weights)+' '+unit;
 return `<span class="fold-load">${esc(weight)}${known.length&&known.length<values.length?' · 含待定组':''}</span><span>${rows?rows.length:e.sets} 组 × ${reps.length?esc(range(reps)):'待填写'} ${esc(e.unit)}</span>${rows?`<small>${rows.filter(r=>r.done).length} / ${rows.length} 组完成${rows.some(r=>r.skipped)?' · '+rows.filter(r=>r.skipped).length+' 组已放弃':''}</small>`:''}`;
}
function setExerciseFold(row,closed,animate=false){
 const before=row.getBoundingClientRect().height;
 row.getAnimations().forEach(a=>a.finish());
 const id=row.dataset.foldExercise,active=row.dataset.foldActual==='true',e=active?C.byId(id):currentPlan?.exercises.find(e=>e.id===id);if(e)row.querySelector('.fold-dose').innerHTML=compactDose(e,active?data.session.sets.filter(r=>r.exercise===id):null);
 row.classList.toggle('is-folded',closed);row.querySelector('.exercise-body').hidden=closed;row.querySelector('.fold-dose').hidden=!closed;
 const b=row.querySelector('[data-action="fold-exercise"]');b.setAttribute('aria-expanded',String(!closed));b.title=(closed?'展开':'收起')+b.dataset.name;b.setAttribute('aria-label',b.title);b.innerHTML=icon(closed?'chevron-down':'chevron-up');
 exerciseFolds.set(row.dataset.foldKey,closed);
 if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const after=row.getBoundingClientRect().height;row.classList.add('fold-animating');const a=row.animate([{height:before+'px'},{height:after+'px'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});const done=()=>row.classList.remove('fold-animating');a.onfinish=done;a.oncancel=done;}
}
function updateFoldAll(){const rows=[...app.querySelectorAll('[data-fold-key]')],all=rows.length>0&&rows.every(r=>r.classList.contains('is-folded'));const button=app.querySelector('[data-action="fold-all"]');if(button){button.innerHTML=icon(all?'unfold-vertical':'fold-vertical')+(all?'全部展开':'全部收起');button.setAttribute('aria-expanded',String(!all));}globalThis.lucide?.createIcons();}
function decorateExerciseFolds(){
 if(page!=='today')return;const active=!!(data.session&&viewingSession),rows=[...app.querySelectorAll(active?'.training-exercise':'.exercise-row')];
 for(const row of rows){
  const id=active?row.dataset.workoutExercise:row.querySelector('[data-plan]')?.dataset.plan;
  const e=active?C.byId(id):currentPlan?.exercises.find(e=>e.id===id);if(!e||row.dataset.foldKey)continue;
  row.dataset.foldKey=foldKey(id,active);row.dataset.foldExercise=id;row.dataset.foldActual=String(active);row.classList.add('foldable-exercise');
  const body=document.createElement('div');body.className='exercise-body';body.id='exercise-body-'+id;
  const dose=document.createElement('div');dose.className='fold-dose';dose.innerHTML=compactDose(e,active?data.session.sets.filter(r=>r.exercise===id):null);
  let tools;
  if(active){
   const head=row.firstElementChild;tools=document.createElement('div');tools.className='fold-tools';head.lastElementChild.before(tools);tools.append(head.lastElementChild);
   head.firstElementChild.append(dose);for(const child of [...row.children])if(child!==head)body.append(child);row.append(body);
  }else{
   const copy=row.querySelector('.ex-copy'),name=copy.querySelector('.ex-name'),badge=copy.querySelector('.equipment-badge'),head=document.createElement('div');head.className='fold-heading';head.append(name);if(badge)head.append(badge);
   body.append(...copy.childNodes);copy.append(head,dose,body);tools=document.createElement('div');tools.className='fold-tools';row.lastElementChild.before(tools);tools.append(row.lastElementChild);
  }
  const detail=tools.querySelector('[data-action="detail"]');detail.className='fold-detail icon-button';detail.innerHTML=icon('book-open')+'<span>图解</span>';detail.setAttribute('aria-label','查看'+e.name+'动作图解');detail.title='查看'+e.name+'动作图解';
  tools.insertAdjacentHTML('afterbegin',button(icon('chevron-up'),'fold-exercise','icon-button',`type="button" data-id="${id}" data-name="${esc(e.name)}" aria-controls="${body.id}"`));
  setExerciseFold(row,exerciseFolds.get(row.dataset.foldKey)===true);
 }
 const first=app.querySelector('[data-fold-key]');if(first&&!app.querySelector('[data-action="fold-all"]')){let toolbar=app.querySelector('.routine-toolbar');if(!toolbar){toolbar=document.createElement('div');toolbar.className='fold-toolbar';first.before(toolbar);}toolbar.insertAdjacentHTML('beforeend',button(icon('fold-vertical')+'全部收起','fold-all','outline','type="button"'));}
 updateFoldAll();
}
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-action]');if(!b)return;
 if(b.dataset.action==='fold-exercise'){const row=b.closest('[data-fold-key]');setExerciseFold(row,!row.classList.contains('is-folded'),true);updateFoldAll();}
 if(b.dataset.action==='fold-all'){const rows=[...app.querySelectorAll('[data-fold-key]')],closed=!rows.every(r=>r.classList.contains('is-folded'));rows.forEach(row=>setExerciseFold(row,closed,true));updateFoldAll();}
});
function frozenPlan(s){return K.frozenPlan(s);}
function sessionToolbar(){const s=data.session;if(!s)return '';const done=s.sets.filter(r=>r.done).length,skipped=s.sets.filter(r=>r.skipped).length;return `<div class="workout-toolbar"><div><span class="live-dot"></span><strong>${C.lifts.find(l=>l.id===s.lift).name}训练进行中</strong><small>${done} / ${s.sets.length} 组已完成${skipped?' · '+skipped+' 组已放弃':''}</small></div>${button(icon(viewingSession?'clipboard-list':'play')+(viewingSession?'查看训练计划':'继续当前训练'),viewingSession?'browse-plan':'resume',viewingSession?'outline':'primary')}</div>`;}
function workoutMarkup(){
 const s=data.session,ids=[...new Set(s.sets.map(r=>r.exercise))];
 return sessionToolbar()+heading('本次训练','每组记录实际完成情况，未完成组不会计入训练量。','TRAINING SESSION',K.labels[s.mode])+`<section class="session-layout"><div class="timer" id="timer"><div><small>组间休息</small><strong id="timer-value">0:00</strong></div>${button(icon('skip-forward')+'结束休息','skip','outline')}</div>${ids.map(id=>{
 const e=C.byId(id),rows=s.sets.map((r,i)=>({...r,rowIndex:i})).filter(r=>r.exercise===id),pending=rows.some(r=>!r.done&&!r.skipped),unknown=rows.some(r=>r.calibrationRequired&&!r.done&&!r.skipped);
 return `<section class="training-exercise" data-workout-exercise="${id}"><header><div><div class="exercise-heading">${button(esc(e.name),'detail','ex-name',`data-id="${id}"`)}${equipmentBadge(e.equipment)}</div><p>${esc(e.weightUnit)} · ${rows.length} 组 · 组间休息 ${esc(rows[0].rest)} 秒</p></div>${button(icon('book-open')+'动作图解','detail','outline',`data-id="${id}"`)}</header>${pending?`<div class="load-entry ${unknown?'unknown':''}"><span>${unknown?'尚无可靠重量':'重量记录方式'}</span><div>${button(icon('scale')+(unknown?'先试重':'重新试重'),'calibrate','outline',`data-id="${id}"`)}${button(icon('pencil-line')+'直接填写','direct-load','outline',`data-id="${id}"`)}</div></div>`:''}<div class="set-head"><span>组次</span><span>${esc(e.weightUnit)}</span><span>${e.unit==='秒'?'秒':e.unit}</span><span>完成</span></div>${rows.map(r=>`<div class="set-row ${r.done?'done':''} ${r.skipped?'skipped':''}"><div class="set-identity"><strong>第 ${esc(r.index)} 组</strong><small>${r.skipped?'已放弃':r.done?'已完成':r.calibrationRequired?'待定重量':'待完成'}</small>${button(icon(r.skipped?'undo-2':'circle-slash')+(r.skipped?'恢复该组':'放弃该组'),r.skipped?'undo-set':'skip-set','skip-set link',`data-index="${r.rowIndex}" ${r.done?'disabled':''}`)}</div><input type="number" min="0" max="600" step="0.5" value="${esc(r.weight)}" placeholder="${r.calibrationRequired?'待填写':'实际'}" ${r.calibrationRequired||r.skipped?'disabled':''} data-set="${r.rowIndex}" data-field="weight" aria-label="${e.name}第${esc(r.index)}组重量"><input type="number" min="1" max="300" value="${esc(r.reps)}" ${r.skipped?'disabled':''} data-set="${r.rowIndex}" data-field="reps" aria-label="${e.name}第${esc(r.index)}组${e.unit}">${button(icon(r.done?'circle-check':'circle'),'toggle-set','check',`data-index="${r.rowIndex}" aria-pressed="${r.done}" aria-label="${e.name}第${esc(r.index)}组完成" ${r.skipped?'disabled':''}`)}</div>`).join('')}</section>`;}).join('')}<section class="session-effort"><div class="row"><label for="rpe">本次主项感觉强度</label><strong>${s.rpe} / 10</strong></div><input id="rpe" type="range" min="1" max="10" value="${s.rpe}"><p>6 约余 4 次 · 7 约余 3 次 · 8 约余 2 次 · 9 约余 1 次 · 10 无余力</p></section><div class="session-finish"><span>${s.sets.filter(r=>r.done).length} 组将计入实际训练</span>${button(icon('check')+'结束并保存','finish','primary')}${button('放弃本次训练','discard','link')}</div></section>`;
}
function showExercisePicker(replaceId){
 const targets=replaceId?C.byId(replaceId).muscles:C.lifts.find(l=>l.id===lift).muscles;
 pickerState={replaceId:replaceId||null,muscle:replaceId?C.byId(replaceId).primaryMuscles[0]:targets[0],equipment:'',query:'',side:lift==='deadlift'?'back':'front',targets};
 showDialog(`<div class="dialog-heading"><div><small>动作库</small><h2>${replaceId?'替换 '+C.byId(replaceId).name:'增加训练动作'}</h2></div>${button(icon('x'),'close','icon-button','aria-label="关闭"')}</div><div class="exercise-picker"><aside><canvas id="picker-map" aria-label="肌群选择图"></canvas><div id="picker-muscles"></div></aside><section><div class="picker-types">${['',...C.equipment.slice(1)].map(name=>button(name||'全部','picker-type','type-filter '+equipmentClass(name),`data-type="${name}" aria-pressed="${!name}"`)).join('')}</div><input id="picker-search" type="search" placeholder="搜索动作" aria-label="搜索动作"><div id="picker-results" aria-live="polite"></div></section></div>`);
 dialog.classList.add('library-dialog');updatePicker();
}
function updatePicker(){
 if(!pickerState||!dialog.open)return;const p=pickerState;
 document.querySelector('#picker-muscles').innerHTML=C.muscles.map(m=>button(m.name,'picker-muscle','muscle-filter '+(p.muscle===m.id?'selected':'')+(p.targets.includes(m.id)?' target-muscle':''),`data-id="${m.id}" aria-pressed="${p.muscle===m.id}"`)).join('');
 document.querySelectorAll('[data-action="picker-type"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===p.equipment)));
 const list=K.exerciseOptions(data,currentPlan,p).filter(e=>e.id!==p.replaceId);
 if(p.replaceId)list.unshift({...C.byId(p.replaceId),disabledReason:'当前动作 · 保留在第一位'});
 document.querySelector('#picker-results').innerHTML=list.length?list.map(e=>`<article class="picker-exercise ${e.id===p.replaceId?'current-exercise':''}"><div class="picker-image">${e.media.available?`<img src="../miniprogram${e.media.path}" alt="${e.name}图示" loading="lazy">`:icon('dumbbell')}</div><div><div class="exercise-heading"><strong>${esc(e.name)}</strong>${equipmentBadge(e.equipment)}</div><p>${esc(e.purpose)}</p>${e.disabledReason?`<small class="text-muted">${esc(e.disabledReason)}</small>`:''}<div class="row">${button(icon('book-open')+'图解','picker-detail','link',`data-id="${e.id}"`)}${button(icon(p.replaceId?'repeat-2':'plus')+(p.replaceId?'替换':'加入'),'picker-select','outline',`data-id="${e.id}" ${e.disabledReason?'disabled':''}`)}</div></div></article>`).join(''):'<div class="empty">此筛选下没有动作。</div>';
 const canvas=document.querySelector('#picker-map'),w=canvas.clientWidth||180,h=w*620/320,dpr=devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);A.draw(ctx,w,h,p.side,[...new Set([...p.targets,p.muscle])]);canvas.onclick=e=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);const id=A.hit(ctx,e.offsetX,e.offsetY,w,h,p.side);ctx.restore();if(id){p.muscle=id;updatePicker();}};globalThis.lucide?.createIcons();
}
function directLoadDialog(id){const row=data.session.sets.find(r=>r.exercise===id&&!r.done&&!r.skipped),e=C.byId(id);if(!row)return;showDialog(`<div class="dialog-heading"><h2>${e.name} · 直接填写</h2>${button(icon('x'),'close','icon-button','aria-label="关闭"')}</div><form id="direct-load-form" data-id="${id}"><p class="notice">这是你选择的工作重量，不是经过验证的推荐。使用可控重量；疼痛或动作失控时停止。</p>${field('weight',e.weightUnit,row.weight,'type="number" min="0" max="600" step="0.5" required')}${field('reps',e.unit,row.reps,'type="number" min="1" max="300" required')}${['machine-stack','assistance'].includes(e.loadConvention)?machineField(row):''}<button class="primary" type="submit">填写本动作待完成组</button></form>`);}
function machineField(row){return field('machineId','设备名称（可不填）',row.machineId==='default'?'':row.machineId||'','maxlength="80" placeholder="例如：健身房 A · 2 号腿举"')+'<p class="text-muted">不填表示沿用常用设备。更换设备请另取名称，避免混用标重。</p>';}
function updateWorkoutProgress(){if(!data.session)return;const s=data.session,done=s.sets.filter(r=>r.done).length,skipped=s.sets.filter(r=>r.skipped).length;const progress=app.querySelector('.workout-toolbar small'),finish=app.querySelector('.session-finish>span');if(progress)progress.textContent=done+' / '+s.sets.length+' 组已完成'+(skipped?' · '+skipped+' 组已放弃':'');if(finish)finish.textContent=done+' 组将计入实际训练';}
function workbenchExtras(){
 document.querySelectorAll('.training-equipment label').forEach(el=>{el.classList.add('type-choice',equipmentClass(el.querySelector('input')?.value));});
 document.querySelectorAll('.exercise-row').forEach(row=>{const id=row.querySelector('[data-action="detail"]')?.dataset.id,e=C.byId(id);if(e&&!row.querySelector('.equipment-badge'))row.querySelector('.ex-copy')?.insertAdjacentHTML('afterbegin',equipmentBadge(e.equipment));});
 if(page==='today'&&!(data.session&&viewingSession)){
   if(data.session&&!app.querySelector('.workout-toolbar'))app.insertAdjacentHTML('afterbegin',sessionToolbar());
   const section=app.querySelector('.section-head h2');const start=app.querySelector('[data-action="start"]');
   if(!viewFrozen&&currentPlan?.exercises.length&&start&&!app.querySelector('[data-action="add-exercise"]'))section?.parentElement.insertAdjacentHTML('beforeend',button(icon('plus')+'增加动作','add-exercise','outline add-exercise'));
 }
 if(page==='today'&&data.session&&viewingSession){document.querySelectorAll('.set-row').forEach((row,i)=>{if(data.session.sets[i]?.skipped)row.querySelectorAll('.set-extra input,.set-extra select').forEach(el=>el.disabled=true);});}
 globalThis.lucide?.createIcons();
}
document.addEventListener('click',e=>{const t=e.target.closest('[data-action]');if(!t)return;try{
 const action=t.dataset.action;
 if(action==='browse-plan'){viewFrozen=true;viewingSession=false;lift=data.session.lift;selectedDate=data.session.date;freeMode=data.session.requestedMode||data.session.mode;render();window.scrollTo(0,0);}
 if(action==='add-exercise')showExercisePicker();
 if(action==='picker-muscle'){pickerState.muscle=t.dataset.id;pickerState.side=C.muscles.find(m=>m.id===t.dataset.id).side;updatePicker();}
 if(action==='picker-type'){pickerState.equipment=t.dataset.type;updatePicker();}
 if(action==='picker-detail'){showExercise(t.dataset.id);dialog.querySelector('#dialog-content').insertAdjacentHTML('afterbegin',button(icon('arrow-left')+'返回动作选择','back-picker','outline'));}
 if(action==='back-picker'){const old={...pickerState};showExercisePicker(old.replaceId);pickerState=old;updatePicker();}
 if(action==='picker-select'){
   const id=t.dataset.id,p=pickerState;K.chooseExercise(data,currentPlan,id,p.replaceId);
   if(p.replaceId){const added=addedExercises.indexOf(p.replaceId);if(added>=0)addedExercises[added]=id;else{const original=Object.keys(overrides).find(k=>overrides[k].at(-1)===p.replaceId)||p.replaceId;overrides[original]=[...(overrides[original]||[]),id];}}
   else addedExercises.push(id);planEdits={};dialog.close();render();
 }
 if(action==='direct-load')directLoadDialog(t.dataset.id);
 if(action==='skip-set'||action==='undo-set'){store.updateSession(data.session);store.skipSet(data.session.id,data.session.sets[Number(t.dataset.index)].key);data=store.load();render();}
}catch(error){toast(error.message);}});
document.addEventListener('input',e=>{if(e.target.id==='picker-search'){pickerState.query=e.target.value;updatePicker();}});
document.addEventListener('submit',e=>{if(e.target.id!=='direct-load-form')return;e.preventDefault();try{const f=new FormData(e.target);store.updateSession(data.session);store.chooseLoad(data.session.id,e.target.dataset.id,{weight:f.get('weight'),reps:f.get('reps'),machineId:f.get('machineId')});data=store.load();dialog.close();render();toast('已填写待完成组，原计划目标保留');}catch(error){toast(error.message);}});
document.addEventListener('close',()=>dialog.classList.remove('library-dialog'),true);
