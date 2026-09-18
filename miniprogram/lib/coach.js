(function(){
  const P=typeof module!=='undefined'?require('./planner'):globalThis.MusclePlanner;
  const S=typeof module!=='undefined'?require('./science'):globalThis.MuscleScience;
  const C=typeof module!=='undefined'?require('./catalog'):globalThis.MuscleCatalog;
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
    for(const a of achievements(data,date)){if(a.baseline)p.pb[a.id]={weight:a.baseline.weight,reps:a.baseline.reps,date:a.baseline.date};if(a.measured&&a.measured.source!=='档案声明的单次 PB'&&(!p.pb[a.id]||a.measured.date>=p.pb[a.id].date))p.pb[a.id]={weight:a.measured.weight,reps:1,date:a.measured.date};}
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
    const limited=related.some(m=>m.level==='reduce'||m.level==='rest');
    const status=testStatus(data,lift,date,input),adjustments=[];
    if(Array.isArray(profile.equipment)&&!profile.equipment.includes('杠铃'))return {...flags,lift,date,mode:'rest',label:labels.rest,effectiveMode:'rest',adjustments:['当前未选择可用杠铃，不能生成该主项负重处方。请先确认器械，或补记已发生的训练。'],skipAllowed:true,exercises:[],canStart:false,fatigue:S.fatigueInfo(f.fatigue),readiness:f,recovery:related,reason:'缺少主项器械，不将其他动作能力换算为三大项重量。'};
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
    const muscle=profile.goal==='muscle',beginner=profile.experience==='beginner';
    const doses={volume:[beginner?2:3,lift==='deadlift'?5:muscle?8:6,3,180],intensity:[lift==='deadlift'?2:3,3,2,240],technique:[2,5,4,120],recovery:[2,5,5,120],deload:[2,lift==='deadlift'?5:6,4,180],assessment:[1,5,2,240],test:[1,1,1,300]};
    const normal=history.find(r=>r.lift===lift&&r.completed&&['volume','intensity'].includes(r.mode));
    if(mode==='deload')doses.deload[0]=Math.max(1,Math.ceil((normal?work(normal).filter(s=>s.exercise===lift).length:3)/2));
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
      const e=C.byId(id);if(e.equipment==='自重'||equipment.includes(e.equipment))return id;
      const substitute=e.alternatives.map(C.byId).find(x=>(x.equipment==='自重'||equipment.includes(x.equipment))&&!x.fatigueTags.includes('腰背承重')&&x.muscles.some(m=>e.muscles.includes(m)));
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
    const exercises=[lift,...ids].map((id,index)=>{
      const e=C.byId(id),main=index===0;
      const count=main?sets:mode==='recovery'||mode==='deload'||mode==='technique'?1:2;
      const repeats=main?reps:e.unit==='秒'?20:e.group==='core'?8:e.isolation?12:10;
      const reserve=main?rir:Math.max(3,rir);
      const result=P.prescribe(id,profile,history,mode,{sets:count,reps:repeats,rir:reserve,main,date,calibrations:data.calibrations||[],machineId:profile.machineIds?.[id]||'default'});
      result.rest=main?rest:e.group==='core'?90:120;
      result.selectionReason=main?'直接练习'+C.lifts.find(l=>l.id===lift).name+'专项动作，保留可比较的同动作记录。':e.purpose+'；'+(lift==='deadlift'?'重硬拉后避免重复高腰背负担。':'补充主项需要的训练量，不根据模板猜测个人弱项。');
      if(id===supplement)result.selectionReason='补足本周训练：可训练日较少，近期没有对应动作模式的实际训练。此动作不是主项专项辅助，也不代表发现个人弱点。';
      if(Number(f.fatigue)===3&&mode!=='recovery'){
        if(result.weight!==null&&result.weight>0&&e.loadConvention!=='assistance')result.weight=S.roundLoad(result.weight*.9,result.increment);
        result.sets=Math.max(1,result.sets-1);result.rir=e.unit==='秒'?null:Math.max(4,result.rir||4);
        result.loadSource+='；中等疲劳下保守降量';result.source=result.loadSource;
      }
      if(mode==='test'){
        const pb=S.estimatePB(profile.pb[lift]?.weight,profile.pb[lift]?.reps);
        if(pb){result.weight=S.roundLoad(pb.low*.9,Number(profile.increment));result.loadSource='近期同项能力约 90% 的保守首试；后续逐次确认，不预排极限。';result.calibrationRequired=false;}
      }
      result.doseReason=labels[mode]+'：'+result.sets+' 组，每组 '+result.reps+' '+e.unit+'，'+(e.unit==='秒'?'以呼吸和姿势稳定为停止标准。':'预计还能做 '+result.rir+' 次。')+' 休息 '+result.rest+' 秒。'+(Number(f.fatigue)===3?' 已计入当天中等疲劳的降量调整。':'');
      result.prescribedSets=Array.from({length:result.sets},(_,i)=>({index:i+1,weight:result.weight,reps:result.reps,rir:result.rir,rest:result.rest}));
      return result;
    });
    const main=exercises[0],warmupSets=main.weight>0?[{weight:S.roundLoad(main.weight*.4,Number(profile.increment)),reps:5},{weight:S.roundLoad(main.weight*.65,Number(profile.increment)),reps:3},{weight:S.roundLoad(main.weight*.8,Number(profile.increment)),reps:1}].filter(s=>s.weight>0&&s.weight<main.weight):[];
    return {...flags,lift,date,mode,label:labels[mode],readiness:JSON.parse(JSON.stringify(f)),effectiveMode:mode,adjustments,skipAllowed:['recovery','deload'].includes(mode),exercises,fatigue:S.fatigueInfo(f.fatigue),recovery:related,testStatus:status,planId:['test','assessment'].includes(mode)&&status.request?status.request.id:date+':'+lift,
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
  function overview(data,date=P.dateKey()){
    const history=actual(data,date),schedule=rolling(data,date);
    const trends=C.lifts.map(l=>({...l,weeks:Array.from({length:8},(_,i)=>{
      const end=add(date,-(7-i)*7),start=add(end,-6);const rows=history.filter(r=>r.date>=start&&r.date<=end).flatMap(work).filter(s=>s.exercise===l.id);
      return {start,end,sets:rows.length,volume:rows.reduce((n,s)=>n+Number(s.weight)*Number(s.reps),0)};
    }),count:history.filter(r=>r.lift===l.id&&P.daysBetween(date,r.date)<28).length}));
    return {schedule,trends,achievements:achievements(data,date),recovery:recovery(data,date),recent:history.slice(0,5),next:schedule.find(p=>p.exercises.length)||null};
  }
  function replaceExercise(data,plan,originalId,replacementId){
    const original=plan.exercises.find(e=>e.id===originalId),next=C.byId(replacementId);
    if(!original||original.main||!original.alternatives.includes(replacementId)||!next)throw Error('不能替换为该动作');
    if(plan.exercises.some(e=>e.id===replacementId))throw Error('计划中已有该动作，不重复叠加');
    if((plan.lift==='deadlift'||['recovery','deload'].includes(plan.mode))&&next.fatigueTags.includes('腰背承重'))throw Error('本日不叠加腰背承重动作');
    if(data.profile.equipment&&next.equipment!=='自重'&&!data.profile.equipment.includes(next.equipment))throw Error('该器械不可用');
    if(recovery(data,plan.date).some(m=>next.primaryMuscles.includes(m.id)&&m.level==='rest'))throw Error('替代动作的相关肌群需先恢复');
    const e=P.prescribe(next.id,data.profile,actual(data,plan.date),plan.mode,{sets:original.sets,reps:next.unit==='秒'?20:next.group==='core'?8:next.isolation?12:10,rir:original.rir??3,date:plan.date,calibrations:data.calibrations||[],machineId:data.profile.machineIds?.[next.id]||'default'});
    e.selectionReason='用户替换 '+original.name+'；'+next.purpose+'。替代作用不完全相同，不沿用原动作能力。';
    e.doseReason=e.sets+' 组 × '+e.reps+' '+e.unit+'，'+(e.rir===null?'以姿势稳定为停止标准':'预计还能做 '+e.rir+' 次');
    e.prescribedSets=Array.from({length:e.sets},(_,i)=>({index:i+1,weight:e.weight,reps:e.reps,rir:e.rir,rest:e.rest}));
    return e;
  }
  function session(plan){
    if(!plan.canStart||plan.previewOnly)throw Error('未来或过去日期只能查看建议，请在实际训练日期重新评估');
    const s=P.createSession(plan);
    return {...s,planId:plan.planId,requestedMode:plan.requestedMode,effectiveMode:plan.effectiveMode||plan.mode,adjustments:plan.adjustments||[],readiness:plan.readiness||{fatigue:plan.fatigue.value,pain:false},sets:s.sets.map(row=>({...row,quality:true,success:true,pbAttempt:plan.mode==='test'}))};
  }
  function nextAttempt(s,profile){
    if(s.mode!=='test'||!s.protectionConfirmed)throw Error('请先确认保护条件');
    const rows=s.sets.filter(r=>r.exercise===s.lift),last=rows.at(-1);
    if(rows.length>=3||!last.done||last.success===false||last.quality===false||last.rir==null||last.rir<1||s.stopTest)throw Error('测试已结束或条件不足，不再加重');
    const step=Number(profile.increment);if(step/last.weight>.05)throw Error('器械档位过大，停止加重');
    return {...s,sets:[...s.sets,{...last,key:s.lift+'-'+rows.length,index:rows.length+1,weight:Number(last.weight)+step,targetWeight:Number(last.weight)+step,done:false,rir:null}]};
  }
  const api={labels,add,feedback,recovery,achievements,testStatus,prescription,rolling,overview,session,nextAttempt,replaceExercise};
  if(typeof module!=='undefined')module.exports=api;else globalThis.MuscleCoach=api;
})();
