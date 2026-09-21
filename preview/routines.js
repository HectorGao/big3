const R=globalThis.MuscleRoutines;
let routineState={key:'',routine:null,order:[],removed:[]};
let feedbackHeat=null,feedbackSide='front',feedbackMuscle='quads';
function resetRoutine(){routineState={key:'',routine:null,order:[],removed:[]};}
function customBase(p){
 const key=JSON.stringify([p.date,p.lift,p.requestedMode,freeMode,readiness,data.profile?.equipment]);
 if(routineState.key!==key){if(routineState.key){overrides={};addedExercises=[];planEdits={};}resetRoutine();routineState.key=key;}
 return routineState.routine?R.apply(data,p,routineState.routine):p;
}
function customOrder(p){
 p.exercises=p.exercises.filter(e=>!routineState.removed.includes(e.id));
 const order=routineState.order;p.exercises.sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):100)-(order.includes(b.id)?order.indexOf(b.id):100));
 p.canStart=p.canStart&&p.exercises.length>0;if(p.exercises.some(e=>e.main)&&!p.exercises[0]?.main)p.routineNotes=[...(p.routineNotes||[]),'主项排在辅助动作后：请在主项开始前重新热身并核对余力；优先训练的动作通常更有利于其力量提升。'];return p;
}
function reorderPlan(from,to){const ids=currentPlan.exercises.map(e=>e.id),index=ids.indexOf(from);if(index<0||!ids.includes(to)||from===to)return;ids.splice(index,1);ids.splice(ids.indexOf(to),0,from);routineState.order=ids;render();}
function favoriteDialog(){
 const favorites=data.favorites.filter(r=>r.lift===lift&&r.mode===currentPlan.mode);
 const past=data.history.filter(h=>h.lift===lift&&h.mode===currentPlan.mode).slice(0,8);
 showDialog(`<div class="dialog-heading"><h2>收藏与最近训练</h2>${button(icon('x'),'close','icon-button','aria-label="关闭"')}</div><p class="text-muted">${C.lifts.find(l=>l.id===lift).name} · ${K.labels[currentPlan.mode]}。沿用动作顺序和组次，重量按当前能力与恢复重新核对。</p><form id="favorite-form"><label class="field">收藏名称<input name="name" maxlength="60" required value="${esc(C.lifts.find(l=>l.id===lift).name+' · '+K.labels[currentPlan.mode])}"></label><button class="primary" type="submit">${icon('bookmark-plus')}收藏当前方案</button></form><div class="row"><h3>我的收藏</h3><div>${button(icon('chevron-left'),'routine-prev','icon-button','aria-label="上一个收藏"')}${button(icon('chevron-right'),'routine-next','icon-button','aria-label="下一个收藏"')}</div></div><div class="routine-carousel">${favorites.length?favorites.map(r=>`<article class="routine-item"><div><strong>${esc(r.name)}</strong><p>${r.exercises.map(e=>esc(C.byId(e.id).name)).join(' → ')}</p></div>${button('使用','use-favorite','outline',`data-id="${esc(r.id)}"`)}</article>`).join(''):'<p class="empty">还没有同类型收藏。</p>'}</div><h3>同类训练记录</h3>${past.map(h=>`<article class="routine-item"><span>${h.date} · ${h.sets.length} 组</span>${button('沿用动作','use-history','outline',`data-id="${esc(h.id)}"`)}</article>`).join('')||'<p class="empty">暂无同类记录。</p>'}`);
}
function useRoutine(r){routineState.routine=r;routineState.order=r.exercises.map(e=>e.id);routineState.removed=[];overrides={};addedExercises=[];planEdits={};dialog.close();render();toast('已套用动作顺序，并复核当天训练限制');}
function decorateNumbers(root){
 root.querySelectorAll('input[type="number"]:not([data-stepped])').forEach(input=>{
  if(input.disabled)return;input.dataset.stepped='true';
  const id=input.dataset.plan||data.session?.sets[Number(input.dataset.set)]?.exercise||input.closest('[data-retro-exercise]')?.dataset.retroExercise||input.form?.dataset.id;
  if(input.dataset.field==='weight'||input.name==='weight'&&['direct-load-form','calibration-form'].includes(input.form?.id)){input.dataset.numberIncrement=R.increment(data.profile,C.byId(id)||{});input.step='any';}
  const shell=document.createElement('div');shell.className='number-control';input.before(shell);shell.append(input);
  const controls=document.createElement('span');controls.className='number-buttons';controls.innerHTML=`<button type="button" data-number-step="1" aria-label="增加${esc(input.getAttribute('aria-label')||input.name||'数值')}" title="增加">${icon('chevron-up')}</button><button type="button" data-number-step="-1" aria-label="减少${esc(input.getAttribute('aria-label')||input.name||'数值')}" title="减少">${icon('chevron-down')}</button>`;shell.append(controls);
  if(input.dataset.plan||input.dataset.retroIndex!==undefined){
   const details=document.createElement('details');details.className='number-slider';details.innerHTML=`<summary title="滑动调节" aria-label="滑动调节">${icon('sliders-horizontal')}</summary><input type="range" min="${input.min||0}" max="${input.max||300}" step="${input.dataset.numberIncrement||input.step||1}" value="${input.value||0}" aria-label="滑动${esc(input.getAttribute('aria-label')||'数值')}">`;shell.append(details);
   details.querySelector('input').addEventListener('input',event=>{input.value=event.target.value;input.dispatchEvent(new Event('input',{bubbles:true}));});
   details.querySelector('input').addEventListener('change',()=>input.dispatchEvent(new Event('change',{bubbles:true})));
  }
 });
 globalThis.lucide?.createIcons();
}
function routineExtras(){
 if(page==='today'&&!(data.session&&viewingSession)&&!viewFrozen&&currentPlan?.exercises.length){
  app.querySelector('.section-head h2')?.parentElement.insertAdjacentHTML('afterend',`<div class="routine-toolbar">${button(icon('bookmark')+'收藏 / 沿用','favorites','outline')}${button(icon('rotate-ccw')+'默认顺序','default-order','link')}${button(icon('calendar-plus')+'事后补录','manual','outline')}</div>${currentPlan.routineNotes?.length?`<div class="notice">${currentPlan.routineNotes.map(esc).join('<br>')}</div>`:''}`);
  app.querySelectorAll('.exercise-row').forEach(row=>{const id=row.querySelector('[data-plan]')?.dataset.plan;if(!id)return;row.dataset.exerciseId=id;const number=row.querySelector('.ex-number');number.innerHTML=`<button class="drag-handle icon-button" data-drag="${id}" aria-label="拖动${esc(C.byId(id).name)}排序" title="拖动排序" aria-keyshortcuts="ArrowUp ArrowDown">${icon('menu')}</button>`;
   row.querySelector('.ex-copy').insertAdjacentHTML('beforeend',`<div class="card-order">${button(icon('arrow-up'),'move-up','icon-button',`data-id="${id}" title="上移" aria-label="上移${C.byId(id).name}"`)}${button(icon('arrow-down'),'move-down','icon-button',`data-id="${id}" title="下移" aria-label="下移${C.byId(id).name}"`)}${button(icon('minus-circle')+'移出计划','remove-planned','link',`data-id="${id}"`)}</div>`);
  });
 }
 if(page==='overview')overviewExtras();
 decorateNumbers(app);
}
function retroDialog(){
 if(!data.profile)throw Error('请先建立训练档案');
 if(data.retroDraft){renderRetro();return;}
 const sources=[...data.favorites.map(r=>({value:'favorite:'+r.id,label:'收藏 · '+r.name})),...data.history.slice(0,12).map(h=>({value:'history:'+h.id,label:h.date+' · '+C.lifts.find(l=>l.id===h.lift).name+' · '+K.labels[h.mode]}))];
 showDialog(`<div class="dialog-heading"><h2>事后补录</h2>${button(icon('x'),'close','icon-button','aria-label="关闭"')}</div><p class="notice">只填写已发生的训练。导入内容是填写起点，不是已完成记录；不会覆盖进行中的训练。</p><form id="retro-import-form">${field('date','实际训练日期',selectedDate>P.dateKey()?P.dateKey():selectedDate,`type="date" max="${P.dateKey()}" required`)}<label class="field">导入来源<select name="source"><option value="default">默认规划</option>${sources.map(s=>`<option value="${esc(s.value)}">${esc(s.label)}</option>`).join('')}</select></label><div class="grid2"><label class="field">主项<select name="lift">${C.lifts.map(l=>`<option value="${l.id}" ${l.id===lift?'selected':''}>${l.name}</option>`).join('')}</select></label><label class="field">训练日<select name="mode">${['volume','intensity','technique','recovery','deload'].map(m=>`<option value="${m}">${K.labels[m]}</option>`).join('')}</select></label></div><button type="submit" class="primary">导入并填写</button></form>`);
}
function createRetro(form){
 const date=form.get('date'),source=form.get('source');if(!P.validDate(date)||date>P.dateKey())throw Error('请选择已发生的日期');
 let l=form.get('lift'),mode=form.get('mode'),exercises,routine;
 if(source.startsWith('favorite:'))routine=data.favorites.find(r=>r.id===source.slice(9));
 if(source.startsWith('history:'))routine=R.fromRecord(data.history.find(h=>h.id===source.slice(8)));
 if(routine){l=routine.lift;mode=routine.mode;exercises=routine.exercises.map(e=>({...C.byId(e.id),...e,calibrationRequired:e.weight===null,rest:0,rir:null,loadSource:'补录参考值，需确认实际完成量'}));}
 else{const p=K.prescription(data,l,date,K.feedback(data,date)||{fatigue:2,pain:false},{mode});exercises=p.exercises;mode=p.mode;if(!exercises.length){mode='manual';exercises=[P.prescribe(l,data.profile,[],mode,{sets:1,reps:5,rir:3,date})];}}
 const draft=R.retrospective({date,lift:l,mode,exercises},date);store.retrospective(draft);data=store.load();renderRetro();
}
function renderRetro(){
 const s=data.retroDraft;if(!s)return;showDialog(`<div class="dialog-heading"><div><small>事后补录 · 草稿已保留</small><h2>${s.date} · ${C.lifts.find(l=>l.id===s.lift).name}</h2></div>${button(icon('x'),'close','icon-button','aria-label="关闭"')}</div><p class="notice">核对实际重量、次数与完成状态。填写待定重量后，仅带入同动作其他待定组；不会自动勾选完成。</p><div class="retro-list">${[...new Set(s.sets.map(r=>r.exercise))].map(id=>{const e=C.byId(id);return `<section data-retro-exercise="${id}" class="retro-exercise"><h3>${e.name} ${equipmentBadge(e.equipment)}</h3>${s.sets.map((r,i)=>r.exercise===id?`<div class="retro-row"><strong>${r.index}</strong><label>${e.weightUnit}<input type="number" min="0" max="600" step="${R.increment(data.profile,e)}" data-retro-index="${i}" data-field="weight" value="${esc(r.weight)}" placeholder="待定" aria-label="${e.name}第${r.index}组重量"></label><label>${e.unit}<input type="number" min="1" max="300" data-retro-index="${i}" data-field="reps" value="${esc(r.reps)}" aria-label="${e.name}第${r.index}组${e.unit}"></label><label>还能做几次<select data-retro-index="${i}" data-field="rir"><option value="">未记录</option>${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${r.rir===n?'selected':''}>${n}${n===5?'+':''} 次</option>`).join('')}</select></label><div class="retro-flags"><label class="retro-check"><input type="checkbox" data-retro-index="${i}" data-field="done" ${r.done?'checked':''}>完成</label><label class="retro-check"><input type="checkbox" data-retro-index="${i}" data-field="quality" ${r.quality?'checked':''}>动作合格</label><label class="retro-check"><input type="checkbox" data-retro-index="${i}" data-field="success" ${r.success?'checked':''}>成功</label></div></div>`:'').join('')}</section>`;}).join('')}</div><label class="field">本次感觉强度<select id="retro-rpe"><option value="">请选择实际感受</option>${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${s.rpeConfirmed&&s.rpe===n?'selected':''}>${n} / 10</option>`).join('')}</select></label><div class="retro-actions">${button(icon('check')+'保存实际训练','save-retro','primary')}${button('放弃补录草稿','discard-retro','link')}</div>`);dialog.classList.add('library-dialog');decorateNumbers(dialog);
}
function saveRetroInput(t){
 const d=structuredClone(data.retroDraft);if(!d)return;const row=d.sets[Number(t.dataset.retroIndex)],key=t.dataset.field;
 if(t.id==='retro-rpe'){if(!t.value)return;d.rpe=Number(t.value);d.rpeConfirmed=true;}
 else if(row){
  if(['done','quality','success'].includes(key))row[key]=t.checked;
  else row[key]=t.value===''?(key==='rir'?null:''):Number(t.value);
  if(key==='weight'&&t.value!==''){row.calibrationRequired=false;row.entryMode='retrospective';for(const r of d.sets)if(r.exercise===row.exercise&&!r.done&&(r.weight===''||r.weight===null)){r.weight=row.weight;r.calibrationRequired=false;r.entryMode='retrospective';}}
 }
 store.retrospective(d);data=store.load();
 dialog.querySelectorAll('[data-retro-index][data-field="weight"]').forEach(input=>{if(input!==t)input.value=d.sets[Number(input.dataset.retroIndex)].weight;});
}
function sorenessDialog(){
 if(selectedDate>P.dateKey())throw Error('未来状态尚未发生，请在实际日期填写');
 const f=K.feedback(data,selectedDate)||{fatigue:2,pain:false,soreness:{}};
 let p;try{p=plan();}catch{p=null;}feedbackHeat=R.exposure(data,selectedDate,p);feedbackMuscle=Object.keys(feedbackHeat.heat)[0]||'quads';feedbackSide=C.muscles.find(m=>m.id===feedbackMuscle).side;
 showDialog(`<div class="dialog-heading"><h2>${selectedDate} · 肌群与酸痛</h2>${button(icon('x'),'close','icon-button','aria-label="关闭"')}</div><form id="feedback-form" data-date="${selectedDate}"><div class="soreness-layout"><aside><div class="segmented">${button('正面','heat-front','outline','type="button"')}${button('背面','heat-back','outline','type="button"')}</div><canvas id="heat-map"></canvas><div class="heat-legend"><span>少</span><i></i><span>多</span></div><p class="text-muted">${feedbackHeat.source}的肌群涉及组数；不是酸痛或生理恢复程度。</p></aside><section><label class="field">整体疲劳<select name="fatigue">${S.fatigueLevels.map(l=>`<option value="${l.value}" ${f.fatigue===l.value?'selected':''}>${l.value} ${l.label}</option>`).join('')}</select></label><label class="switch-label">疼痛或明显不适<input name="pain" type="checkbox" ${f.pain?'checked':''}></label>${C.muscles.map(m=>`<label class="soreness-muscle ${feedbackHeat.heat[m.id]?'involved':''}" data-heat-muscle="${m.id}"><span>${m.name}<small>${feedbackHeat.heat[m.id]||0} 组涉及</small></span><select name="${m.id}" aria-label="${m.name}酸痛">${['没有','轻微','明显','影响动作'].map((v,i)=>`<option value="${i}" ${Number(f.soreness[m.id]||0)===i?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</section></div><button class="primary" type="submit">保存并重新规划</button></form>`);dialog.classList.add('library-dialog');drawHeat();
}
function drawHeat(){const canvas=dialog.querySelector('#heat-map');if(!canvas)return;const w=canvas.clientWidth||200,h=w*620/320,dpr=devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);A.draw(ctx,w,h,feedbackSide,[],feedbackHeat.heat);dialog.querySelectorAll('[data-heat-muscle]').forEach(el=>el.classList.toggle('selected',el.dataset.heatMuscle===feedbackMuscle));canvas.onclick=event=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);const id=A.hit(ctx,event.offsetX,event.offsetY,w,h,feedbackSide);ctx.restore();if(id){feedbackMuscle=id;drawHeat();dialog.querySelector(`[name="${id}"]`).focus();}};}
function overviewExtras(){
 const end=selectedDate,start=K.add(end,-27),previous=K.add(start,-28);const records=data.history.filter(h=>h.date>=start&&h.date<=end),old=data.history.filter(h=>h.date>=previous&&h.date<start);
 const valid=records.flatMap(h=>h.sets.filter(s=>s.done&&!s.warmup&&!s.calibration&&s.quality!==false&&s.success!==false)),days=new Set(records.map(h=>h.date)).size;
 const stats=`<section class="overview-pulse"><div><small>近 28 天训练日</small><strong>${days}<em>天</em></strong><span>上期 ${new Set(old.map(h=>h.date)).size} 天</span></div><div><small>实际成功工作组</small><strong>${valid.length}<em>组</em></strong><span>不合并不同设备吨位</span></div><div><small>余力记录覆盖</small><strong>${valid.length?Math.round(valid.filter(s=>s.rir!=null).length/valid.length*100):'—'}<em>${valid.length?'%':''}</em></strong><span>反馈越完整，校准越有依据</span></div><div><small>收藏训练方案</small><strong>${data.favorites.length}<em>套</em></strong><span>${data.retroDraft?'有未保存的补录草稿':'按主项和训练类型复用'}</span></div></section><section class="overview-distribution"><h2>近 28 天项目分布</h2>${C.lifts.map(l=>{const n=records.filter(r=>r.lift===l.id).length;return `<div><span>${l.name}</span><meter min="0" max="${Math.max(1,records.length)}" value="${n}"></meter><strong>${n} 次</strong></div>`;}).join('')}<div class="account-actions">${button(icon('calendar-plus')+'补录训练','manual','outline')}${button(icon('messages-square')+'发表想法','community','outline')}</div></section>`;
 app.querySelector('.page-heading')?.insertAdjacentHTML('afterend',stats);
 if(MuscleSync.user?.demo)app.insertAdjacentHTML('afterbegin','<div class="notice demo-notice">模拟调试账号 · 数据为人工生成，不代表真实训练效果，不进入研究导出。</div>');
}
document.addEventListener('click',event=>{const t=event.target.closest('button');if(!t)return;try{
 if(t.dataset.numberStep){const input=t.closest('.number-control').querySelector('input[type="number"]');const step=Number(input.dataset.numberIncrement||input.step||1),value=Number(input.value||input.min||0),next=Math.round((value+Number(t.dataset.numberStep)*step)*1e6)/1e6;input.value=Math.min(Number(input.max||600),Math.max(Number(input.min||0),next));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return;}
 const a=t.dataset.action;
 if(a==='favorites')favoriteDialog();
 if(a==='routine-prev'||a==='routine-next'){const carousel=dialog.querySelector('.routine-carousel');carousel.scrollBy({left:carousel.clientWidth*(a==='routine-next'?1:-1),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 if(a==='use-favorite')useRoutine(data.favorites.find(r=>r.id===t.dataset.id));
 if(a==='use-history')useRoutine(R.fromRecord(data.history.find(h=>h.id===t.dataset.id)));
 if(a==='default-order'){const defaults=K.prescription(data,lift,selectedDate,readiness,{mode:freeMode||undefined}).exercises.map(e=>overrides[e.id]?.at(-1)||e.id);routineState.order=[...defaults,...currentPlan.exercises.map(e=>e.id).filter(id=>!defaults.includes(id))];render();}
 if(a==='move-up'||a==='move-down'){const ids=currentPlan.exercises.map(e=>e.id),i=ids.indexOf(t.dataset.id),j=i+(a==='move-up'?-1:1);if(j>=0&&j<ids.length){[ids[i],ids[j]]=[ids[j],ids[i]];routineState.order=ids;render();}}
 if(a==='remove-planned'){if(currentPlan.exercises.length===1)throw Error('至少保留一个动作；需要休息时可跳过训练');routineState.removed.push(t.dataset.id);render();}
 if(a==='save-retro'){if(!data.retroDraft.rpeConfirmed)throw Error('请填写本次实际感觉强度');if(!confirm('仅保存已勾选完成的实际组，日期为 '+data.retroDraft.date+'。确认补录？'))return;store.finishRetrospective();data=store.load();resetRoutine();planEdits={};dialog.close();render();toast('补录已保存，成绩与未来两周建议已更新');}
 if(a==='discard-retro'&&confirm('放弃未保存的补录草稿？历史记录不受影响。')){store.retrospective(null);data=store.load();dialog.close();}
 if(a==='heat-front'||a==='heat-back'){feedbackSide=a==='heat-front'?'front':'back';drawHeat();}
}catch(e){toast(e.message);}});
document.addEventListener('click',event=>{const el=event.target.closest('[data-heat-muscle]');if(el){feedbackMuscle=el.dataset.heatMuscle;feedbackSide=C.muscles.find(m=>m.id===feedbackMuscle).side;drawHeat();}});
document.addEventListener('submit',event=>{if(!['favorite-form','retro-import-form'].includes(event.target.id))return;event.preventDefault();try{const f=new FormData(event.target);if(event.target.id==='favorite-form'){store.favorite(R.snapshot(currentPlan,f.get('name')));data=store.load();favoriteDialog();toast('方案已收藏');}else createRetro(f);}catch(e){toast(e.message);}});
document.addEventListener('change',event=>{if(event.target.dataset.retroIndex===undefined&&event.target.id!=='retro-rpe')return;try{saveRetroInput(event.target);}catch(e){toast(e.message);renderRetro();}});
document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{if(dialog.open)decorateNumbers(dialog);}).observe(document.querySelector('#dialog-content'),{childList:true}));
