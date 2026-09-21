const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../miniprogram/lib/catalog'),P=require('../miniprogram/lib/planner'),K=require('../miniprogram/lib/coach'),R=require('../miniprogram/lib/routines'),Store=require('../miniprogram/lib/store');
const today=P.dateKey(),profile={age:30,weight:80,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:120,reps:1,date:K.add(today,-100)},bench:{weight:90,reps:1,date:K.add(today,-100)},deadlift:{weight:160,reps:1,date:K.add(today,-100)}}};
const base=()=>({...Store.empty(),profile:structuredClone(profile)});
function setup(){const memory={};let fail=false;const store=Store.createStore({getStorageSync:k=>memory[k],setStorageSync:(k,v)=>{if(fail&&k===Store.KEY)throw Error('quota');memory[k]=v;}});store.save(base());return {store,memory,fail:()=>{fail=true;}};}
const plan=(d,date=today,fatigue=1)=>K.prescription(d,'squat',date,{fatigue,pain:false},{mode:'volume'});
test('v3 migration backs up before a v4 write and never invents routines or feedback',()=>{
 const {store,memory}=setup(),old={...base(),version:3};delete old.favorites;delete old.retroDraft;memory[Store.KEY]=JSON.stringify(old);
 const migrated=store.load();assert.equal(migrated.version,4);assert.deepEqual(migrated.favorites,[]);assert.deepEqual(migrated.feedback,old.feedback);store.save(migrated);assert.equal(memory[Store.KEY+'-v3-backup'],JSON.stringify(old));
});
test('favorites persist exact order and user doses without becoming actual history',()=>{
 const {store}=setup(),d=store.load(),p=plan(d);p.exercises.reverse();p.exercises[0].sets=3;
 const r=R.snapshot(p,'我的顺序');store.favorite(r);const after=store.load();assert.deepEqual(after.favorites[0].exercises.map(e=>e.id),p.exercises.map(e=>e.id));assert.equal(after.history.length,0);
 const next=R.apply(after,plan(after),r);assert.equal(next.exercises[0].id,r.exercises[0].id);assert.ok(next.routineNotes.length);assert.equal(after.favorites[0].exercises[0].sets,3);
});
test('favorite application preserves pain and fatigue limits and independently calibrates unknown exercises',()=>{
 const d=base(),p=plan(d),r=R.snapshot(p,'大容量');r.exercises.forEach(e=>{e.sets=8;e.weight=300;});
 const next=R.apply(d,plan(d,today,4),r);assert.ok(next.exercises.reduce((n,e)=>n+e.sets,0)<=plan(d,today,4).exercises.reduce((n,e)=>n+e.sets,0));assert.ok(next.exercises.every(e=>e.weight===null||e.weight<300));
 const blocked=K.prescription(d,'squat',today,{fatigue:5,pain:true},{mode:'intensity'});assert.equal(R.apply(d,blocked,r).exercises.length,0);
 const normal=R.apply(d,p,r);assert.ok(normal.exercises.filter(e=>e.id!=='squat'&&e.loadConvention!=='bodyweight').every(e=>e.weight===null));
});
test('retrospective drafts preserve an active session and save actual-only records and PB atomically',()=>{
 const {store}=setup(),d=store.load();d.session=K.session(plan(d));store.save(d);const live=store.load().session;
 const draft=R.retrospective(plan(d,K.add(today,-2)),K.add(today,-2));draft.sets[0]={...draft.sets[0],weight:125,reps:1,done:true,quality:true,success:true};store.retrospective(draft);
 assert.equal(store.load().history.length,0);const record=store.finishRetrospective();assert.equal(record.sets.length,1);assert.equal(record.retrospective,true);assert.equal(record.date,K.add(today,-2));assert.equal(store.load().profile.pb.squat.weight,125);assert.deepEqual(store.load().session,live);assert.equal(store.load().retroDraft,null);
 assert.throws(()=>store.retrospective(draft),/已经保存/);assert.throws(()=>store.finishRetrospective(),/没有/);assert.throws(()=>R.retrospective(plan(d),K.add(today,1)),/过去/);
});
test('failed retrospective save retains the full draft, current session and previous records',()=>{
 const {store,fail}=setup(),d=store.load(),s=R.retrospective(plan(d),today);s.sets[0].done=true;store.retrospective(s);const raw=store.exportRaw();fail();assert.throws(()=>store.finishRetrospective(),/quota/);assert.equal(store.exportRaw(),raw);
});
test('retrospective same-exercise load informs later same-target prescription, not another machine',()=>{
 const {store}=setup(),d=store.load(),p=plan(d);p.exercises=[K.chooseExercise(d,p,'legpress')];const s=R.retrospective(p,today);
 s.sets[0]={...s.sets[0],weight:80,reps:10,rir:3,done:true,calibrationRequired:false,quality:true,success:true};store.retrospective(s);store.finishRetrospective();
 const after=store.load();assert.equal(P.prescribe('legpress',after.profile,after.history,'volume',{reps:10}).weight,80);assert.equal(P.prescribe('legpress',after.profile,after.history,'volume',{reps:10,machineId:'different'}).weight,null);
});
test('muscle heat counts overlapping groups and distinguishes suggestions from completed work',()=>{
 const d=base(),p=plan(d);p.exercises=[{...C.byId('squat'),sets:3},{...C.byId('split'),sets:2}];const proposed=R.exposure(d,today,p);assert.equal(proposed.heat.quads,5);assert.match(proposed.source,/计划/);
 d.session={date:today,sets:[{exercise:'squat',done:true}]};const actual=R.exposure(d,today,p);assert.equal(actual.heat.quads,1);assert.match(actual.source,/实际/);
});
test('muscle heat adds numeric input strings instead of concatenating them',()=>{
 const d=base();
 for(const [a,b,total] of [['3','2',5],[3,'2',5],['8',4,12],['0',0,0]]){
  const p={exercises:[{id:'squat',sets:a},{id:'split',sets:b}]},before=structuredClone({d,p});
  const result=R.exposure(d,today,p);
  assert.equal(result.heat.quads||0,total);
  assert.ok(Object.values(result.heat).every(n=>Number.isSafeInteger(n)&&n>=0));
  assert.deepEqual({d,p},before);
 }
});
test('invalid or missing planned counts do not invent involved work sets',()=>{
 const d=base();
 for(const sets of [undefined,null,'',' ',false,true,[],{},'bad',-1,'-2',2.5,'3.5',Infinity,NaN]){
  const p={exercises:[{id:'squat',sets},{id:'split',sets:'2'}]};
  assert.equal(R.exposure(d,today,p).heat.quads,2);
 }
});
test('actual muscle exposure counts each work set once and excludes warmups and calibrations',()=>{
 const d=base(),rows=[{exercise:'squat',done:true,count:'3'},{exercise:'split',done:true},{exercise:'squat',done:false},{exercise:'squat',done:true,warmup:true},{exercise:'squat',done:true,calibration:true}];
 const p={exercises:[{id:'squat',sets:'8'}]};
 for(const source of ['history','session']){
  d.history=source==='history'?[{date:today,sets:rows}]:[];
  d.session=source==='session'?{date:today,sets:rows}:null;
  const before=structuredClone(d),result=R.exposure(d,today,p);
  assert.equal(result.heat.quads,2);assert.match(result.source,/实际/);assert.deepEqual(d,before);
 }
});
test('favorite inputs and minimum step use explicit profile increments',()=>{
 assert.equal(R.increment(profile,C.byId('row')),2.5);assert.equal(R.increment({...profile,exerciseIncrements:{row:1}},C.byId('row')),1);
 const r=R.snapshot(plan(base()),'test');r.exercises[0].weight='bad';assert.throws(()=>R.validate(r));
});
test('legacy equipment units stay unconfirmed when reusing a historical routine',()=>{
 const r={id:'legacy',date:today,lift:'squat',mode:'volume',completed:false,rpe:7,sets:[{exercise:'legpress',weight:80,reps:10,done:true}]};
 assert.equal(R.fromRecord(r).exercises[0].weight,null);
 r.sets[0].loadConvention='machine-stack';r.sets[0].machineId='gym-A';const saved=R.fromRecord(r);assert.equal(saved.exercises[0].weight,80);assert.equal(saved.exercises[0].machineId,'gym-A');
});
