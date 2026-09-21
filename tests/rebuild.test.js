const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../miniprogram/lib/catalog'),P=require('../miniprogram/lib/planner'),K=require('../miniprogram/lib/coach'),S=require('../miniprogram/lib/store');
const today=P.dateKey(),date=n=>K.add(today,n);
const profile={age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:Object.fromEntries(C.lifts.map(l=>[l.id,{weight:l.id==='bench'?90:150,reps:1,date:date(-7)}]))};
const base=()=>({...S.empty(),profile:structuredClone(profile)});
const feedback={fatigue:1,pain:false,soreness:{}};
function record(id,exercise,weight,reps=10,extra={}){return {id,date:date(-4),lift:'deadlift',mode:'intensity',completed:false,rpe:7,sets:[{exercise,weight,reps,targetReps:reps,targetSetCount:1,rir:3,done:true,quality:true,success:true,loadConvention:C.byId(exercise).loadConvention,machineId:'default',...extra}]};}
function memoryStore(){const memory={};let fail=false;return {memory,fail:()=>{fail=true;},store:S.createStore({getStorageSync:k=>memory[k],setStorageSync:(k,v)=>{if(fail)throw Error('quota');memory[k]=v;}})};}
for(const lift of C.lifts)for(const goal of ['strength','muscle'])for(const mode of ['volume','intensity','technique','recovery','deload','test']){
 test(lift.id+' '+goal+' '+mode+' has coherent doses, reasons and safe sources',()=>{
  const d=base();d.profile.goal=goal;const p=K.prescription(d,lift.id,today,feedback,{mode});
  assert.equal(p.requestedMode,mode);assert.equal(p.effectiveMode,p.mode);
  if(mode==='test'){assert.notEqual(p.mode,'test');assert.ok(p.adjustments.length);}
  for(const e of p.exercises){assert.ok(e.selectionReason&&e.doseReason&&e.loadSource);assert.equal(e.prescribedSets.length,e.sets);assert.ok(e.rest>=90);if(e.weight===null)assert.equal(e.calibrationRequired,true);else assert.ok(e.weight>=0);}
  if(mode==='intensity'){assert.equal(p.exercises[0].reps,3);assert.equal(p.exercises[0].sets,lift.id==='deadlift'?2:3);assert.equal(p.exercises[0].rest,240);}
  if(mode==='volume')assert.equal(p.exercises[0].reps,lift.id==='deadlift'?5:goal==='muscle'?8:6);
  if(mode==='recovery'||mode==='technique')assert.ok(p.exercises.length<=2);
 });
}
test('deadlift intensity defaults are specific and never counterfeit 5kg prescriptions',()=>{
 const p=K.prescription(base(),'deadlift',today,feedback,{mode:'intensity'});
 assert.deepEqual(p.exercises.map(e=>e.id),['deadlift','curl-leg','row','deadbug']);
 assert.equal(p.exercises[1].weight,null);assert.equal(p.exercises[2].weight,null);assert.equal(p.exercises[3].weight,0);
 const d=base();d.history=[record('row1','row',30),record('curl1','curl-leg',45,12)];
 const known=K.prescription(d,'deadlift',today,feedback,{mode:'intensity'});
 assert.equal(known.exercises[1].weight,45);assert.equal(known.exercises[2].weight,30);
});
test('day mode changes actual weight reps sets rest and accessories',()=>{
 const get=mode=>K.prescription(base(),'bench',today,feedback,{mode});
 const r=get('recovery'),v=get('volume'),i=get('intensity');
 assert.ok(r.exercises[0].weight<v.exercises[0].weight);
 assert.ok(v.exercises[0].weight<i.exercises[0].weight);
 assert.ok(v.exercises[0].reps>i.exercises[0].reps);
 assert.ok(i.exercises[0].rest>v.exercises[0].rest);
 assert.notDeepEqual(r.exercises.map(e=>e.id),v.exercises.map(e=>e.id));
});
for(const fatigue of [1,2,3,4,5])test('test request never overrides fatigue '+fatigue,()=>{
 const p=K.prescription(base(),'deadlift',today,{...feedback,fatigue},{mode:'test'});
 assert.notEqual(p.mode,'test');
 if(fatigue===4)assert.equal(p.mode,'recovery');
 if(fatigue===5){assert.equal(p.mode,'rest');assert.equal(p.exercises.length,0);}
 if(fatigue>=4)assert.ok(p.adjustments.length);
});
test('pain, soreness, novice and future date guards apply before starting',()=>{
 const d=base();
 assert.equal(K.prescription(d,'bench',today,{...feedback,pain:true},{mode:'intensity'}).mode,'rest');
 assert.equal(K.prescription(d,'bench',today,{...feedback,soreness:{chest:3}},{mode:'volume'}).mode,'recovery');
 d.profile.experience='beginner';const p=K.prescription(d,'bench',today,feedback,{mode:'intensity'});
 assert.equal(p.mode,'technique');assert.ok(p.adjustments.length);
 const v=K.prescription(d,'bench',today,feedback,{mode:'volume'});assert.equal(v.exercises[0].sets,2);assert.ok(v.exercises.length<=3);
 const future=K.prescription(d,'bench',date(1),feedback,{mode:'intensity'});assert.equal(future.canStart,false);assert.equal(future.previewOnly,true);assert.throws(()=>K.session(future));
});
test('calibration is atomic, freezes targets, fills only pending rows and never creates a PB',()=>{
 const {store}=memoryStore(),d=base(),s=K.session(K.prescription(d,'deadlift',today,feedback,{mode:'intensity'}));
 d.session=s;store.save(d);const before=K.achievements(d),history=JSON.stringify(d.history);
 const result=store.calibrate(s.id,'row',{weight:26,reps:10,rir:3,quality:true});
 const rows=result.session.sets.filter(r=>r.exercise==='row');
 assert.ok(rows.every(r=>r.weight===26&&!r.calibrationRequired&&r.targetWeight===null&&r.confirmedTargetWeight===26));
 assert.equal(store.load().calibrations.length,1);assert.equal(JSON.stringify(store.load().history),history);
 assert.deepEqual(K.achievements(store.load()),before);assert.ok(K.recovery(store.load()).find(m=>m.id==='back').sets>0);
 const work=structuredClone(result.session);work.sets.find(r=>r.exercise==='row').done=true;store.updateSession(work);
 const next=store.calibrate(s.id,'row',{weight:28,reps:10,rir:3,quality:true});
 const updated=next.session.sets.filter(r=>r.exercise==='row');
 assert.equal(updated[0].weight,26);assert.equal(updated[1].weight,28);
});
test('failed storage preserves trial and session state; failed trial never enters work stats',()=>{
 const {store,fail}=memoryStore(),d=base();d.session=K.session(K.prescription(d,'bench',today,feedback,{mode:'volume'}));store.save(d);
 const rejected=store.calibrate(d.session.id,'dbbench',{weight:20,reps:3,rir:0,quality:false});assert.equal(rejected.trial.accepted,false);
 assert.equal(store.load().session.sets.find(s=>s.exercise==='dbbench').weight,'');assert.equal(store.load().history.length,0);
 assert.throws(()=>store.calibrate(d.session.id,'dbbench',{weight:15,reps:10,rir:3,quality:true}),/不再试重/);
 const prior=store.exportRaw();fail();assert.throws(()=>store.calibrate(d.session.id,'row',{weight:15,reps:10,rir:3,quality:true}),/quota/);assert.equal(store.exportRaw(),prior);
});
test('timed loaded holds calibrate duration and posture without invented repetition reserve',()=>{
 const d=base(),{store}=memoryStore();let p=K.prescription(d,'bench',today,feedback,{mode:'volume'});
 const hold=P.prescribe('suitcase-hold',profile,[],'volume',{reps:20});
 p.exercises=[p.exercises[0],hold];d.session=K.session(p);store.save(d);
 const result=store.calibrate(d.session.id,'suitcase-hold',{weight:16,reps:20,quality:true});
 assert.equal(result.trial.accepted,true);assert.equal(result.trial.rir,null);
 assert.equal(result.session.sets.find(s=>s.exercise==='suitcase-hold').targetRir,null);
 assert.equal(store.load().history.length,0);
});
test('equipment constraints, fatigue explanation, and frozen feedback are explicit',()=>{
 const d=base();d.profile.equipment=['杠铃','哑铃','自重'];
 const p=K.prescription(d,'deadlift',today,feedback,{mode:'intensity'});
 assert.ok(p.exercises.every(e=>e.equipment==='自重'||d.profile.equipment.includes(e.equipment)));
 assert.ok(p.adjustments.some(a=>a.includes('器械不可用')));
 const sore={...feedback,soreness:{biceps:1}};
 const s=K.session(K.prescription(d,'bench',today,sore,{mode:'volume'}));
 assert.deepEqual(s.readiness,sore);
 const tired=K.prescription(d,'bench',today,{...feedback,fatigue:4},{mode:'intensity'});
 assert.ok(tired.adjustments.some(a=>a.includes('疲劳为 4 档')));
 d.profile.equipment=['哑铃'];const related=K.prescription(d,'bench',today,feedback);assert.equal(related.canStart,true);assert.equal(related.primaryExerciseId,'dbbench');assert.equal(related.exercises[0].weight,null);
});
test('duplicate source sessions cannot unlock progression',()=>{
 const r=record('same','row',25);assert.equal(P.prescribe('row',profile,[r,r],'volume').weight,25);
});
test('partial completion cannot unlock load progression',()=>{
 const a=record('part-a','row',25,10,{targetSetCount:2}),b=record('part-b','row',25,10,{targetSetCount:2});
 assert.equal(P.prescribe('row',profile,[a,b],'volume').weight,25);
});
test('latest failed attempt reduces rather than increases known load',()=>{
 const a=record('ok-a','row',25),b=record('ok-b','row',25),bad=record('bad','row',25,10,{success:false});
 bad.date=date(-1);
 const e=P.prescribe('row',profile,[bad,a,b],'volume');assert.ok(e.weight<25);assert.match(e.loadSource,/失败/);
});
test('accepted calibration remembers machine identity and actual increment atomically',()=>{
 const d=base(),{store}=memoryStore();d.session=K.session(K.prescription(d,'deadlift',today,feedback,{mode:'intensity'}));store.save(d);
 store.calibrate(d.session.id,'curl-leg',{weight:45,reps:12,rir:3,quality:true,machineId:'gym-A',increment:5});
 const saved=store.load();assert.equal(saved.profile.machineIds['curl-leg'],'gym-A');assert.equal(saved.profile.exerciseIncrements['curl-leg'],5);
 const e=K.prescription(saved,'deadlift',date(4),feedback,{mode:'intensity'}).exercises.find(x=>x.id==='curl-leg');
 assert.equal(e.weight,45);assert.equal(e.increment,5);assert.equal(e.machineId,'gym-A');
 assert.equal(P.prescribe('curl-leg',saved.profile,[],'volume',{reps:12,calibrations:saved.calibrations,machineId:'gym-B'}).weight,null);
});
test('low frequency supplementation and projected work remain distinct from history',()=>{
 const d=base();d.profile.days=[1,5];const before=JSON.stringify(d);
 const p=K.prescription(d,'deadlift',today,feedback,{mode:'volume'});
 assert.match(p.exercises.find(e=>e.id==='dbbench').selectionReason,/补足本周训练/);
 const projected=[{date:date(-2),exercises:[{...C.byId('dbbench'),sets:2}]}];
 const next=K.prescription(d,'deadlift',today,feedback,{mode:'volume',projected});
 assert.ok(!next.exercises.some(e=>e.id==='dbbench'));
 K.rolling(d);assert.equal(JSON.stringify(d),before);
});
test('legacy planView preserves future preview guard',()=>{
 const p=P.planView({profile,history:[],lift:'bench',date:date(2),mode:'volume',readiness:feedback});
 assert.equal(p.previewOnly,true);assert.equal(p.canStart,false);assert.throws(()=>P.createSession(p));
});
test('all 52 teaching sets have reviewed, loadable stage manifests and source notes',()=>{
 const fs=require('node:fs'),path=require('node:path'),M=require('../miniprogram/lib/media-manifest');
 assert.equal(C.exercises.length,52);let stages=0;
 for(const e of C.exercises){
  const m=M[e.id],source=require('../docs/media-sources/'+e.id+'.json');
  assert.equal(m.status,'reviewed');assert.equal(source.status,'reviewed');assert.ok(source.reviewNotes);
  assert.equal(m.frames.length,m.phases);assert.ok(m.phases>=2&&m.phases<=4);stages+=m.phases;
  assert.ok(fs.statSync(path.join(__dirname,'../miniprogram',m.path)).size>1000);
  for(const frame of m.frames)assert.ok(Object.values(frame).every(Number.isFinite));
 }
 assert.equal(stages,153);
});
test('unknown/legacy machine units and different variants cannot borrow capability',()=>{
 const history=[record('x','row',25),record('y','curl-leg',45,12,{machineId:'gym-A'})];
 assert.equal(P.prescribe('curl-leg',profile,history,'volume',{reps:12,machineId:'gym-B'}).weight,null);
 assert.equal(P.prescribe('onearm-row',profile,history,'volume').weight,null);
 delete history[0].sets[0].loadConvention;assert.equal(P.prescribe('row',profile,history,'volume').weight,null);
 assert.equal(history[0].sets[0].weight,25);
});
test('assistance inverse progression does not use free-weight rep formulas',()=>{
 const one=record('a','assisted-pullup',50),two=record('b','assisted-pullup',50);
 two.date=date(-8);assert.equal(P.prescribe('assisted-pullup',profile,[one,two],'volume').weight,47.5);
 assert.equal(P.prescribe('assisted-pullup',profile,[one],'volume',{reps:8}).weight,null);
});
test('v2 migration makes backup before write and preserves ambiguous values',()=>{
 const {store,memory}=memoryStore();const old={...base(),version:2,history:[record('legacy','row',17.5)]};delete old.calibrations;delete old.history[0].sets[0].loadConvention;
 memory[S.KEY]=JSON.stringify(old);const raw=memory[S.KEY];store.save(store.load());
 assert.equal(memory[S.KEY+'-v2-backup'],raw);assert.equal(store.load().history[0].sets[0].weight,17.5);assert.equal(store.load().history[0].sets[0].loadConvention,undefined);
});
test('skip recovery does not fabricate work, and actual alternate lift replans the window',()=>{
 const {store}=memoryStore(),d=base();store.save(d);
 const p=K.prescription(d,'deadlift',today,feedback,{mode:'recovery'});assert.equal(p.skipAllowed,true);
 store.event({id:p.planId,kind:'skip',date:today,lift:'deadlift'});assert.equal(store.load().history.length,0);
 const before=K.rolling(store.load());const s=K.session(K.prescription(d,'bench',today,feedback,{mode:'volume'}));s.sets[0].done=true;store.save({...store.load(),session:s});store.finish(s);
 const after=K.rolling(store.load());assert.notDeepEqual(after,before);assert.equal(after[0].mode,'completed');assert.equal(store.load().history[0].sets.length,1);assert.throws(()=>store.finish(s),/已经保存/);
});
