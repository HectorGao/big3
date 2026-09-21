const crypto=require('node:crypto');
const C=require('../miniprogram/lib/catalog'),P=require('../miniprogram/lib/planner');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const validNumber=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
function metric(rows,predict){
 const errors=rows.map(r=>({user:r.participant,error:predict(r)-r.label}));
 const people=[...new Set(errors.map(r=>r.user))];
 return {sets:rows.length,participants:people.length,
  mae:mean(errors.map(r=>Math.abs(r.error))),
  participantMeanMAE:mean(people.map(p=>mean(errors.filter(r=>r.user===p).map(r=>Math.abs(r.error))))),
  optimisticByOverOneRate:mean(errors.map(r=>Number(r.error>1)))};
}
function prepare(input,{now=new Date()}={}){
 if(input?.kind!=='big3-consented-research'||input.schema!==2||input.purpose!=='offline-research-only'||input.completeSnapshot!==true)throw Error('只接受 schema 2 完整授权研究快照；管理备份不能直接用于训练');
 const age=now-Date.parse(input.createdAt);
 if(!Number.isFinite(age)||age<0||age>14*86400000)throw Error('快照时间无效或超过 14 天，请重新导出并核对授权');
 if(!Array.isArray(input.records)||!Array.isArray(input.consentParticipants)||typeof input.snapshotId!=='string'||typeof input.datasetId!=='string'||!P.validDate(input.asOfDate))throw Error('快照元数据缺失');
 const roster=new Set(input.consentParticipants),participants=new Set(),rows=[],counts={};
 const reject=why=>{counts[why]=(counts[why]||0)+1;};
 if(roster.size!==input.consentParticipants.length||roster.size!==input.records.length)throw Error('授权名单与完整快照不一致');
 const deduplicate=(items,kind)=>{
  const seen=new Map();return items.filter(item=>{
   if(!item||typeof item.id!=='string'||!item.id)throw Error(kind+'标识缺失');
   const value=JSON.stringify(item);
   if(seen.has(item.id)){if(seen.get(item.id)!==value)throw Error(kind+'标识冲突，不能猜测保留哪条');reject('duplicate'+kind);return false;}
   seen.set(item.id,value);return true;
  });
 };
 for(const person of input.records){
  if(!/^[a-f0-9]{32}$/.test(person.participant)||participants.has(person.participant)||!roster.has(person.participant)||person.consent!==true)throw Error('用户授权或去标识 ID 无效');
  participants.add(person.participant);
  if(person.synthetic!==false){reject('syntheticParticipant');continue;}
  if(!Array.isArray(person.history))throw Error('训练记录格式无效');
  const past=[];
  const history=deduplicate(person.history,'Session').sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.id.localeCompare(b.id));
  for(const session of history){
   if(session.synthetic||!P.validDate(session.date)||session.date>input.asOfDate||session.retrospective||session.mode==='manual'||session.context?.date&&session.context.date!==session.date){reject('unsupportedSession');continue;}
   if(!Array.isArray(session.sets))throw Error('训练组格式无效');
   let order=0;
   for(const set of deduplicate(session.sets,'Set')){
    order++;
    const ex=C.byId(set.exercise);
    if(set.synthetic||set.done!==true||set.skipped||set.warmup||set.calibration||set.calibrationRequired){reject('notWorkSet');continue;}
    if(!ex||set.loadConvention!==ex.loadConvention||set.unit!==ex.unit||ex.measurement.kind!=='reps'||['bodyweight','assistance'].includes(ex.loadConvention)){reject('unsupportedUnit');continue;}
    if(ex.loadConvention==='machine-stack'&&!/^[a-f0-9]{64}$/.test(set.machineId||'')){reject('unknownMachine');continue;}
    if(set.quality!==true||set.success!==true){reject('qualityOrSuccessUnknown');continue;}
    if(!validNumber(set.weight,0.25,600)||!Number.isInteger(set.reps)||!validNumber(set.reps,1,15)){reject('invalidActual');continue;}
    const partition=[set.exercise,set.loadConvention,set.machineId||'free-weight'].join(':');
    // Strictly earlier dates: within-day order and retrospectively entered feedback are not known.
    const earlier=past.filter(p=>p.partition===partition&&p.date<session.date&&P.daysBetween(session.date,p.date)<=90);
    const previous=earlier.at(-1),residuals=earlier.filter(p=>p.label!==null);
    const profile=session.context?.schema===1&&session.context.date===session.date?session.context.profile:null;
    const features={weight:set.targetWeight,reps:set.targetReps,targetRir:set.targetRir,setCount:set.targetSetCount,order,
     previousWeight:previous?.weight??null,previousReps:previous?.reps??null,
     daysSince:previous?P.daysBetween(session.date,previous.date):null,
     previousResidual:residuals.at(-1)?.label??null,
     fatigue:validNumber(session.readiness?.fatigue,1,5)?session.readiness.fatigue:null,
     bodyweight:validNumber(profile?.weight,30,350)?profile.weight:null,
     age:validNumber(profile?.age,18,100)?profile.age:null};
    let label=null;
    if(session.readiness?.pain||features.fatigue===5)reject('safetyRestricted');
    else if(!validNumber(set.targetWeight,0.25,600)||!Number.isInteger(set.targetReps)||!validNumber(set.targetReps,1,15)||!validNumber(set.targetRir,0,4)||!Number.isInteger(set.targetSetCount)||!validNumber(set.targetSetCount,1,8))reject('missingFrozenTarget');
    else if(set.weight!==set.targetWeight||set.reps!==set.targetReps)reject('changedDose');
    // UI value 5 means 5+; never treat a censored value as an exact regression label.
    else if(!Number.isInteger(set.rir)||!validNumber(set.rir,0,4))reject('missingOrCensoredRir');
    else {
     label=set.rir-set.targetRir;
     rows.push({id:hash(person.participant+':'+session.id+':'+set.id),participant:person.participant,session:session.id,date:session.date,
      exercise:set.exercise,loadConvention:set.loadConvention,machineId:set.machineId||null,mode:session.mode,
      plannerVersion:session.context?.plannerVersion||null,features,label,
      baseline:{target:0,personal:residuals.length?mean(residuals.slice(-6).map(p=>p.label)):0}});
    }
    past.push({partition,date:session.date,weight:set.weight,reps:set.reps,label});
   }
  }
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 // Stable participant holdout across weekly snapshots; IDs are partition keys, never model features.
 const holdout=p=>parseInt(hash(p).slice(0,8),16)%5===0;
 const dates=[...new Set(rows.filter(r=>!holdout(r.participant)).map(r=>r.date))];
 const trainEnd=dates.length>=3?dates[Math.max(0,Math.floor(dates.length*.7)-1)]:null;
 const validationEnd=dates.length>=3?dates[Math.min(dates.length-2,Math.max(1,Math.floor(dates.length*.85)-1))]:null;
 const partitions={train:[],validation:[],test:[],newUsers:[],insufficientTime:[]};
 for(const row of rows){
  const split=holdout(row.participant)?'newUsers':!trainEnd?'insufficientTime':row.date<=trainEnd?'train':row.date<=validationEnd?'validation':'test';
  row.split=split;partitions[split].push(row);
 }
 const span=rows.length?P.daysBetween(rows.at(-1).date,rows[0].date):0;
 const usablePeople=new Set(rows.map(r=>r.participant)).size;
 const enough=usablePeople>=20&&rows.length>=1000&&span>=56&&partitions.train.length>=500&&partitions.validation.length>=100&&partitions.test.length>=100&&partitions.newUsers.length>=100;
 const report={schema:1,snapshotId:input.snapshotId,datasetId:input.datasetId,sourceCreatedAt:input.createdAt,
  inputParticipants:input.records.length,usableParticipants:usablePeople,samples:rows.length,spanDays:span,excluded:counts,
  splitDates:{trainEnd,validationEnd},splits:Object.fromEntries(Object.entries(partitions).map(([k,v])=>[k,v.length])),
  baselines:Object.fromEntries(Object.entries(partitions).filter(([k])=>['validation','test','newUsers'].includes(k)).map(([k,v])=>[k,{target:metric(v,r=>r.baseline.target),personal:metric(v,r=>r.baseline.personal)}])),
  status:enough?'offline-experiment-candidate':'collect-more-data',canDeploy:false,trainedModel:false,
  limitations:['门槛为产品预筛选，不是样本量论证；还需学习曲线、按用户重采样置信区间及专业审查。','目标是估计相同处方下的余力偏差，不是最优重量、长期增肌或伤害风险。','旧记录没有冻结档案时保留空值，不用当前 PB、年龄和体重倒填历史。','当前 UI 疲劳可能来自默认值，只作弱特征；未记录等于未知。','仅处理最新完整授权快照；旧快照、派生文件和模型需人工按撤回要求停用或逐项删除。']};
 return {manifest:{schema:1,task:'rir-residual-v1',snapshotId:input.snapshotId,datasetId:input.datasetId,createdAt:input.createdAt,sourceSHA256:hash(JSON.stringify(input)),label:'actualRir - frozenTargetRir',features:rows[0]?Object.keys(rows[0].features):[],canDeploy:false},rows,report};
}
module.exports={prepare};
