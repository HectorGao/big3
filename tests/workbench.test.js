const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../miniprogram/lib/catalog'),P=require('../miniprogram/lib/planner'),K=require('../miniprogram/lib/coach'),S=require('../miniprogram/lib/store');
const date=P.dateKey(),profile={age:32,weight:80,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:Object.fromEntries(C.lifts.map(l=>[l.id,{weight:150,reps:1,date}]))};
const base=()=>({...S.empty(),profile:structuredClone(profile)}),feedback=fatigue=>({fatigue,pain:false,soreness:{}});
function setup(){const mem={};const store=S.createStore({getStorageSync:k=>mem[k],setStorageSync:(k,v)=>{mem[k]=v;}});const d=base();d.session=K.session(K.prescription(d,'deadlift',date,feedback(1),{mode:'intensity'}));store.save(d);return {store,d};}
test('fatigue 1 to 5 separates load, volume, reserve and no-load advice',()=>{
 for(const lift of C.lifts){const plans=[1,2,3,4,5].map(f=>K.prescription(base(),lift.id,date,feedback(f),{mode:'volume'}));
  const [a,b,c,d]=plans.map(p=>p.exercises[0]);assert.ok(b.weight<a.weight);assert.ok(b.rir>a.rir);assert.equal(b.sets,a.sets);
  assert.ok(c.weight<b.weight);assert.ok(c.sets<b.sets);assert.equal(plans[2].mode,'volume');
  assert.equal(plans[3].mode,'recovery');assert.equal(d.sets,1);assert.ok(d.weight<c.weight);assert.equal(plans[4].exercises.length,0);
 }
});
test('machine-only plans have genuine machine alternatives, never converted PBs',()=>{
 for(const lift of C.lifts){const d=base();d.profile.equipment=['器械'];const p=K.prescription(d,lift.id,date,feedback(1),{mode:'intensity'});
  assert.ok(p.exercises.length);assert.equal(p.canStart,true);assert.ok(p.exercises.every(e=>e.equipment==='器械'));
  assert.ok(p.exercises.every(e=>e.weight===null&&e.calibrationRequired));assert.equal(p.specialist,false);assert.ok(p.adjustments.some(s=>s.includes('PB')));
 }
});
test('full muscle catalog selection has independent load and safe dose constraints',()=>{
 const d=base(),p=K.prescription(d,'squat',date,feedback(1),{mode:'volume'}),before=JSON.stringify(d);
 const legs=K.exerciseOptions(d,p,{muscle:'quads',equipment:'器械'});assert.ok(legs.some(e=>e.id==='legpress'&&!e.disabledReason));
 const leg=K.chooseExercise(d,p,'legpress');assert.equal(leg.weight,null);assert.equal(leg.sets,2);assert.ok(leg.selectionReason&&leg.doseReason&&leg.loadSource);
 assert.throws(()=>K.chooseExercise(d,p,'squat'),/已包含/);assert.throws(()=>K.chooseExercise(d,p,'legpress','squat'),/主导/);
 const dead=K.prescription(d,'deadlift',date,feedback(1),{mode:'volume'});assert.throws(()=>K.chooseExercise(d,dead,'barbell-row'),/腰背/);
 assert.equal(JSON.stringify(d),before);
});
test('replacements do not subtract fatigue-reduced sets a second time',()=>{
 const d=base(),p=K.prescription(d,'squat',date,feedback(3),{mode:'volume'}),old=p.exercises.find(e=>e.id==='split');
 const next=K.chooseExercise(d,p,'legpress','split');assert.equal(next.sets,old.sets);assert.equal(next.weight,null);
});
test('direct entry preserves frozen targets and completed rows; skipped rows never become volume',()=>{
 const {store,d}=setup(),s=d.session,before=structuredClone(s.sets[0]);
 store.chooseLoad(s.id,'row',{weight:26,reps:10});let now=store.load().session;const row=now.sets.find(r=>r.exercise==='row');
 assert.equal(row.weight,26);assert.equal(row.targetWeight,null);assert.equal(row.entryMode,'manual');assert.equal(store.load().calibrations.length,0);
 row.done=true;store.updateSession(now);store.chooseLoad(s.id,'row',{weight:28,reps:8});now=store.load().session;assert.equal(now.sets.find(r=>r.key===row.key).weight,26);
 store.skipSet(s.id,before.key);now=store.load().session;assert.equal(now.sets[0].skipped,true);assert.equal(now.sets[0].targetWeight,before.targetWeight);
 assert.throws(()=>store.skipSet(s.id,row.key),/完成/);const record=store.finish(now,date);assert.equal(record.sets.length,1);assert.equal(record.skippedSets.length,1);assert.equal(record.completed,false);assert.equal(store.load().history.length,1);
});
test('ending an empty workout is a plan event, not a fake completed record',()=>{
 const {store,d}=setup();store.endEmpty(d.session.id);const saved=store.load();assert.equal(saved.session,null);assert.equal(saved.history.length,0);assert.equal(saved.events.at(-1).kind,'skip');
});
test('added technical variants use fewer reps, independent calibration and longer rest',()=>{
 const d=base(),p=K.prescription(d,'squat',date,feedback(1),{mode:'volume'});
 const e=K.chooseExercise(d,p,'pause-squat');assert.equal(e.reps,5);assert.equal(e.rir,4);assert.equal(e.rest,180);assert.equal(e.weight,null);assert.equal(e.sets,2);
});
test('direct entry rejects missing load instead of fabricating zero',()=>{
 const {store,d}=setup();const prior=store.exportRaw();assert.throws(()=>store.chooseLoad(d.session.id,'row',{weight:null,reps:10}));assert.equal(store.exportRaw(),prior);
});
