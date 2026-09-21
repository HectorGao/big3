(function(){
  const P=typeof module!=='undefined'?require('./planner'):globalThis.MusclePlanner;
  const S=typeof module!=='undefined'?require('./science'):globalThis.MuscleScience;
  const C=typeof module!=='undefined'?require('./catalog'):globalThis.MuscleCatalog;
  const Release=typeof module!=='undefined'?require('./release'):globalThis.MuscleRelease;
  const labels={...P.modes,deload:'减量日',test:'PB 测试日',assessment:'次极限评估'};
  const add=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return P.dateKey(d);};
  const actual=(data,date)=>data.history.filter(r=>!P.validateRecord(r)&&r.date<=date).sort((a,b)=>b.date.localeCompare(a.date));
  const work=r=>r.sets.filter(s=>s.done&&!s.warmup&&!s.calibration&&s.success!==false&&s.quality!==false);
  const muscleRows=(r,id)=>r.sets.filter(s=>s.done&&C.byId(s.exercise)?.muscles.includes(id));
  function feedback(data,date){return (data.feedback||[]).find(f=>f.date===date)||null;}
  function recovery(data,date=P.dateKey(),input){
    const f=input||feedback(data,date),history=[...actual(data,date),...(data.calibrations||[]).filter(t=>t.date<=date).map(t=>({date:t.date,sets:[{...t,done:true}]}))].sort((a,b)=>b.date.localeCompare(a.date));
    return C.muscles.map(m=>{
      const recent=history.filter(r=>P.daysBetween(date,r.date)<=7&&muscleRows(r,m.id).length);
      const last=recent[0],days=last?P.daysBetween(date,last.date):null;
      const sets=recent.reduce((n,r)=>n+muscleRows(r,m.id).length,0);
      const hard=recent.reduce((n,r)=>n+muscleRows(r,m.id).filter(s=>s.rir!=null&&Number(s.rir)<=1).length,0);
      const soreness=Number(f?.soreness?.[m.id]||0);
      // ponytail: coarse recovery bands, not physiology; calibrate against longitudinal feedback, never display a percent.
      let level=!f?'unknown':'ready';
      if(days!==null&&days<2||soreness===2||f?.fatigue===3)level='reduce';
      if(days!==null&&days<1||soreness===3||f?.fatigue>=4||f?.pain)level='rest';
      if(days!==null&&days<3&&hard>=3)level=level==='rest'?'rest':'reduce';
      const label={unknown:'信息不足',ready:'可按计划',reduce:'建议减量',rest:'优先恢复'}[level];
      return {id:m.id,name:m.name,level,label,sets,hard,days,reason:(last?`最近 ${last.date}，7 天内 ${sets} 个相关负荷组（含试重）、${hard} 个近力竭组。`:'近 7 天无相关记录。')+(f?`疲劳 ${f.fatigue}/5，酸痛 ${soreness}/3。`:'缺少当天反馈，不能确认恢复。')};
    });
  }
  function achievements(data,date=P.dateKey()){
    return C.lifts.map(l=>{
      const points=[];const singles=[];
      const pb=data.profile?.pb[l.id];
      if(pb&&pb.date<=date){const e=S.estimatePB(pb.weight,pb.reps);if(pb.reps===1)singles.push({date:pb.date,weight:pb.weight,source:'档案声明的单次 PB'});else points.push({...e,date:pb.date,weight:pb.weight,reps:pb.reps,source:'档案多次组',confidence:'未记录余力',reliable:false});}
      for(const r of actual(data,date))for(const s of work(r).filter(s=>s.exercise===l.id&&s.weight>0&&s.reps<=10)){
        if(Number(s.reps)===1){if(s.pbAttempt===true&&s.quality===true)singles.push({date:r.date,weight:Number(s.weight),source:'确认合格的单次测试'});continue;}
        const e=S.estimatePB(s.weight,s.reps);if(!e)continue;
        const reliable=s.rir!=null&&Number(s.rir)<=2&&s.quality!==false;
        points.push({...e,date:r.date,weight:Number(s.weight),reps:Number(s.reps),rir:s.rir,source:'实际完成组',confidence:reliable?'近极限组估算':'余力不明或较多，仅作参考',reliable});
      }
      points.sort((a,b)=>a.date.localeCompare(b.date));
      const daily=[];for(const p of points){const prev=daily.find(x=>x.date===p.date);if(!prev)daily.push(p);else if((p.reliable&&!prev.reliable)||(p.reliable===prev.reliable&&p.low>prev.low))Object.assign(prev,p);}
      singles.sort((a,b)=>b.weight-a.weight);
      const qualified=daily.filter(p=>p.reliable&&P.daysBetween(date,p.date)<=90).slice(-3);
      const median=qualified.length>=2?[...qualified].sort((a,b)=>a.low-b.low)[Math.floor((qualified.length-1)/2)]:null;
      return {...l,measured:singles[0]||null,points:daily,latest:daily.at(-1)||null,baseline:median};
    });
  }
  function effectiveProfile(data,date){
    const p=JSON.parse(JSON.stringify(data.profile));
    for(const a of achievements(data,date)){
      // A historical estimate must not replace a newer, explicitly supplied PB.
      if(a.baseline&&(!p.pb[a.id]||p.pb[a.id].date>date||a.baseline.date>p.pb[a.id].date))p.pb[a.id]={weight:a.baseline.weight,reps:a.baseline.reps,date:a.baseline.date};
      if(a.measured&&a.measured.source!=='档案声明的单次 PB'&&(!p.pb[a.id]||a.measured.date>=p.pb[a.id].date))p.pb[a.id]={weight:a.measured.weight,reps:1,date:a.measured.date};
    }
    return p;
  }
  function testStatus(data,lift,date=P.dateKey(),input){
    const rows=actual(data,date).filter(r=>r.lift===lift&&r.completed&&work(r).some(s=>s.exercise===lift));
    const lastTest=rows.find(r=>r.mode==='test'||r.mode==='assessment');
    const stable=rows.slice(0,2).length===2&&rows.slice(0,2).every(r=>work(r).filter(s=>s.exercise===lift).every(s=>s.rir!=null&&s.rir>=2&&s.reps>=s.targetReps));
    const recovered=recovery(data,date,input).filter(m=>C.lifts.find(l=>l.id===lift).muscles.includes(m.id)).every(m=>m.level==='ready');
    const eligible=data.profile?.experience==='trained'&&rows.length>=4&&stable&&(!lastTest||P.daysBetween(date,lastTest.date)>=28);
    const prep=rows.find(r=>r.mode==='deload'&&P.daysBetween(date,r.date)>=3&&P.daysBetween(date,r.date)<=10);
    const request=(data.events||[]).filter(e=>e.kind==='test'&&e.lift===lift&&e.date<=date&&!data.history.some(r=>r.planId===e.id)).at(-1);
    return {eligible,recovered,ready:!!(eligible&&recovered&&prep&&request&&P.daysBetween(date,request.date)>=7),request,prep,
      reason:!eligible?'需至少四次同项训练、最近两次稳定表现，评估后至少间隔 28 天再筛查。':!recovered?'先补充当天恢复反馈或等待恢复。':!prep?'先实际完成减量，再评估测试准备情况。':'当天热身和保护条件确认后决定；不强制冲击极限。'};
  }
  const accessories={
    squat:{volume:['split','curl-leg','pallof'],intensity:['leg-extension','row','side-plank']},
    bench:{volume:['dbbench','row','pressdown'],intensity:['row','pressdown']},
    deadlift:{volume:['curl-leg','pulldown','pallof'],intensity:['curl-leg','row','deadbug']}
  };
  function prescription(data,lift,date=P.dateKey(),input,options={}){
    if(!C.lifts.some(l=>l.id===lift)||!P.validDate(date))throw Error('训练项目或日期无效');
    const requestedMode=options.mode||null;
    if(requestedMode&&!['volume','intensity','technique','recovery','deload','test','assessment'].includes(requestedMode))throw Error('训练日类型无效');
    const flags={viewDate:date,requestedMode,isToday:date===P.dateKey(),isSelectedDate:true,canStart:date===P.dateKey(),previewOnly:date!==P.dateKey()};
    if(P.validateProfile(data.profile))return {...P.makePlan({profile:data.profile,lift,date}),...flags,effectiveMode:'setup',adjustments:[],canStart:false,skipAllowed:false};
    const history=actual(data,date),f=input||feedback(data,date)||{fatigue:2,pain:false};
    const profile=effectiveProfile(data,date),related=recovery(data,date,input).filter(m=>C.lifts.find(l=>l.id===lift).muscles.includes(m.id));
    const limited=related.some(m=>m.days!==null&&m.days<2||m.days!==null&&m.days<3&&m.hard>=3||Number(f.soreness?.[m.id])>=2);
    const status=testStatus(data,lift,date,input),adjustments=[];
    const allowed=id=>!Array.isArray(profile.equipment)||profile.equipment.includes(C.byId(id).equipment);
    const primary=allowed(lift)?lift:{squat:['legpress','goblet','split'],bench:['machine-press','dbbench','pushup','cable-fly'],deadlift:['db-rdl','curl-leg','bridge']}[lift].find(allowed);
    if(!primary)return {...flags,lift,date,mode:'rest',label:labels.rest,effectiveMode:'rest',adjustments:['当前类型没有适合该项目的动作，请调整类型筛选。'],skipAllowed:true,exercises:[],canStart:false,fatigue:S.fatigueInfo(f.fatigue),readiness:f,recovery:related,reason:'不使用无关动作凑数。'};
    if(primary!==lift)adjustments.push('本次改为 '+C.byId(primary).name+' 为主的相关肌群训练，不等同于三大项专项练习，器械成绩不会更新三大项 PB。');
    const last=history.find(r=>r.lift===lift&&r.completed);
    let mode=requestedMode||options.suggestedMode||(last?.mode==='volume'?'intensity':'volume');
    const pb=profile.pb[lift];
    if(!requestedMode&&(profile.experience==='beginner'||!pb||P.daysBetween(date,pb.date)>180))mode='technique';
    if(!requestedMode&&status.request)mode=status.ready?(data.settings?.maxTesting?'test':'assessment'):'deload';
    if(mode==='test'&&(!data.settings?.maxTesting||!status.ready)){
      adjustments.push('暂不适合冲刺：'+(!data.settings?.maxTesting?'单次测试开关未开启。':status.reason)+' 改为次极限评估；恢复限制仍优先。');
      mode='assessment';
    }
    const established=history.filter(r=>r.lift===lift&&r.completed).length>=4;
    if((profile.experience==='beginner'&&!established||Number(profile.age)>=65)&&['intensity','assessment','test'].includes(mode)){
        adjustments.push(Number(profile.age)>=65?'65 岁及以上采用保守技术适应安排；这不是年龄换算力量的公式，进阶需结合个体评估。':'尚未建立至少四次稳定同项记录，先用技术日练习动作与余力判断。');mode='technique';
    }
    const latest=history.find(r=>r.lift===lift),highEffort=latest&&P.daysBetween(date,latest.date)<=7&&Number(latest.rpe)>=9;
    if(limited||Number(f.fatigue)>=4||highEffort){
      adjustments.push('已降级为恢复日：'+related.filter(m=>m.level==='reduce'||m.level==='rest').map(m=>m.name+'（'+m.reason+'）').join('；'));
      if(highEffort)adjustments.push('最近同项目主观强度达到 9–10，先减少负荷；这不替代逐组余力记录。');
      if(Number(f.fatigue)>=4)adjustments.push('当天疲劳为 '+f.fatigue+' 档，优先减少负荷与工作组。');
      mode='recovery';
    }
    if(f.pain||Number(f.fatigue)>=5){
      adjustments.push('疼痛、明显不适或疲劳 5 档，不生成负重建议。');
      return {...flags,lift,date,mode:'rest',label:labels.rest,effectiveMode:'rest',adjustments,skipAllowed:true,exercises:[],canStart:false,fatigue:S.fatigueInfo(f.fatigue),recovery:related,reason:adjustments.join(' ')};
    }
    if(primary!==lift&&['test','assessment'].includes(mode)){mode='volume';adjustments.push('当前不是三大项原动作，改为相关肌群容量训练，不进行极限测试。');}
    const muscle=profile.goal==='muscle',beginner=profile.experience==='beginner';
    const doses={volume:[beginner?2:3,lift==='deadlift'?5:muscle?8:6,3,180],intensity:[lift==='deadlift'?2:3,3,2,240],technique:[2,5,4,120],recovery:[2,5,5,120],deload:[2,lift==='deadlift'?5:6,4,180],assessment:[1,5,2,240],test:[1,1,1,300]};
    const normal=history.find(r=>r.lift===lift&&r.completed&&['volume','intensity'].includes(r.mode));
    if(mode==='deload')doses.deload[0]=Math.max(1,Math.ceil((normal?work(normal).filter(s=>s.exercise===lift).length:3)/2));
    if(primary!==lift&&mode==='intensity')doses.intensity=[2,6,3,180];
    if(Number(f.fatigue)===4)doses.recovery[0]=1;
    const [sets,reps,rir,rest]=doses[mode];
    let ids=accessories[lift][mode==='intensity'?'intensity':'volume'].slice();
    if(['recovery','technique'].includes(mode))ids=['deadbug'];
    if(mode==='test'||mode==='assessment')ids=[];
    if(mode==='deload')ids=ids.slice(0,2);
    if(beginner)ids=ids.slice(0,2);
    // Low-frequency cross-lift work replaces an accessory; it is not a diagnosed weakness.
    let supplement=null;
    const projected=options.projected||[];
    if(profile.days.length<=2&&mode==='volume'&&Number(f.fatigue)<=2&&!beginner){
      const candidate=lift==='bench'?'goblet':'dbbench',e=C.byId(candidate);
      const covered=history.filter(r=>P.daysBetween(date,r.date)<7).flatMap(work).some(s=>C.byId(s.exercise).primaryMuscles.some(m=>e.primaryMuscles.includes(m)))||projected.filter(p=>P.daysBetween(date,p.date)<7).some(p=>p.exercises.some(x=>x.primaryMuscles.some(m=>e.primaryMuscles.includes(m))));
      const available=recovery(data,date,input).filter(m=>e.primaryMuscles.includes(m.id)).every(m=>!['reduce','rest'].includes(m.level));
      if(!covered&&available){supplement=candidate;ids=[...ids.slice(0,2),candidate];adjustments.push('可训练日较少，以 '+e.name+' 补足本周另一类动作，替换一个辅助，不额外堆组。');}
    }
    const equipment=profile.equipment;
    if(Array.isArray(equipment))ids=ids.map(id=>{
      const e=C.byId(id);if(equipment.includes(e.equipment))return id;
      const substitute=e.alternatives.map(C.byId).find(x=>equipment.includes(x.equipment)&&!x.fatigueTags.includes('腰背承重')&&x.muscles.some(m=>e.muscles.includes(m)));
      if(substitute){adjustments.push(e.name+' 器械不可用，改为 '+substitute.name+'；作用不完全等价，重新确认负荷。');return substitute.id;}
      adjustments.push(e.name+' 器械不可用，本次省略。');return null;
    }).filter((id,index,list)=>id&&list.indexOf(id)===index);
    // Weekly cap is a conservative product rule, not a measured recovery threshold.
    ids=ids.filter(id=>{
      const e=C.byId(id),statusRows=recovery(data,date,input).filter(m=>e.muscles.includes(m.id));
      if(statusRows.some(m=>Number(f.soreness?.[m.id])>=2)){adjustments.push(e.name+' 因相关肌群明显酸痛暂不安排。');return false;}
      const week=history.filter(r=>P.daysBetween(date,r.date)<7).flatMap(work).filter(s=>s.exercise===id).length;
      const forecast=projected.filter(p=>P.daysBetween(date,p.date)<7).reduce((n,p)=>n+p.exercises.filter(x=>x.id===id).reduce((a,x)=>a+x.sets,0),0);
      if(week+forecast>=10){adjustments.push(e.name+' 近七天实际 '+week+' 组'+(forecast?'，另有预计 '+forecast+' 组':'')+'，本次不再叠加；预计组不计实际统计。');return false;}
      return true;
    });
    const exercises=[primary,...ids.filter(id=>id!==primary)].map((id,index)=>{
      const e=C.byId(id),main=index===0;
      const count=main?sets:mode==='recovery'||mode==='deload'||mode==='technique'?1:2;
      const repeats=main?reps:e.unit==='秒'?20:e.group==='core'?8:e.isolation?12:10;
      const reserve=main?rir:Math.max(3,rir);
      const result=P.prescribe(id,profile,history,mode,{sets:count,reps:repeats,rir:reserve,main,date,calibrations:data.calibrations||[],machineId:profile.machineIds?.[id]||'default'});
      result.rest=main?rest:e.group==='core'?90:120;
      result.selectionReason=main?(primary===lift?'直接练习'+C.lifts.find(l=>l.id===lift).name+'专项动作，保留可比较的同动作记录。':'按已选器械训练相关肌群；'+e.purpose+'。这不是三大项等价替代。'):e.purpose+'；'+(lift==='deadlift'?'重硬拉后避免重复高腰背负担。':'补充主项需要的训练量，不根据模板猜测个人弱项。');
      if(id===supplement)result.selectionReason='补足本周训练：可训练日较少，近期没有对应动作模式的实际训练。此动作不是主项专项辅助，也不代表发现个人弱点。';
      applyReadiness(result,f.fatigue,mode);
      if(mode==='test'){
        const pb=S.estimatePB(profile.pb[lift]?.weight,profile.pb[lift]?.reps);
        if(pb){result.weight=S.roundLoad(pb.low*.9,Number(profile.increment));result.loadSource='近期同项能力约 90% 的保守首试；后续逐次确认，不预排极限。';result.calibrationRequired=false;}
      }
      result.doseReason=labels[mode]+'：'+result.sets+' 组，每组 '+result.reps+' '+e.unit+'，'+(e.unit==='秒'?'以呼吸和姿势稳定为停止标准。':'预计还能做 '+result.rir+' 次。')+' 休息 '+result.rest+' 秒。'+(Number(f.fatigue)===3?' 已计入当天中等疲劳的降量调整。':'');
      result.prescribedSets=Array.from({length:result.sets},(_,i)=>({index:i+1,weight:result.weight,reps:result.reps,rir:result.rir,rest:result.rest}));
      return result;
    });
    const main=exercises[0],warmupSets=main.weight>0?[{weight:S.roundLoad(main.weight*.4,Number(profile.increment)),reps:5},{weight:S.roundLoad(main.weight*.65,Number(profile.increment)),reps:3},{weight:S.roundLoad(main.weight*.8,Number(profile.increment)),reps:1}].filter(s=>s.weight>0&&s.weight<main.weight):[];
    return {...flags,lift,date,primaryExerciseId:primary,specialist:primary===lift,mode,label:labels[mode],researchContext:{schema:1,date,plannerVersion:Release?.version||null,build:Release?.build||null,profile:{age:profile.age,weight:profile.weight,experience:profile.experience,goal:profile.goal}},readiness:JSON.parse(JSON.stringify(f)),effectiveMode:mode,adjustments,skipAllowed:['recovery','deload'].includes(mode),exercises,fatigue:S.fatigueInfo(f.fatigue),recovery:related,testStatus:status,planId:['test','assessment'].includes(mode)&&status.request?status.request.id:date+':'+lift,
      reason:'先依据当天恢复限制，再按训练日目标选择动作；辅助重量只来自同动作记录或已确认试重。 '+(status.request?status.reason:'未来建议不计实际负荷。'),
      warmup:['轻活动 5–8 分钟，再逐组接近工作重量。','待试重动作先用可控轻负荷确认动作，不以试重冲击极限。','热身时疼痛、动作失控或余力不足，停止或减量。'],warmupSets,rpe:mode==='test'?'逐次确认':String(10-main.rir),estimatedMinutes:exercises.length>2?50:25,trainingMax:main.capacity,scienceNote:'组次、间隔与试重阈值是可校准的产品规则，不保证个人最优效果。'};
  }
  function rolling(data,start=P.dateKey()){
    if(P.validateProfile(data.profile))return [];
    const result=[],history=actual(data,start),virtual=[];
    const consumed=new Set(data.history.map(r=>r.planId).filter(Boolean));
    for(let i=0;i<14;i++){
      const date=add(start,i),events=(data.events||[]).filter(e=>e.date===date&&!consumed.has(e.id));
      const completed=history.filter(r=>r.date===date);
      if(completed.length){result.push({date,mode:'completed',label:'已记录',records:completed,exercises:[],reason:'只统计实际完成组'});continue;}
      if(events.some(e=>e.kind==='skip'||e.kind==='defer')){result.push({date,mode:'rest',label:events.some(e=>e.kind==='defer')?'已延期':'已跳过',exercises:[],reason:'不计实际训练量；后续按实际记录重算'});continue;}
      const forced=(data.events||[]).find(e=>e.kind==='defer'&&e.to===date&&!consumed.has(e.id));
      if(!forced&&!data.profile.days.includes(new Date(date+'T12:00:00').getDay())){result.push({date,mode:'rest',label:'休息日',exercises:[],reason:'非偏好训练日，仍可自由选择项目'});continue;}
      const candidates=C.lifts.map((l,index)=>{
        const recent=[...virtual,...history].filter(r=>r.lift===l.id).sort((a,b)=>b.date.localeCompare(a.date));
        const last=recent[0],gap=last?P.daysBetween(date,last.date):99;
        const lower=l.id!=='bench'?[...virtual,...history].find(r=>(r.lift!=='bench'||r.exercises?.some(e=>e.group==='squat'||e.group==='hinge'))&&P.daysBetween(date,r.date)<2):null;
        const upper=l.id==='bench'?virtual.find(r=>P.daysBetween(date,r.date)<2&&r.exercises?.some(e=>e.primaryMuscles.includes('chest'))):null;
        const count=[...virtual,...history].filter(r=>r.lift===l.id&&P.daysBetween(date,r.date)<14).length;
        return {...l,index,gap,count,blocked:gap<2||!!lower||!!upper};
      }).sort((a,b)=>Number(a.blocked)-Number(b.blocked)||a.count-b.count||b.gap-a.gap||a.index-b.index);
      const chosen=forced?candidates.find(l=>l.id===forced.lift):candidates[0];
      if(chosen.blocked&&!forced){result.push({date,mode:'rest',label:'恢复间隔',exercises:[],reason:'预计相关负荷密集，不把漏练补成连续大重量'});continue;}
      const f=i===0?feedback(data,date):{fatigue:2,pain:false};
      const last=[...virtual,...history].find(r=>r.lift===chosen.id);
      const mode=chosen.blocked?'recovery':last?.mode==='volume'?'intensity':'volume';
      const plan=prescription(data,chosen.id,date,f,{suggestedMode:mode,projected:virtual});
      if(i>0&&plan.testStatus?.request&&P.daysBetween(date,plan.testStatus.request.date)>=7&&plan.testStatus.eligible&&plan.mode==='deload'){
        plan.label=data.settings.maxTesting?'PB 测试候选':'次极限评估候选';plan.reason+=' 仅候选窗口：必须实际完成减量并通过当天检查，否则继续延期。';
      }
      if(forced)plan.planId=forced.id;
      if(i>0)plan.reason+=' 预计恢复正常，未假设力量增长。';
      result.push(plan);if(plan.exercises.length)virtual.unshift({date,lift:chosen.id,mode:plan.mode,exercises:plan.exercises});
    }
    return result;
  }
  function frozenPlan(s){
 const exercises=[...new Set(s.sets.map(r=>r.exercise))].map(id=>{
  const rows=s.sets.filter(r=>r.exercise===id),r=rows[0],e=C.byId(id);
  return {...e,main:id===(s.primaryExerciseId||s.lift),sets:rows.length,reps:r.targetReps||r.reps,weight:r.targetWeight??null,rir:r.targetRir,rest:r.rest,calibrationRequired:r.targetWeight==null,loadSource:r.loadSource,selectionReason:r.selectionReason,doseReason:r.doseReason,prescribedSets:rows.map(x=>({weight:x.targetWeight,reps:x.targetReps,rir:x.targetRir}))};
 });
 return {lift:s.lift,date:s.date,mode:s.mode,label:labels[s.mode],exercises,canStart:false,skipAllowed:false,requestedMode:s.requestedMode,adjustments:s.adjustments||[],fatigue:S.fatigueInfo(s.readiness?.fatigue||2),estimatedMinutes:45,rpe:s.rpe,reason:'进行中训练的原定目标。实际填写的重量、次数和完成状态保留在当前训练中。'};
}
  function overview(data,date=P.dateKey()){
    const history=actual(data,date),schedule=rolling(data,date);
    const trends=C.lifts.map(l=>({...l,weeks:Array.from({length:8},(_,i)=>{
      const end=add(date,-(7-i)*7),start=add(end,-6);const rows=history.filter(r=>r.date>=start&&r.date<=end).flatMap(work).filter(s=>s.exercise===l.id);
      return {start,end,sets:rows.length,volume:rows.reduce((n,s)=>n+Number(s.weight)*Number(s.reps),0)};
    }),count:history.filter(r=>r.lift===l.id&&P.daysBetween(date,r.date)<28).length}));
    return {schedule,trends,achievements:achievements(data,date),recovery:recovery(data,date),recent:history.slice(0,5),next:schedule.find(p=>p.exercises.length)||null};
  }
  function applyReadiness(e,value,mode){
    const f=S.fatigueInfo(value);
    if(value>=5)return e;
    if(!['recovery','deload'].includes(mode)&&[2,3].includes(Number(value))){
      if(e.weight!==null&&e.weight>0)e.weight=e.loadConvention==='assistance'?e.weight+e.increment:S.roundLoad(e.weight*f.load,e.increment);
      e.sets=Math.max(1,e.sets+f.sets);e.rir=e.unit==='秒'?null:Math.min(5,(e.rir||3)+f.rir);
      e.loadSource+='；疲劳 '+value+' 档保守调整（产品规则，需热身核对）';e.source=e.loadSource;
    }
    return e;
  }
  function chooseExercise(data,plan,id,replaceId){
    const e=C.byId(id),old=replaceId&&plan.exercises.find(x=>x.id===replaceId);
    if(!e||replaceId&&!old||old?.main)throw Error('不能替换主导动作');
    if(['rest','setup','test','assessment'].includes(plan.mode)||plan.readiness?.pain||plan.readiness?.fatigue>=5)throw Error('本日不添加负重动作');
    if(plan.exercises.some(x=>x.id===id))throw Error('计划已包含该动作');
    if(data.profile.equipment&&!data.profile.equipment.includes(e.equipment))throw Error('该器械类型未勾选');
    if(old&&!e.muscles.some(m=>old.muscles.includes(m)))throw Error('与被替换动作无共同目标肌群');
    if((plan.lift==='deadlift'||['recovery','deload'].includes(plan.mode))&&e.fatigueTags.includes('腰背承重'))throw Error('本日不额外叠加腰背承重');
    const status=recovery(data,plan.date,plan.readiness);
    if(status.some(m=>e.muscles.includes(m.id)&&(Number(plan.readiness?.soreness?.[m.id])>=2||m.days!==null&&m.days<1)))throw Error('相关肌群需要恢复');
    const light=['recovery','technique','deload'].includes(plan.mode);
    const technical=['front-squat','pause-squat','tempo-squat','pause-bench','close-bench','sumo'].includes(id);
    const count=old?.sets||(light?1:2),limit=light?4:data.profile.experience==='beginner'?14:24;
    if(!old&&(plan.exercises.length>=8||plan.exercises.reduce((n,x)=>n+x.sets,0)+count>limit))throw Error('本日已达到保守训练量上限，不再加组');
    const weeks=actual(data,plan.date).filter(r=>P.daysBetween(plan.date,r.date)<7).flatMap(work).filter(s=>s.exercise===id).length;
    if(weeks+count>10)throw Error('该动作近期组数较多，暂不继续叠加');
    const result=P.prescribe(id,effectiveProfile(data,plan.date),actual(data,plan.date),plan.mode,{sets:count,reps:e.unit==='秒'?20:technical?5:e.group==='core'?8:e.isolation?12:10,rir:light?5:technical?4:3,date:plan.date,calibrations:data.calibrations||[],machineId:data.profile.machineIds?.[id]||'default'});
    applyReadiness(result,plan.readiness?.fatigue||2,plan.mode);
    if(old)result.sets=old.sets;
    if(technical)result.rest=180;
    result.selectionReason=(old?'用户替换 '+old.name+'；':'用户补充训练；')+e.purpose+'。不代表已识别个人弱项，重量独立校准。';
    result.doseReason=(technical?'技术变式采用低次数和较长休息，优先保持动作质量（产品规则）。':'')+result.sets+' 组 × '+result.reps+' '+e.unit+'；'+(result.rir===null?'以姿势稳定为准':'预计还能做 '+result.rir+' 次')+'，休息 '+result.rest+' 秒。';
    result.prescribedSets=Array.from({length:result.sets},(_,i)=>({index:i+1,weight:result.weight,reps:result.reps,rir:result.rir,rest:result.rest}));
    return result;
  }
  function exerciseOptions(data,plan,{muscle,equipment,query='',replaceId}={}){
    return C.exercises.filter(e=>(!muscle||e.muscles.includes(muscle))&&(!equipment||e.equipment===equipment)&&(e.name+' '+e.en).toLowerCase().includes(query.toLowerCase())).map(e=>{
      let disabledReason='';try{chooseExercise(data,plan,e.id,replaceId);}catch(error){disabledReason=error.message;}
      return {...e,disabledReason};
    });
  }
  function replaceExercise(data,plan,originalId,replacementId){
    const original=plan.exercises.find(e=>e.id===originalId),next=C.byId(replacementId);
    if(!original||original.main||!original.alternatives.includes(replacementId)||!next)throw Error('不能替换为该动作');
    if(plan.exercises.some(e=>e.id===replacementId))throw Error('计划中已有该动作，不重复叠加');
    if((plan.lift==='deadlift'||['recovery','deload'].includes(plan.mode))&&next.fatigueTags.includes('腰背承重'))throw Error('本日不叠加腰背承重动作');
    if(data.profile.equipment&&!data.profile.equipment.includes(next.equipment))throw Error('该动作类型未勾选');
    if(recovery(data,plan.date,plan.readiness).some(m=>next.muscles.includes(m.id)&&(m.level==='rest'||Number(plan.readiness?.soreness?.[m.id])>=2)))throw Error('替代动作的相关肌群需先恢复');
    const reserve=Math.max(original.rir??3,plan.mode==='recovery'?5:['technique','deload'].includes(plan.mode)?4:3);
    const e=P.prescribe(next.id,data.profile,actual(data,plan.date),plan.mode,{sets:original.sets,reps:next.unit==='秒'?20:next.group==='core'?8:next.isolation?12:10,rir:reserve,date:plan.date,calibrations:data.calibrations||[],machineId:data.profile.machineIds?.[next.id]||'default'});
    e.selectionReason='用户替换 '+original.name+'；'+next.purpose+'。替代作用不完全相同，不沿用原动作能力。';
    e.doseReason=e.sets+' 组 × '+e.reps+' '+e.unit+'，'+(e.rir===null?'以姿势稳定为停止标准':'预计还能做 '+e.rir+' 次');
    e.prescribedSets=Array.from({length:e.sets},(_,i)=>({index:i+1,weight:e.weight,reps:e.reps,rir:e.rir,rest:e.rest}));
    return e;
  }
  function replacementOptions(data,plan,id){
    return (plan.exercises.find(e=>e.id===id)?.alternatives||[]).filter(next=>{try{replaceExercise(data,plan,id,next);return true;}catch{return false;}}).map(C.byId);
  }
  function session(plan){
    if(!plan.canStart||plan.previewOnly)throw Error('未来或过去日期只能查看建议，请在实际训练日期重新评估');
    const s=P.createSession(plan);
    return {...s,primaryExerciseId:plan.primaryExerciseId||plan.lift,specialist:plan.specialist!==false,planId:plan.planId,requestedMode:plan.requestedMode,effectiveMode:plan.effectiveMode||plan.mode,adjustments:plan.adjustments||[],readiness:plan.readiness||{fatigue:plan.fatigue.value,pain:false},sets:s.sets.map(row=>({...row,quality:true,success:true,pbAttempt:plan.mode==='test'}))};
  }
  function nextAttempt(s,profile){
    if(s.mode!=='test'||!s.protectionConfirmed)throw Error('请先确认保护条件');
    const rows=s.sets.filter(r=>r.exercise===s.lift),last=rows.at(-1);
    if(rows.length>=3||!last.done||last.success===false||last.quality===false||last.rir==null||last.rir<1||s.stopTest)throw Error('测试已结束或条件不足，不再加重');
    const step=Number(profile.increment);if(step/last.weight>.05)throw Error('器械档位过大，停止加重');
    return {...s,sets:[...s.sets,{...last,key:s.lift+'-'+rows.length,index:rows.length+1,weight:Number(last.weight)+step,targetWeight:Number(last.weight)+step,done:false,rir:null}]};
  }
  const api={labels,add,feedback,recovery,achievements,testStatus,prescription,rolling,overview,session,nextAttempt,replaceExercise,replacementOptions,frozenPlan,chooseExercise,exerciseOptions,applyReadiness};
  if(typeof module!=='undefined')module.exports=api;else globalThis.MuscleCoach=api;
})();
