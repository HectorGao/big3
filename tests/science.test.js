const {test}=require('node:test');const assert=require('node:assert/strict');
const S=require('../miniprogram/lib/science');const P=require('../miniprogram/lib/planner');const C=require('../miniprogram/lib/catalog');const A=require('../miniprogram/lib/anatomy');const F=require('../miniprogram/lib/exercise-figures');
const profile={age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:120,reps:5,date:P.dateKey()}}};
test('120 kg x 5 gives 135–140 kg equation spread and separate training baseline',()=>{const e=S.estimatePB(120,5,75);assert.equal(e.epley,140);assert.equal(e.brzycki,135);assert.equal(e.relative,1.8);assert.equal(S.trainingMax(profile,e),121.5);assert.equal(S.estimatePB(120,1).low,120);assert.equal(S.estimatePB(-1,5),null);assert.equal(S.estimatePB(120,11),null);});
test('body mass never fabricates a PB multiplier; age and experience only alter conservative baseline',()=>{assert.equal(S.estimatePB(120,5,50).low,S.estimatePB(120,5,100).low);const e=S.estimatePB(120,5);assert.ok(S.trainingMax({...profile,age:70},e)<S.trainingMax(profile,e));});
test('heavier manual weights lower suggested reps, reps remain manually editable',()=>{const row={exercise:'squat',unit:'次',weight:90,reps:8,capacity:121.5,targetRir:2,done:false};const light=S.reviseSet(row,'weight',90);const heavy=S.reviseSet(row,'weight',100);assert.ok(heavy.reps<light.reps);assert.equal(S.reviseSet(heavy,'reps',4).reps,4);assert.equal(S.repsAtLoad(130,121.5,2),null);});
test('unknown accessory load stays null; known main and bodyweight retain valid values',()=>{const plan=P.makePlan({profile});assert.ok(plan.exercises.every(e=>(Number.isFinite(e.weight)||e.weight===null&&e.calibrationRequired)&&e.reps>=1));assert.ok(plan.exercises.filter(e=>!e.main&&e.equipment!=='自重').every(e=>e.calibration));assert.ok(P.createSession(plan).sets.every(s=>s.rir===null));});
test('hypertrophy prioritizes more reps and uses lighter main weights',()=>{const strength=P.makePlan({profile});const hypertrophy=P.makePlan({profile:{...profile,goal:'muscle'}});assert.ok(hypertrophy.exercises[0].reps>strength.exercises[0].reps);assert.ok(hypertrophy.exercises[0].weight<strength.exercises[0].weight);});
test('auxiliary progression requires known units and two distinct stable records',()=>{
 const record={id:'one',date:P.dateKey(),mode:'volume',completed:true,rpe:7,sets:[{exercise:'row',weight:10,reps:10,targetReps:10,targetSetCount:1,done:true,rir:null,quality:true,loadConvention:'per-hand'}]};
 assert.equal(P.prescribe('row',profile,[record],'volume').weight,10);
 record.sets[0].rir=3;
 assert.equal(P.prescribe('row',profile,[record,{...record,id:'two'}],'volume').weight,10.5);
 record.sets[0].rir=0;assert.ok(P.prescribe('row',profile,[record],'volume').weight<10);
 delete record.sets[0].loadConvention;assert.equal(P.prescribe('row',profile,[record],'volume').weight,null);
});
test('same-target main progression is one increment, not a fabricated capacity increase',()=>{
 const record={id:'one',date:P.dateKey(),sets:[{exercise:'squat',weight:90,reps:6,targetReps:6,targetSetCount:1,rir:3,quality:true,done:true}]};
 const once=P.prescribe('squat',profile,[record],'volume',{reps:6,main:true});
 const twice=P.prescribe('squat',profile,[record,{...record,id:'two'}],'volume',{reps:6,main:true});
 assert.equal(once.weight,90);assert.equal(twice.weight,92.5);assert.equal(twice.capacity,once.capacity);
});
test('central upper/lower back have separate mirrored regions and linked exercises',()=>{for(const id of ['upperback','lowerback']){assert.ok(A.regions.back.some(r=>r[0]===id&&r[2]));assert.ok(C.exercises.some(e=>e.muscles.includes(id)));}assert.ok(!A.regions.front.some(r=>r[0]==='calves'));});
test('all 50 exercises declare independent stage media and measurement metadata',()=>{
 assert.equal(C.exercises.length,50);
 for(const e of C.exercises){assert.ok(e.media.path.includes(e.id+'.jpg'));assert.equal(e.media.phases.length,e.measurement.kind==='duration'?2:3);assert.ok(e.loadConvention&&e.selectionReason!==null);assert.equal(e.media.available,e.media.status==='reviewed');}
});
test('invalid plan edits and invalid RIR are rejected',()=>{const plan=P.makePlan({profile});plan.exercises[0].weight=-1;assert.throws(()=>P.createSession(plan));const s=P.createSession(P.makePlan({profile}));s.sets[0].done=true;s.sets[0].rir=8;assert.ok(P.validateRecord(s));});
test('recent assistance also participates in related-muscle recovery checks',()=>{const now=P.dateKey();const yesterday=new Date(now+'T12:00:00');yesterday.setDate(yesterday.getDate()-1);const history=[{id:'assist',date:P.dateKey(yesterday),lift:'squat',mode:'volume',completed:false,rpe:7,sets:[{exercise:'dbbench',weight:10,reps:10,done:true}]}];assert.equal(P.makePlan({profile,history,lift:'bench'}).mode,'recovery');});
test('timed exercise is not assigned repetition reserve and manual actual edits reset previous effort',()=>{const e=P.prescribe('plank',profile,[],'volume');assert.equal(e.rir,null);assert.equal(S.reviseSet({index:1,unit:'次',weight:20,reps:8,rir:3},'reps',6).rir,null);});
test('all five readiness levels are explained and affect planning without auto-maxing',()=>{assert.equal(S.fatigueLevels.length,5);for(const l of S.fatigueLevels){assert.ok(l.label&&l.description&&l.action);}const get=level=>P.makePlan({profile,readiness:{fatigue:level}});assert.equal(get(1).exercises[0].weight,get(2).exercises[0].weight);assert.ok(get(3).exercises[0].weight<get(2).exercises[0].weight);assert.ok(get(3).exercises[0].sets<get(2).exercises[0].sets);assert.equal(get(4).mode,'recovery');assert.equal(get(5).mode,'rest');assert.throws(()=>get(6));});
test('rest does not conceal future plans but future previews cannot be started',()=>{for(const lift of C.lifts){const p=P.planView({profile,lift:lift.id,readiness:{fatigue:5}});assert.ok(p.exercises.length);assert.equal(p.previewOnly,true);assert.equal(p.canStart,false);assert.ok(p.date>P.dateKey());assert.throws(()=>P.createSession(p));}});
test('weight increase cannot silently retain old reps when no reserve-compatible estimate exists',()=>{const low={unit:'次',weight:40,reps:8,capacity:53.3,targetRir:2};const result=S.reviseSet(low,'weight',50);assert.equal(result.reps,'');assert.match(result.advice,/无法/);const uncalibrated=S.reviseSet({...low,capacity:null},'weight',50);assert.equal(uncalibrated.reps,'');assert.match(uncalibrated.advice,/尚无/);});
test('front and rear have different complete contours and bench bar is transverse to torso',()=>{assert.notDeepEqual(A.contours.front,A.contours.back);const {torso,bar}=F.benchAxes;const a=torso[1].map((n,i)=>n-torso[0][i]),b=bar[1].map((n,i)=>n-bar[0][i]);assert.equal(a[0]*b[0]+a[1]*b[1],0);});
