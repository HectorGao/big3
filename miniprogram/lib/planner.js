(function () {
  const C = typeof module !== 'undefined' ? require('./catalog') : globalThis.MuscleCatalog;
  const S = typeof module !== 'undefined' ? require('./science') : globalThis.MuscleScience;
  const modes = { setup:'完善资料', volume:'容量日', intensity:'强度日', recovery:'恢复日', technique:'技术日', deload:'减量日', test:'冲刺日', assessment:'次极限评估', manual:'补记训练', rest:'休息日' };
  const DAY = 86400000;
  const dateKey = (d = new Date()) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  function validDate(s) {
    if(typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d=new Date(s+'T12:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0,10)===s;
  }
  const daysBetween = (a,b) => (Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/DAY;
  const numberIn = (v,min,max) => (typeof v==='number'||typeof v==='string') && String(v).trim()!=='' && Number.isFinite(Number(v)) && Number(v)>=min && Number(v)<=max;
  function validateProfile(p) {
    if(!p || !numberIn(p.age,18,100) || !Number.isInteger(Number(p.age))) return '首版适用于 18–100 岁健康成年人，请填写整数年龄。';
    if(!numberIn(p.weight,30,350)) return '请填写 30–350 kg 范围内的体重。';
    if(!['beginner','trained'].includes(p.experience)) return '请选择训练经验。';
    if(!['strength','muscle'].includes(p.goal)) return '请选择训练目标。';
    if(!Array.isArray(p.days)||!p.days.length||p.days.length>7||new Set(p.days).size!==p.days.length||p.days.some(d=>!Number.isInteger(d)||d<0||d>6)) return '请至少选择一个可训练日。';
    if(![0.5,1,1.25,2.5,5].includes(Number(p.increment))) return '请选择可用的总重量增量。';
    if(p.equipment!==undefined&&(!Array.isArray(p.equipment)||p.equipment.some(e=>!C.equipment.slice(1).includes(e))))return '器械选项无效。';
    if(p.exerciseIncrements!==undefined&&(!p.exerciseIncrements||typeof p.exerciseIncrements!=='object'||Array.isArray(p.exerciseIncrements)||Object.entries(p.exerciseIncrements).some(([id,n])=>!C.byId(id)||!numberIn(n,0.25,50))))return '动作最小加重档位无效。';
    if(p.machineIds!==undefined&&(!p.machineIds||typeof p.machineIds!=='object'||Array.isArray(p.machineIds)||Object.entries(p.machineIds).some(([id,value])=>!C.byId(id)||typeof value!=='string'||!value.trim()||value.length>80)))return '器械标识无效。';
    if(!p.pb || typeof p.pb!=='object'||Array.isArray(p.pb)) return 'PB 数据格式不正确。';
    for(const [lift,pb] of Object.entries(p.pb)) {
      if(!C.lifts.some(l=>l.id===lift)) return '未知三大项。';
      if(!pb || !numberIn(pb.weight,1,600)||!numberIn(pb.reps,1,10)||!Number.isInteger(Number(pb.reps))) return 'PB 需填写 1–600 kg、1–10 次；没有 PB 请留空。';
      if(!validDate(pb.date)||pb.date>dateKey()) return 'PB 日期无效或晚于今天。';
    }
    return null;
  }
  function estimateMax(weight,reps) {
    if(!numberIn(weight,1,600)||!numberIn(reps,1,10)||!Number.isInteger(Number(reps))) throw new Error('PB 数值无效');
    return Number(reps)===1 ? Number(weight) : Math.round(Number(weight)*(1+Number(reps)/30)*10)/10;
  }
  function compatibleLoad(row,ex,machineId='default'){
    if(row.loadConvention)return row.loadConvention===ex.loadConvention&&(!['machine-stack','assistance'].includes(ex.loadConvention)||(row.machineId||'default')===machineId);
    // Legacy free-weight barbell values are unambiguous; other equipment needs confirmation.
    return ex.loadConvention==='barbell-total'||ex.loadConvention==='bodyweight';
  }
  function prescribe(id,profile,history,mode,{sets=2,reps=10,rir=3,main=false,date=dateKey(),calibrations=[],machineId='default'}={}) {
    const ex=C.byId(id);if(!ex)throw Error('未知动作');
    const increment=Number(profile.exerciseIncrements?.[id]||(ex.equipment==='哑铃'?0.5:profile.increment));
    const effort=mode==='recovery'?5:mode==='technique'||mode==='deload'?Math.max(4,rir):rir;
    const bodyweight=ex.loadConvention==='bodyweight',assistance=ex.loadConvention==='assistance';
    const eligibleRows=r=>r.sets.filter(s=>s.exercise===id&&s.done&&!s.warmup&&!s.calibration&&s.success!==false&&s.quality!==false&&compatibleLoad(s,ex,machineId));
    const prior=history.filter((r,i)=>history.findIndex(x=>x.id===r.id)===i&&r.date<=date&&daysBetween(date,r.date)<=90&&eligibleRows(r).length).sort((a,b)=>b.date.localeCompare(a.date));
    const rows=prior[0]?eligibleRows(prior[0]):[];
    const trials=calibrations.filter(t=>t.exercise===id&&t.accepted&&t.quality&&t.date<=date&&daysBetween(date,t.date)<=60&&compatibleLoad(t,ex,machineId)).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
    const latestAttempt=history.filter(r=>r.date<=date&&daysBetween(date,r.date)<=7&&r.sets.some(s=>s.exercise===id&&s.done&&compatibleLoad(s,ex,machineId))).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const failedAttempt=latestAttempt?.sets.some(s=>s.exercise===id&&s.done&&(s.success===false||s.quality===false));
    let capacity=null,weight=bodyweight?0:null,source=bodyweight?'自重动作：以姿势、幅度和难度控制，不自动加公斤数':'待试重：没有可靠的同动作、同器械负荷';
    const pb=profile.pb[id],estimate=pb&&daysBetween(date,pb.date)>=0&&daysBetween(date,pb.date)<=180?S.estimatePB(pb.weight,pb.reps):null;
    let recent=trials[0]&&(!prior[0]||trials[0].date>=prior[0].date)?trials[0]:rows[0];
    if(main&&recent&&estimate&&Number(recent.weight)>estimate.high*1.2){recent=null;source='异常高成绩需核实；暂不提高处方';}
    if(!bodyweight){
      if(recent){
        const reserveKnown=numberIn(recent.rir,0,5),sameReps=Number(recent.reps)===reps;
        if(sameReps){weight=Number(recent.weight);source='同动作实际记录 '+(recent.date||prior[0]?.date)+'；按当前器械标重';}
        if(!assistance&&reserveKnown&&Number(recent.reps)<=10&&Number(recent.reps)+Number(recent.rir)<=12&&Number(recent.weight)>0){
          capacity=Number(recent.weight)*(1+(Number(recent.reps)+Number(recent.rir))/30);
          if(!sameReps&&reps+effort<=12&&reps<=10){weight=S.loadForReps(capacity,reps,effort,increment);source='同动作实际组与余力估算；热身后确认';}
        }
        if(!sameReps&&weight===null)source='目标次数变化，原记录不足以可靠换算；需重新试重';
        const stable=prior.length>=2&&prior.slice(0,2).every(r=>{
          const done=eligibleRows(r),target=done[0]?.targetSetCount;
          return Number.isInteger(target)&&target>0&&done.length>=target&&done.every(s=>s.quality===true&&s.targetSetCount===target&&numberIn(s.rir,3,5)&&Number(s.reps)>=Number(s.targetReps)&&Number(s.targetReps)===reps);
        });
        if(weight!==null&&stable&&!failedAttempt&&!['recovery','technique','deload','test','assessment'].includes(mode)&&!trials.some(t=>t===recent)){
          if(weight>0&&increment/weight<=0.05){weight=Math.max(0,weight+(assistance?-increment:increment));source+='；连续两次达标，调整一档';}
          else {reps=Math.min(reps+1,15);source+='；器械档位超过 5%，先增加一次';}
        }
        if(weight!==null&&rows.some(s=>s.rir!=null&&Number(s.rir)<=1||s.targetReps&&Number(s.reps)<Number(s.targetReps))){
          weight=assistance?weight+increment:S.roundLoad(weight*.95,increment);sets=Math.max(1,sets-1);source+='；近期未达标，减量';
        }
      }else if(estimate){
        capacity=S.trainingMax(profile,estimate);weight=S.loadForReps(capacity,reps,effort,increment);source='同主项 PB/e1RM → 保守训练基准';
      }
      if(failedAttempt&&weight!==null){
        weight=assistance?weight+increment:S.roundLoad(weight*.9,increment);sets=Math.max(1,sets-1);source+='；最近出现失败或动作失控，降量并重新确认';
      }
      if(weight!==null&&['recovery','technique','deload'].includes(mode)){
        if(assistance)weight+=increment;
        else weight=S.roundLoad(capacity?Math.min(weight,capacity*(mode==='recovery'?.5:mode==='deload'?.65:.55)):weight*(mode==='recovery'?.6:.75),increment);
        source+='；低负荷日';
      }
    }
    const calibrationRequired=weight===null;
    return {...ex,sets,reps,weight,capacity:capacity?Math.round(capacity*10)/10:null,rir:ex.measurement.kind==='duration'?null:effort,source,loadSource:source,calibration:calibrationRequired,calibrationRequired,machineId,increment,rest:main?mode==='intensity'?240:180:ex.isolation?90:120,main};
  }
  function validateRecord(r) {
    if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||!validDate(r.date)||r.date>dateKey()||!C.lifts.some(l=>l.id===r.lift)) return '训练记录标识或日期无效。';
    if(!['volume','intensity','recovery','technique','deload','test','assessment','manual'].includes(r.mode)||typeof r.completed!=='boolean'||!numberIn(r.rpe,1,10)) return '训练类型或用力程度无效。';
    if(!Array.isArray(r.sets)||!r.sets.length||r.sets.length>100||!r.sets.some(s=>s.done)) return '至少需要一组实际完成记录。';
    for(const s of r.sets) if(!s||!C.byId(s.exercise)||typeof s.done!=='boolean'||!numberIn(s.weight,0,600)||!numberIn(s.reps,1,300)||!Number.isInteger(Number(s.reps))||s.targetReps!==undefined&&(!numberIn(s.targetReps,1,300)||!Number.isInteger(Number(s.targetReps)))) return '每组需填写有效重量和次数。';
    if(r.sets.some(s=>s.done&&s.calibrationRequired))return '待试重不能作为实际工作组保存。';
    if(r.completed && !r.sets.some(s=>s.exercise===r.lift&&s.done)) return '完成主项后才能推进周期。';
    if(r.sets.some(s=>s.rir!==null&&s.rir!==undefined&&(!numberIn(s.rir,0,5)||!Number.isInteger(Number(s.rir)))))return '每组剩余次数需为 0–5 或留空。';
    if(r.sets.some(s=>s.capacity!==null&&s.capacity!==undefined&&!numberIn(s.capacity,0.1,1000)))return '训练基准无效。';
    if(r.completed && r.sets.some(s=>s.exercise===r.lift&&(!s.done || s.targetReps!==undefined&&Number(s.reps)<Number(s.targetReps)))) return '主项次数未达到目标，不能标记完成。';
    return null;
  }
  function makePlan({profile,history=[],lift='squat',date=dateKey(),readiness={},mode}){
    if(!C.lifts.some(l=>l.id===lift)||!validDate(date))throw Error('训练项目或日期无效');
    const reason=validateProfile(profile),fatigue=S.fatigueInfo(readiness.fatigue??2);
    if(reason)return {lift,date,mode:'setup',label:modes.setup,reason,exercises:[],warmup:[],fatigue,canStart:false,previewOnly:date!==dateKey()};
    const K=typeof module!=='undefined'?require('./coach'):globalThis.MuscleCoach;
    return K.prescription({profile,history,calibrations:[],feedback:[],events:[],settings:{maxTesting:false}},lift,date,{...readiness,fatigue:fatigue.value},{mode});
  }
  function planView(args){
    const today=makePlan(args);
    if(today.mode!=='rest')return {...today,blockedReason:''};
    for(let i=1;i<=21;i++){
      const d=new Date(today.date+'T12:00:00');d.setDate(d.getDate()+i);
      if(!args.profile.days.includes(d.getDay()))continue;
      const next=makePlan({...args,date:dateKey(d),readiness:{fatigue:2,pain:false}});
      if(next.exercises.length)return {...next,canStart:false,previewOnly:true,blockedReason:today.reason,fatigue:today.fatigue,reason:'预计 '+next.date+' 的参考计划，按恢复正常估算；必须在训练当天重新评估。'};
    }
    return {...today,canStart:false,previewOnly:false,blockedReason:today.reason};
  }
  function upcoming(profile,history=[],start=dateKey()) {
    if(validateProfile(profile)) return [];
    const latest=history.filter(r=>!validateRecord(r)&&r.date<=start).sort((a,b)=>b.date.localeCompare(a.date))[0];
    let index=latest?(C.lifts.findIndex(l=>l.id===latest.lift)+1)%3:0;
    const result=[];
    for(let i=0;i<14;i++) {
      const d=new Date(start+'T12:00:00');d.setDate(d.getDate()+i);
      if(profile.days.includes(d.getDay())) {result.push({date:dateKey(d),lift:C.lifts[index].id,name:C.lifts[index].name});index=(index+1)%3;}
    }
    return result;
  }
  function createSession(plan) {
    if(plan.previewOnly)throw new Error('未来计划仅供预览，请在训练当天重新评估。');
    if(!plan.exercises.length) throw new Error('当前没有可开始的训练');
    if(plan.exercises.some(e=>!C.byId(e.id)||!numberIn(e.sets,1,8)||!Number.isInteger(Number(e.sets))||!numberIn(e.reps,1,300)||!Number.isInteger(Number(e.reps))||!(e.calibrationRequired&&e.weight===null)&&!numberIn(e.weight,0,600)))throw new Error('请填写有效重量、1–8 组和有效次数，再开始训练。');
    return {id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),date:plan.date,lift:plan.lift,mode:plan.mode,completed:false,rpe:7,sets:plan.exercises.flatMap(e=>Array.from({length:e.sets},(_,i)=>({key:e.id+'-'+i,exercise:e.id,name:e.name,unit:e.unit,weightUnit:e.weightUnit,loadConvention:e.loadConvention,machineId:e.machineId,measurement:e.measurement,calibrationRequired:!!e.calibrationRequired,selectionReason:e.selectionReason,doseReason:e.doseReason,loadSource:e.loadSource,index:i+1,weight:e.weight===null?'':e.weight,targetWeight:e.weight,targetSetCount:e.sets,reps:e.reps,targetReps:e.reps,capacity:e.capacity||null,targetRir:e.rir,rir:null,source:e.source||'',done:false,rest:e.rest}))),deadline:0};
  }
  const api={modes,dateKey,validDate,daysBetween,validateProfile,estimateMax,validateRecord,makePlan,planView,upcoming,createSession,prescribe,compatibleLoad};
  if(typeof module!=='undefined')module.exports=api;else globalThis.MusclePlanner=api;
})();
