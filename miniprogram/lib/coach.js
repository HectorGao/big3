(function(){
  const P=typeof module!=='undefined'?require('./planner'):globalThis.MusclePlanner;
  const S=typeof module!=='undefined'?require('./science'):globalThis.MuscleScience;
  const C=typeof module!=='undefined'?require('./catalog'):globalThis.MuscleCatalog;
  const labels={...P.modes,deload:'减量日',test:'PB 测试日',assessment:'次极限评估'};
  const add=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return P.dateKey(d);};
  const actual=(data,date)=>data.history.filter(r=>!P.validateRecord(r)&&r.date<=date).sort((a,b)=>b.date.localeCompare(a.date));
  const work=r=>r.sets.filter(s=>s.done&&!s.warmup&&s.success!==false);
  const muscleRows=(r,id)=>work(r).filter(s=>C.byId(s.exercise).muscles.includes(id));
  function feedback(data,date){return (data.feedback||[]).find(f=>f.date===date)||null;}
  function recovery(data,date=P.dateKey(),input){
    const f=input||feedback(data,date),history=actual(data,date);
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
      return {id:m.id,name:m.name,level,label,sets,hard,days,reason:(last?`最近 ${last.date}，7 天内 ${sets} 个相关工作组、${hard} 个近力竭组。`:'近 7 天无相关记录。')+(f?`疲劳 ${f.fatigue}/5，酸痛 ${soreness}/3。`:'缺少当天反馈，不能确认恢复。')};
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
  function prescription(data,lift,date=P.dateKey(),input,options={}){
    const requestedMode=options.mode||null;
    if(P.validateProfile(data.profile))return {...P.makePlan({profile:data.profile,lift,date}),viewDate:date,requestedMode,effectiveMode:'setup',adjustments:[],isToday:date===P.dateKey(),isSelectedDate:true,canStart:false,previewOnly:date!==P.dateKey(),skipAllowed:false};
    const history=actual(data,date),f=input||feedback(data,date)||{fatigue:2,pain:false};
    const profile=effectiveProfile(data,date);
    const blocked=f.pain||Number(f.fatigue)>=5;
    const statuses=recovery(data,date,input),target=C.lifts.find(l=>l.id===lift).muscles;
    const related=statuses.filter(m=>target.includes(m.id)),limited=related.some(m=>m.level==='reduce'||m.level==='rest');
    const status=testStatus(data,lift,date,input);
    let mode=requestedMode;
    if(!mode){const last=history.find(r=>r.lift===lift&&r.completed);mode=last?.mode==='volume'?'intensity':'volume';if(profile.experience==='beginner'||!profile.pb[lift])mode='technique';}
    const adjustments=[];
    if(!requestedMode && profile.experience==='beginner'||!requestedMode&&!profile.pb[lift])mode='technique';
    if(!requestedMode&&status.request)mode=status.ready?(data.settings?.maxTesting?'test':'assessment'):'deload';
    if(blocked){adjustments.push('疼痛、明显不适或疲劳 5 档，停止负重建议');return {lift,date,mode:'rest',label:labels.rest,viewDate:date,requestedMode,effectiveMode:'rest',adjustments,isToday:date===P.dateKey(),isSelectedDate:true,skipAllowed:true,previewOnly:date!==P.dateKey(),reason:'疼痛、明显不适或疲劳 5 档：不生成负重建议。可如实补记已经发生的训练。',exercises:[],canStart:false,fatigue:S.fatigueInfo(f.fatigue),recovery:related};}
    if(limited||f.fatigue>=4){adjustments.push(`近期相关肌群恢复不足（疲劳 ${f.fatigue}/5），已降级为减量日`);mode='recovery';}
    if(requestedMode==='test'&&!status.ready){adjustments.push('当前不满足 PB 测试资格、恢复或保护条件，已改为次极限/减量计划');mode=status.eligible?'assessment':'recovery';}
    const muscle=profile.goal==='muscle';
    const template={volume:[3,muscle?8:5,3],intensity:[3,muscle?5:3,2],technique:[2,6,4],recovery:[1,6,4],deload:[2,3,4],test:[1,1,1],assessment:[1,5,2]}[mode];
    const [sets,reps,rir]=template;
    const ids={squat:['split','row','plank'],bench:['row','lateral','pressdown'],deadlift:['goblet','dbbench','deadbug']}[lift];
    let exercises=[P.prescribe(lift,profile,history,['test','assessment','deload'].includes(mode)?'intensity':mode,{sets,reps,rir,main:true,date})];
    if(mode!=='test')exercises.push(...ids.slice(0,['deload','recovery','technique','assessment'].includes(mode)?1:3).map(id=>P.prescribe(id,profile,history,mode==='deload'?'recovery':mode,{sets:mode==='deload'||mode==='recovery'?1:2,reps:id==='plank'?25:muscle?12:10,rir:3,date})));
    for(const e of exercises){
      const prior=history.filter(r=>work(r).some(s=>s.exercise===e.id)).slice(0,2);
      const recent=prior[0]&&work(prior[0]).filter(s=>s.exercise===e.id);
      const stable=prior.length===2&&prior.every(r=>work(r).filter(s=>s.exercise===e.id).every(s=>s.rir!=null&&s.rir>=3&&Number(s.reps)>=Number(s.targetReps||e.reps)));
      const increment=e.equipment==='哑铃'?.5:Number(profile.increment);
      if(recent?.length&&!['test','assessment','recovery','deload','technique'].includes(mode)){
        const last=recent[0];const matched=Number(last.targetReps||last.reps)===e.reps;
        if(matched){e.weight=Number(last.weight);e.source='沿用同动作实际负荷；需连续两次稳定余力才递增';
          if(stable&&e.weight>0){if(increment/e.weight<=.05){e.weight+=increment;e.source='连续两次达到目标且余力充足，递增一档';}else{e.reps=Math.min(e.reps+1,15);e.source='器械档位超过 5%，先增加一次';}}
          if(recent.some(s=>s.reps<s.targetReps||s.rir!=null&&s.rir<=1)){e.weight=S.roundLoad(e.weight*.95,increment);e.sets=Math.max(1,e.sets-1);e.source='实际表现低于目标，降低负荷与组数';}
        }
      }
      if(f.fatigue===3&&!limited){e.weight=S.roundLoad(e.weight*.9,increment);e.sets=Math.max(1,e.sets-1);if(e.rir!=null)e.rir=Math.min(5,e.rir+1);}
      if(mode==='deload'){e.weight=S.roundLoad(e.weight*.85,increment);e.source+=' · 测试前减量';}
      e.rest=e.main?mode==='test'?300:mode==='intensity'?240:180:90;
      e.prescribedSets=Array.from({length:e.sets},(_,i)=>({index:i+1,weight:e.weight,reps:e.reps,rir:e.rir,rest:e.rest}));
    }
    const main=exercises[0];
    if(mode==='test'){
      const e=S.estimatePB(profile.pb[lift]?.weight,profile.pb[lift]?.reps);main.weight=e?S.roundLoad(e.low*.9,Number(profile.increment)):main.weight;main.reps=1;main.sets=1;main.prescribedSets=[{index:1,weight:main.weight,reps:1,rir:1,rest:300}];
    }
    const warmupSets=main.weight>0?[{weight:S.roundLoad(main.weight*.4,Number(profile.increment)),reps:5},{weight:S.roundLoad(main.weight*.65,Number(profile.increment)),reps:3},{weight:S.roundLoad(main.weight*.8,Number(profile.increment)),reps:1}].filter(s=>s.weight>0&&s.weight<main.weight):[];
    return {lift,date,mode,label:labels[mode],viewDate:date,requestedMode,effectiveMode:mode,adjustments,isToday:date===P.dateKey(),isSelectedDate:true,skipAllowed:['recovery','deload','rest'].includes(mode),exercises,canStart:date===P.dateKey()||!!options.mode,previewOnly:date!==P.dateKey()&&!options.mode,fatigue:S.fatigueInfo(f.fatigue),recovery:related,testStatus:status,planId:['test','assessment'].includes(mode)&&status.request?status.request.id:date+':'+lift,
      reason:(limited?'近期相关负荷或酸痛提示恢复不足，改为低量训练。':'根据同动作实际完成表现和训练目标安排。')+' '+(status.request?status.reason:'未来建议不代表已经完成；当天反馈优先。'),
      warmup:['轻活动 5–8 分钟，再逐组接近工作重量。','热身时动作或余力异常，减重或停止。'],warmupSets,rpe:mode==='test'?'逐次确认':String(10-main.rir),estimatedMinutes:exercises.length>2?50:25,trainingMax:main.capacity,scienceNote:'可校准产品规则，不保证最优效果。'};
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
        const lower=l.id!=='bench'?[...virtual,...history].find(r=>r.lift!=='bench'&&P.daysBetween(date,r.date)<2):null;
        const count=[...virtual,...history].filter(r=>r.lift===l.id&&P.daysBetween(date,r.date)<14).length;
        return {...l,index,gap,count,blocked:gap<2||!!lower};
      }).sort((a,b)=>Number(a.blocked)-Number(b.blocked)||a.count-b.count||b.gap-a.gap||a.index-b.index);
      const chosen=forced?candidates.find(l=>l.id===forced.lift):candidates[0];
      if(chosen.blocked&&!forced){result.push({date,mode:'rest',label:'恢复间隔',exercises:[],reason:'预计相关负荷密集，不把漏练补成连续大重量'});continue;}
      const f=i===0?feedback(data,date):{fatigue:2,pain:false};
      const last=[...virtual,...history].find(r=>r.lift===chosen.id);
      const mode=chosen.blocked?'recovery':last?.mode==='volume'?'intensity':'volume';
      const plan=prescription(data,chosen.id,date,f,{mode});
      if(i>0&&plan.testStatus?.request&&P.daysBetween(date,plan.testStatus.request.date)>=7&&plan.testStatus.eligible&&plan.mode==='deload'){
        plan.label=data.settings.maxTesting?'PB 测试候选':'次极限评估候选';plan.reason+=' 仅候选窗口：必须实际完成减量并通过当天检查，否则继续延期。';
      }
      if(forced)plan.planId=forced.id;
      if(i>0)plan.reason+=' 预计恢复正常，未假设力量增长。';
      result.push(plan);if(plan.exercises.length)virtual.unshift({date,lift:chosen.id,mode:plan.mode});
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
  function session(plan){
    const s=P.createSession({...plan,previewOnly:false});
    return {...s,planId:plan.planId,requestedMode:plan.requestedMode,effectiveMode:plan.effectiveMode||plan.mode,adjustments:plan.adjustments||[],readiness:{fatigue:plan.fatigue.value,pain:false},sets:s.sets.map(row=>({...row,targetWeight:row.weight,quality:true,success:true,pbAttempt:plan.mode==='test'}))};
  }
  function nextAttempt(s,profile){
    if(s.mode!=='test'||!s.protectionConfirmed)throw Error('请先确认保护条件');
    const rows=s.sets.filter(r=>r.exercise===s.lift),last=rows.at(-1);
    if(rows.length>=3||!last.done||last.success===false||last.quality===false||last.rir==null||last.rir<1||s.stopTest)throw Error('测试已结束或条件不足，不再加重');
    const step=Number(profile.increment);if(step/last.weight>.05)throw Error('器械档位过大，停止加重');
    return {...s,sets:[...s.sets,{...last,key:s.lift+'-'+rows.length,index:rows.length+1,weight:Number(last.weight)+step,targetWeight:Number(last.weight)+step,done:false,rir:null}]};
  }
  const api={labels,add,feedback,recovery,achievements,testStatus,prescription,rolling,overview,session,nextAttempt};
  if(typeof module!=='undefined')module.exports=api;else globalThis.MuscleCoach=api;
})();
