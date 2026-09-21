(function(){
  const local=typeof module!=='undefined';
  const C=local?require('./catalog'):globalThis.MuscleCatalog;
  const P=local?require('./planner'):globalThis.MusclePlanner;
  const K=local?require('./coach'):globalThis.MuscleCoach;
  const clone=value=>JSON.parse(JSON.stringify(value));
  function validate(r){
    if(!r||typeof r.id!=='string'||!r.id||typeof r.name!=='string'||!r.name.trim()||r.name.length>60||!C.lifts.some(l=>l.id===r.lift)||!['volume','intensity','technique','recovery','deload','assessment','manual','test'].includes(r.mode)||!Array.isArray(r.exercises)||!r.exercises.length||r.exercises.length>20)throw Error('收藏方案格式无效');
    if(new Set(r.exercises.map(e=>e.id)).size!==r.exercises.length)throw Error('收藏动作重复');
    for(const e of r.exercises)if(!C.byId(e.id)||!Number.isInteger(e.sets)||e.sets<1||e.sets>8||!Number.isInteger(e.reps)||e.reps<1||e.reps>300||e.weight!==null&&(!Number.isFinite(e.weight)||e.weight<0||e.weight>600))throw Error('收藏组次或重量无效');
    return r;
  }
  function snapshot(plan,name){return validate({id:'routine:'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),name:name.trim(),lift:plan.lift,mode:plan.mode,created:new Date().toISOString(),exercises:plan.exercises.map(e=>({id:e.id,sets:Number(e.sets),reps:Number(e.reps),weight:e.weight==null||e.weight===''?null:Number(e.weight),loadConvention:e.loadConvention,machineId:e.machineId||'default'}))});}
  function fromRecord(record){
    const p=K.frozenPlan({...record,sets:record.sets.filter(s=>s.done).map(s=>({...s,targetWeight:s.weight,targetReps:s.reps}))});
    for(const e of p.exercises){const row=record.sets.find(s=>s.exercise===e.id&&s.done);e.machineId=row.machineId||'default';if(!P.compatibleLoad(row,C.byId(e.id),e.machineId))e.weight=null;}
    return snapshot(p,record.date+' '+C.lifts.find(l=>l.id===record.lift).name);
  }
  function apply(data,plan,routine){
    validate(routine);if(routine.lift!==plan.lift)throw Error('请选择同一主项的收藏');
    const p=clone(plan),notes=[];
    if(!p.exercises.length||['test','assessment'].includes(p.mode))return {...p,routineNotes:['当前安全限制或测试流程优先，未套用收藏。']};
    const original=p.exercises,light=['recovery','deload','technique'].includes(p.mode)||Number(p.readiness?.fatigue)>=3;
    p.exercises=[];
    for(const saved of routine.exercises){
      try{
        let e=clone(original.find(e=>e.id===saved.id)||K.chooseExercise(data,p,saved.id));
        // A stored routine is a preference, not evidence of present-day ability.
        e.sets=Math.min(saved.sets,light?e.sets:8);
        e.reps=light?e.reps:saved.reps;
        if(saved.weight!==null){
          const compatible=saved.loadConvention===e.loadConvention&&(saved.machineId||'default')===(e.machineId||'default');
          if(e.weight!==null&&compatible){
            const lowerIsEasier=e.loadConvention!=='assistance';
            e.weight=lowerIsEasier?Math.min(e.weight,saved.weight):Math.max(e.weight,saved.weight);
          }else notes.push(e.name+'：收藏重量仅作参考，本次仍需确认同动作、同设备重量。');
        }
        if(!light&&saved.reps!==original.find(x=>x.id===e.id)?.reps&&e.capacity){
          const fresh=P.prescribe(e.id,data.profile,data.history.filter(h=>h.date<=p.date),p.mode,{sets:e.sets,reps:e.reps,rir:e.rir,date:p.date,machineId:e.machineId||'default',calibrations:data.calibrations||[]});
          e={...e,weight:fresh.weight,capacity:fresh.capacity,calibrationRequired:fresh.calibrationRequired,loadSource:fresh.loadSource||fresh.source};
          if(saved.weight!==null&&e.weight!==null)e.weight=e.loadConvention==='assistance'?Math.max(e.weight,saved.weight):Math.min(e.weight,saved.weight);
        }
        const cap=light?original.reduce((n,x)=>n+x.sets,0):data.profile.experience==='beginner'?14:24;
        if(p.exercises.reduce((n,x)=>n+x.sets,0)+e.sets>cap)throw Error('超过本日工作组上限');
        e.doseReason='收藏组次经今日安全上限复核：'+e.sets+' 组 × '+e.reps+' '+e.unit+'；'+(e.rir==null?'保持稳定姿势':'预计还能做 '+e.rir+' 次')+'。';
        e.prescribedSets=Array.from({length:e.sets},(_,i)=>({index:i+1,weight:e.weight,reps:e.reps,rir:e.rir,rest:e.rest}));p.exercises.push(e);
      }catch(error){notes.push(C.byId(saved.id).name+'：'+error.message);}
    }
    p.routineNotes=[light?'已保留今日减量上限，未直接照搬收藏重量和组数。':'收藏顺序与组次已应用；重量不超过当前同动作能力建议。',...notes];
    if(p.exercises.length&&p.exercises[0].id!==p.primaryExerciseId&&p.exercises.some(e=>e.main))p.routineNotes.push('主项不在首位：优先动作通常更有利于该动作的力量提升，主项开始前请重新热身并核对余力。');
    p.canStart=p.canStart&&p.exercises.length>0;return p;
  }
  function retrospective(plan,date){
    if(!P.validDate(date)||date>P.dateKey())throw Error('补录日期只能为今天或过去');
    const s=P.createSession({...plan,date,previewOnly:false});
    return {...s,retrospective:true,deadline:0,rpe:7,sets:s.sets.map(r=>({...r,done:false,quality:true,success:true,rir:null}))};
  }
  function exposure(data,date,plan){
    const workSet=s=>s.done&&!s.warmup&&!s.calibration;
    const records=data.history.filter(h=>h.date===date),rows=records.flatMap(h=>h.sets.filter(workSet));
    if(data.session?.date===date)rows.push(...data.session.sets.filter(workSet));
    const actual=rows.length>0,heat={};
    const counted=actual?rows.map(s=>({exercise:s.exercise,count:1})):(plan?.exercises||[]).map(e=>({exercise:e.id,count:e.sets}));
    for(const row of counted){
      // Form-edited group counts may be strings; missing or invalid counts are not work sets.
      if(!['number','string'].includes(typeof row.count))continue;
      const count=Number(row.count),e=C.byId(row.exercise);
      if(!e||!Number.isSafeInteger(count)||count<=0)continue;
      for(const id of e.muscles)heat[id]=(heat[id]||0)+count;
    }
    return {heat,source:actual?'实际完成组':'计划组（未计为实际训练）'};
  }
  function increment(profile,exercise){return Number(profile?.exerciseIncrements?.[exercise.id]||profile?.increment||2.5);}
  const api={validate,snapshot,fromRecord,apply,retrospective,exposure,increment};if(local)module.exports=api;else globalThis.MuscleRoutines=api;
})();
