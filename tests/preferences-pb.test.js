const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../miniprogram/lib/catalog'),P=require('../miniprogram/lib/planner'),K=require('../miniprogram/lib/coach'),S=require('../miniprogram/lib/store');
const today=P.dateKey(),feedback={fatigue:2,pain:false,soreness:{}};
const base=()=>({...S.empty(),profile:{age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:100,reps:1,date:K.add(today,-7)},bench:{weight:80,reps:1,date:K.add(today,-7)},deadlift:{weight:150,reps:1,date:K.add(today,-7)}}}});
function setup(){let raw,fail=false;const store=S.createStore({getStorageSync:()=>raw,setStorageSync:(k,v)=>{if(fail)throw Error('quota');raw=v;}});store.save(base());return {store,fail:()=>{fail=true;}};}
function draft(store,rows){const d=store.load();d.session={...K.session(K.prescription(d,'squat',today,feedback,{mode:'volume'})),sets:rows.map(s=>({exercise:'squat',weight:110,reps:1,done:true,quality:true,success:true,loadConvention:'barbell-total',...s}))};store.save(d);return d.session;}
test('all lift modes and equipment subsets strictly exclude unchecked types',()=>{
 const types=C.equipment.slice(1);
 for(let mask=0;mask<32;mask++)for(const lift of C.lifts)for(const mode of ['volume','intensity','recovery','technique']){
   const d=base();d.profile.equipment=types.filter((t,i)=>mask&(1<<i));
   const p=K.prescription(d,lift.id,today,feedback,{mode});
   assert.ok(p.exercises.every(e=>d.profile.equipment.includes(e.equipment)));
   assert.equal(new Set(p.exercises.map(e=>e.id)).size,p.exercises.length);
   for(const e of p.exercises)assert.ok(K.replacementOptions(d,p,e.id).every(x=>d.profile.equipment.includes(x.equipment)));
 }
});
test('excluding bodyweight actually replaces core with separately calibrated equipment',()=>{
 const d=base();d.profile.pb.deadlift={weight:150,reps:1,date:today};
 const before=K.prescription(d,'deadlift',today,feedback,{mode:'intensity'});
 d.profile.equipment=['杠铃','哑铃','器械','绳索'];
 const after=K.prescription(d,'deadlift',today,feedback,{mode:'intensity'});
 assert.ok(before.exercises.some(e=>e.id==='deadbug'));
 const e=after.exercises.find(e=>e.id==='pallof');assert.ok(e);assert.equal(e.weight,null);assert.equal(e.calibrationRequired,true);
 assert.match(after.adjustments.join(' '),/死虫式.*Pallof/);
 assert.throws(()=>K.replaceExercise(d,after,'pallof','side-plank'),/未勾选/);
 d.profile.equipment=['杠铃'];const limited=K.prescription(d,'deadlift',today,feedback,{mode:'recovery'});
 assert.deepEqual(limited.exercises.map(e=>e.id),['deadlift']);assert.match(limited.adjustments.join(' '),/省略/);
});
test('preferences persist, recalculate forecasts, and never mutate history or active targets',()=>{
 const {store}=setup();const before=store.load().history;
 const saved=store.equipment(['杠铃','绳索']);assert.deepEqual(store.load().profile.equipment,['杠铃','绳索']);
 assert.deepEqual(saved.history,before);assert.ok(K.rolling(saved).every(p=>p.exercises.every(e=>e.equipment!=='自重')));
 draft(store,[{}]);const raw=store.exportRaw();assert.throws(()=>store.equipment(['自重']),/训练已开始/);assert.equal(store.exportRaw(),raw);
});
test('weighted ground bridge is independent of bodyweight bridge and bench hip thrust',()=>{
 const e=C.byId('weighted-bridge');assert.equal(e.loadConvention,'barbell-total');assert.equal(e.unit,'次');assert.match(e.steps[0],/接地/);
 assert.ok(C.byId('bridge').alternatives.includes(e.id));
 const d=base();d.history=[{id:'bridge-old',date:K.add(today,-4),lift:'squat',mode:'volume',completed:false,rpe:7,sets:[{exercise:'hip-thrust',weight:100,reps:10,done:true,quality:true,rir:3,loadConvention:'barbell-total'}]}];
 assert.equal(P.prescribe(e.id,d.profile,d.history,'volume').weight,null);
});
test('successful actual single updates PB in the same save, including string inputs',()=>{
 const {store}=setup();const s=draft(store,[{weight:'112.5',reps:'1'}, {weight:120,reps:1,done:false}]);
 const r=store.finish(s);const d=store.load();assert.equal(d.profile.pb.squat.weight,112.5);assert.equal(d.profile.pb.squat.reps,1);assert.equal(d.profile.pb.squat.recordId,r.id);
 assert.equal(r.pbUpdates[0].previous.weight,100);assert.equal(d.history.length,1);assert.equal(d.session,null);
 assert.throws(()=>store.finish(s),/已经保存/);assert.equal(store.load().history.length,1);
});
test('multi-rep best updates estimated profile result but never overwrites measured single',()=>{
 const {store}=setup();const s=draft(store,[{weight:100,reps:5,rir:1}]);const r=store.finish(s),d=store.load();
 assert.equal(d.profile.pb.squat.weight,100);assert.equal(d.profile.pb.squat.reps,1);
 assert.equal(d.profile.estimatedPB.squat.weight,100);assert.equal(d.profile.estimatedPB.squat.reps,5);assert.equal(r.pbUpdates[0].kind,'estimate');
 assert.equal(K.achievements(d)[0].baseline,null);
});
test('failed, unconfirmed, warm-up, calibration, variants and unknown reserve do not update PB',()=>{
 for(const row of [{success:false},{quality:false},{quality:undefined},{success:undefined},{warmup:true},{calibration:true},{exercise:'pause-squat'},{loadConvention:'per-hand'},{reps:5,rir:null},{reps:5,rir:4}]){
   const {store}=setup(),s=draft(store,[{weight:120,...row}]);const r=store.finish(s);
   assert.deepEqual(store.load().profile.pb,base().profile.pb);assert.equal(r.pbUpdates.length,0);
 }
});
test('storage failure preserves original profile, history and draft atomically',()=>{
 const {store,fail}=setup();const s=draft(store,[{}]);const raw=store.exportRaw();fail();assert.throws(()=>store.finish(s),/quota/);assert.equal(store.exportRaw(),raw);
});
test('partial completion uses actual date, best qualified set, and never decreases PB',()=>{
 const {store}=setup();let s=draft(store,[{weight:105},{weight:115},{weight:120,success:false}]);
 const yesterday=K.add(today,-1);store.finish(s,yesterday);assert.equal(store.load().profile.pb.squat.date,yesterday);assert.equal(store.load().profile.pb.squat.weight,115);
 s=draft(store,[{weight:110}]);assert.equal(store.finish(s).pbUpdates.length,0);assert.equal(store.load().profile.pb.squat.weight,115);
});
