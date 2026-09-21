const crypto=require('node:crypto');
const C=require('../miniprogram/lib/catalog'),P=require('../miniprogram/lib/planner'),Release=require('../miniprogram/lib/release');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const number=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
const flag=value=>typeof value==='boolean'?value:null;
const choice=(value,allowed)=>allowed.includes(value)?value:null;
const profile=p=>({age:number(p?.age),weight:number(p?.weight),experience:choice(p?.experience,['beginner','trained']),goal:choice(p?.goal,['strength','muscle'])});
const version=value=>typeof value==='string'&&/^\d+(?:\.\d+){1,3}$/.test(value)?value:null;
function snapshot(rows,source,createdAt=new Date().toISOString()){
 const records=rows.filter(r=>r.consent===1&&!r.is_demo).flatMap(r=>{
  const data=JSON.parse(r.data);if(data.synthetic)return [];
  const participant=digest(r.id).slice(0,32);
  const history=(data.history||[]).filter(h=>!h.synthetic).map(h=>({
   id:digest(participant+':'+h.id),date:P.validDate(h.date)?h.date:null,lift:choice(h.lift,C.lifts.map(l=>l.id)),
   mode:choice(h.mode,Object.keys(P.modes)),requestedMode:choice(h.requestedMode,Object.keys(P.modes)),rpe:number(h.rpe),completed:flag(h.completed),retrospective:flag(h.retrospective),
   context:h.researchContext?.schema===1?{
    schema:1,date:P.validDate(h.researchContext.date)?h.researchContext.date:null,plannerVersion:version(h.researchContext.plannerVersion),build:version(h.researchContext.build),
    profile:profile(h.researchContext.profile),
   }:null,
   readiness:h.readiness?{fatigue:number(h.readiness.fatigue),pain:flag(h.readiness.pain),soreness:Object.fromEntries(C.muscles.filter(m=>h.readiness.soreness?.[m.id]!==undefined).map(m=>[m.id,number(h.readiness.soreness[m.id])]))}:null,
   sets:(h.sets||[]).filter(s=>!s.synthetic).map((s,index)=>({
    id:digest(participant+':'+h.id+':'+(s.key||index)),
    exercise:C.byId(s.exercise)?.id||null,unit:choice(s.unit,['次','次/侧','秒']),loadConvention:choice(s.loadConvention,[...new Set(C.exercises.map(e=>e.loadConvention))]),
    ...Object.fromEntries(['weight','reps','rir','targetWeight','confirmedTargetWeight','targetReps','targetRir','targetSetCount'].map(k=>[k,number(s[k])])),
    ...Object.fromEntries(['quality','success','done','skipped','warmup','calibration','calibrationRequired','pbAttempt'].map(k=>[k,flag(s[k])])),
    machineId:s.machineId&&s.machineId!=='default'?digest(participant+':machine:'+s.machineId):null,
   })),
  }));
  return [{participant,consent:true,synthetic:false,revision:r.revision,updated:r.updated,
   profile:profile(data.profile),history}];
 });
 return {kind:'big3-consented-research',schema:2,snapshotId:crypto.randomUUID(),datasetId:digest(source),
  createdAt,asOfDate:P.dateKey(new Date(createdAt)),appVersion:Release.version,completeSnapshot:true,purpose:'offline-research-only',
  consentParticipants:records.map(r=>r.participant),
  notice:'当前授权者的完整去标识快照，不保证匿名。仅用于离线研究；每周使用最新快照重新生成样本，不拼接旧快照。撤回授权后停用相关旧样本和模型。不是线上处方。',records};
}
module.exports={snapshot};
