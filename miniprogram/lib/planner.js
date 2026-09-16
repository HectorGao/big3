(function () {
  const C = typeof module !== 'undefined' ? require('./catalog') : globalThis.MuscleCatalog;
  const S = typeof module !== 'undefined' ? require('./science') : globalThis.MuscleScience;
  const modes = { setup:'完善资料', volume:'容量日', intensity:'强度日', recovery:'恢复日', technique:'技术日', rest:'休息日' };
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
  const starters={squat:[0.15,10],bench:[0.10,10],deadlift:[0.20,15],goblet:[0.08,6],split:[0.04,4],legpress:[0.20,15],dbbench:[0.05,5],lateral:[0.025,2],pressdown:[0.06,5],rdl:[0.15,10],'db-rdl':[0.06,5],sumo:[0.20,15],'curl-leg':[0.06,5],row:[0.06,5],pulldown:[0.12,10],facepull:[0.04,4],curl:[0.03,3]};
  function prescribe(id,profile,history,mode,{sets=2,reps=10,rir=3,main=false,date=dateKey()}={}) {
    const ex=C.byId(id);if(!ex)throw Error('未知动作');
    const increment=ex.equipment==='哑铃'?0.5:Number(profile.increment);
    const effort=(mode==='recovery'||mode==='technique')?4:rir;
    const prior=history.find(r=>r.sets.some(s=>s.exercise===id&&s.done));
    const rows=prior?prior.sets.filter(s=>s.exercise===id&&s.done):[];
    let capacity=null,weight=0,source='自重 · 额外负重 0 kg',calibration=false;
    const pb=profile.pb[id];const estimate=pb&&S.estimatePB(pb.weight,pb.reps,profile.weight);
    if(estimate && daysBetween(date,pb.date)>=0 && daysBetween(date,pb.date)<=180){
      capacity=S.trainingMax(profile,estimate);
      const rated=rows.length&&rows.every(s=>s.rir!==null&&s.rir!==undefined&&Number(s.rir)>=0&&Number(s.rir)<=5);
      const previousRecord=history.filter(r=>r.sets.some(s=>s.exercise===id&&s.done))[1];
      if(rated&&prior.completed&&previousRecord&&previousRecord.sets.filter(s=>s.exercise===id&&s.done).every(s=>s.rir!=null&&s.rir>=3&&s.reps>=(s.targetReps||reps))&&rows.every(s=>Number(s.reps)>=Number(s.targetReps||reps)&&Number(s.rir)>=3)) {
        const previous=Number(rows[0].capacity)||capacity;
        capacity=Math.min(previous*1.025,estimate.low*1.1);
      }
      weight=S.loadForReps(capacity,reps,effort,increment);
      if(mode==='technique'||mode==='recovery')weight=S.roundLoad(capacity*(mode==='recovery'?0.50:0.55),increment);
      source=capacity>S.trainingMax(profile,estimate)?'同动作完成且余力充足 · 基准递增 2.5%':'PB 估算 → 保守训练基准';
      // Recent performance limits a stale high PB; it never inflates the PB itself.
      if(rows.length&&prior.completed===false){const last=Number(rows[0].weight);if(last>0){weight=Math.min(weight,S.roundLoad(last*0.95,increment));source='上次未完成 · 减重重建';}}
    }else if(ex.equipment!=='自重'&&rows.length){
      const last=rows[0];weight=Number(last.weight);source='沿用同动作最近记录';
      const rated=rows.every(s=>s.rir!==null&&s.rir!==undefined&&Number.isFinite(Number(s.rir))&&Number(s.rir)>=0&&Number(s.rir)<=5);
      const exceeded=rows.every(s=>Number(s.reps)>=Number(s.targetReps||reps)+1 && Number(s.rir)>=2);
      const previousRecord=history.filter(r=>r.sets.some(s=>s.exercise===id&&s.done))[1];
      if(rated&&exceeded&&previousRecord&&previousRecord.sets.filter(s=>s.exercise===id&&s.done).every(s=>s.rir!=null&&s.rir>=3&&s.reps>=(s.targetReps||reps))){const step=weight>0?increment/weight:1;if(step<=0.05){weight+=increment;source='连续两次同动作达到目标且余力充足 · 递增一档';}}
      if(rated&&rows.some(s=>Number(s.rir)<=1)||rows.some(s=>s.targetReps&&Number(s.reps)<Number(s.targetReps))){weight=S.roundLoad(weight*0.95,increment);source='同动作余力不足或未达次数 · 降重';}
      const usable=rows.find(s=>Number(s.weight)>0&&Number(s.reps)<=10&&s.rir!==undefined&&s.rir!==null);
      if(usable)capacity=Number(usable.weight)*(1+(Number(usable.reps)+Number(usable.rir))/30);
      if(mode==='recovery'||mode==='technique'){weight=S.roundLoad(weight*0.7,increment);source+=' · 轻量日';}
    }else if(ex.equipment!=='自重'){
      const [ratio,ceiling]=starters[id];const margin=profile.experience==='beginner'||Number(profile.age)>=65?0.75:1;
      weight=S.roundLoad(Math.min(Number(profile.weight)*ratio,ceiling)*margin,increment);
      weight=Math.max(ex.equipment==='哑铃'?0.5:Math.min(increment,ceiling),weight);calibration=true;source='首次试重 · 经验起点，需热身校准';
      if(mode==='recovery')weight=S.roundLoad(weight*0.7,increment);
    }
    return {...ex,sets,reps,weight:S.roundLoad(Math.max(0,weight),increment),capacity:capacity?Math.round(capacity*10)/10:null,rir:ex.unit==='秒'?null:effort,source,calibration,rest:main?mode==='intensity'?180:120:90,main};
  }
  function validateRecord(r) {
    if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||!validDate(r.date)||r.date>dateKey()||!C.lifts.some(l=>l.id===r.lift)) return '训练记录标识或日期无效。';
    if(!['volume','intensity','recovery','technique','deload','test','assessment','manual'].includes(r.mode)||typeof r.completed!=='boolean'||!numberIn(r.rpe,1,10)) return '训练类型或用力程度无效。';
    if(!Array.isArray(r.sets)||!r.sets.length||r.sets.length>100||!r.sets.some(s=>s.done)) return '至少需要一组实际完成记录。';
    for(const s of r.sets) if(!s||!C.byId(s.exercise)||typeof s.done!=='boolean'||!numberIn(s.weight,0,600)||!numberIn(s.reps,1,300)||!Number.isInteger(Number(s.reps))||s.targetReps!==undefined&&(!numberIn(s.targetReps,1,300)||!Number.isInteger(Number(s.targetReps)))) return '每组需填写有效重量和次数。';
    if(r.completed && !r.sets.some(s=>s.exercise===r.lift&&s.done)) return '完成主项后才能推进周期。';
    if(r.sets.some(s=>s.rir!==null&&s.rir!==undefined&&(!numberIn(s.rir,0,5)||!Number.isInteger(Number(s.rir)))))return '每组剩余次数需为 0–5 或留空。';
    if(r.sets.some(s=>s.capacity!==null&&s.capacity!==undefined&&!numberIn(s.capacity,0.1,1000)))return '训练基准无效。';
    if(r.completed && r.sets.some(s=>s.exercise===r.lift&&(!s.done || s.targetReps!==undefined&&Number(s.reps)<Number(s.targetReps)))) return '主项次数未达到目标，不能标记完成。';
    return null;
  }
  function makePlan({profile,history=[],lift='squat',date=dateKey(),readiness={}}) {
    if(!C.lifts.some(l=>l.id===lift)||!validDate(date)) throw new Error('训练项目或日期无效');
    const fatigue=S.fatigueInfo(readiness.fatigue===undefined?2:readiness.fatigue);
    const base={lift,date,exercises:[],warmup:[],mode:'setup',label:modes.setup,reason:validateProfile(profile),rpe:'',percent:null,fatigue};
    if(base.reason) return base;
    const prior=history.filter(r=>!validateRecord(r)&&r.date<=date).sort((a,b)=>b.date.localeCompare(a.date));
    const primaryMuscles={squat:['quads','glutes'],bench:['chest','triceps'],deadlift:['hamstrings','glutes','lowerback']}[lift];
    const related=prior.find(r=>r.lift===lift||(lift!=='bench'&&r.lift!=='bench')||r.sets.some(s=>s.done&&C.byId(s.exercise).muscles.some(m=>primaryMuscles.includes(m))));
    const last=prior.find(r=>r.lift===lift&&r.completed);
    const recent=prior.find(r=>r.lift===lift);
    const pb=profile.pb[lift];
    const fresh=pb && daysBetween(date,pb.date)>=0 && daysBetween(date,pb.date)<=180;
    let mode='volume',reason='本轮从容量训练开始，保留余力，记录真实完成情况。';
    if(last) {
      mode={volume:'intensity',intensity:'recovery',recovery:'volume',technique:'volume'}[last.mode];
      reason='根据上一次完成的同主项训练安排下一阶段，漏练不会自动推进周期。';
    }
    if(!fresh||profile.experience==='beginner'||Number(profile.age)>=65||(last&&daysBetween(date,last.date)>21)) {
      mode='technique';reason=!fresh?'没有近期 PB，先用轻负荷建立动作与用力记录；不需要测试极限。':'采用技术适应模板，先确认动作与恢复，再考虑增加负荷。';
    }
    if(Number(readiness.fatigue)>=4||recent&&Number(recent.rpe)>=9) {
      mode='recovery';reason='当前疲劳较高或上次接近力竭，减少负荷和组数，不安排强度训练。';
    }
    if(readiness.pain===true||fatigue.value===5||(related&&daysBetween(date,related.date)<2)) {
      return {...base,mode:'rest',label:modes.rest,reason:readiness.pain?'存在疼痛或不适，今天不生成负重计划；持续或明显不适请寻求专业评估。':fatigue.value===5?'疲劳 5 档，今天休息；未来计划只能预览，不能当作今天训练许可。':'距离相关训练不足两天，今天先恢复，避免重复负荷。'};
    }
    // ponytail: deterministic templates, not individualized prescriptions; coach-reviewed rules before clinical or competition use.
    const muscleGoal=profile.goal==='muscle';
    const template={volume:[3,muscleGoal?8:5,3,'6–7'],intensity:[3,muscleGoal?6:3,2,'7–8'],recovery:[2,8,4,'≤6'],technique:[2,8,4,'5–6']}[mode];
    const [sets,reps,rir,rpe]=template;
    const main=prescribe(lift,profile,prior,mode,{sets,reps,rir,main:true,date});
    const assistance={squat:['split','dbbench','row','plank'],bench:['row','goblet','lateral','pressdown'],deadlift:['goblet','dbbench','pulldown','deadbug']}[lift];
    const count=['recovery','technique'].includes(mode)?2:4;
    const exercises=[main,...assistance.slice(0,count).map(id=>prescribe(id,profile,prior,mode,{sets:mode==='recovery'?1:mode==='volume'&&muscleGoal?3:2,reps:id==='plank'?25:id==='deadbug'?8:muscleGoal?12:10,rir:3,date}))];
    if(fatigue.value===3){for(const e of exercises){e.weight=S.roundLoad(e.weight*fatigue.load,e.equipment==='哑铃'?0.5:Number(profile.increment));e.sets=Math.max(1,e.sets+fatigue.sets);if(e.rir!==null)e.rir+=fatigue.rir;e.source+=' · 中等疲劳降量';}reason+=' '+fatigue.action;}
    const estimate=fresh?S.estimatePB(pb.weight,pb.reps,profile.weight):null;
    return {...base,mode,label:modes[mode],reason,rpe,estimate,trainingMax:main.capacity||S.trainingMax(profile,estimate),percent:estimate?Math.round(main.weight/estimate.low*100):null,exercises,warmup:['先进行 5–8 分钟轻活动与关节活动。','先以更轻重量热身；首次试重不是能力预测。器械最小负荷过重时换用更轻器械。'],estimatedMinutes:mode==='recovery'?25:mode==='technique'?30:55,scienceNote:'重量与次数为可调整起点。每组保留目标余力，记录实际完成与 RIR，再校准下一次。'};
  }
  function planView(args){
    const today=makePlan(args);
    if(today.mode!=='rest')return {...today,canStart:today.exercises.length>0,previewOnly:false,blockedReason:''};
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
    if(plan.exercises.some(e=>!C.byId(e.id)||!numberIn(e.sets,1,8)||!Number.isInteger(Number(e.sets))||!numberIn(e.reps,1,300)||!Number.isInteger(Number(e.reps))||!numberIn(e.weight,0,600)))throw new Error('请填写有效重量、1–8 组和有效次数，再开始训练。');
    return {id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),date:plan.date,lift:plan.lift,mode:plan.mode,completed:false,rpe:7,sets:plan.exercises.flatMap(e=>Array.from({length:e.sets},(_,i)=>({key:e.id+'-'+i,exercise:e.id,name:e.name,unit:e.unit,weightUnit:e.weightUnit,index:i+1,weight:e.weight===null?'':e.weight,reps:e.reps,targetReps:e.reps,capacity:e.capacity||null,targetRir:e.rir,rir:null,source:e.source||'',done:false,rest:e.rest}))),deadline:0};
  }
  const api={modes,dateKey,validDate,daysBetween,validateProfile,estimateMax,validateRecord,makePlan,planView,upcoming,createSession,prescribe};
  if(typeof module!=='undefined')module.exports=api;else globalThis.MusclePlanner=api;
})();
