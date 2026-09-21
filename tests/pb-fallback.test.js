const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../miniprogram/lib/planner'),K=require('../miniprogram/lib/coach'),C=require('../miniprogram/lib/catalog');
const {demoData,specs}=require('../server/demo');
const today=P.dateKey(),feedback={fatigue:1,pain:false,soreness:{}};
for(const [index,spec] of specs.entries())test(spec.username+' preserves same-lift PB when recent sets lack RIR',()=>{
 const d=demoData(spec,index),before=JSON.stringify(d);
 for(const lift of C.lifts)for(const mode of [undefined,'volume','intensity','technique','recovery','deload']){
  const p=K.prescription(d,lift.id,today,feedback,{mode}),e=p.exercises[0];
  assert.equal(e.id,lift.id);assert.ok(e.weight>0);assert.equal(e.calibrationRequired,false);assert.ok(e.weight<d.profile.pb[lift.id].weight);
  const s=K.session(p);assert.equal(s.sets[0].targetWeight,e.weight);assert.equal(s.sets[0].weight,e.weight);
  assert.equal(s.researchContext.plannerVersion,require('../miniprogram/lib/release').version);
 }
 const volume=K.prescription(d,'squat',today,feedback,{mode:'volume'}).exercises[0];
 const intensity=K.prescription(d,'squat',today,feedback,{mode:'intensity'}).exercises[0];
 const recovery=K.prescription(d,'squat',today,feedback,{mode:'recovery'}).exercises[0];
 assert.ok(recovery.weight<volume.weight);assert.ok(intensity.weight>volume.weight);assert.match(intensity.loadSource,/PB\/e1RM/);
 assert.equal(JSON.stringify(d),before);
});
test('PB fallback retains fatigue, failure, expiry and same-exercise boundaries',()=>{
 const d=demoData(specs[0],0),lift='squat';
 const normal=K.prescription(d,lift,today,feedback,{mode:'intensity'}).exercises[0];
 const tired=K.prescription(d,lift,today,{...feedback,fatigue:4},{mode:'intensity'});assert.equal(tired.mode,'recovery');assert.ok(tired.exercises[0].weight<normal.weight);
 assert.equal(K.prescription(d,lift,today,{...feedback,pain:true},{mode:'intensity'}).exercises.length,0);
 assert.equal(K.prescription(d,lift,today,{...feedback,fatigue:5},{mode:'intensity'}).exercises.length,0);
 d.history.unshift({id:'failed',date:K.add(today,-4),lift,mode:'intensity',completed:false,rpe:8,sets:[{exercise:lift,done:true,weight:120,reps:1,quality:false,success:false,rir:0}]});
 const failed=K.prescription(d,lift,today,feedback,{mode:'intensity'}).exercises[0];assert.ok(failed.weight<normal.weight);assert.match(failed.loadSource,/失败/);
 d.profile.pb.squat.date=K.add(today,-181);
 // Exercise-level test isolates expiry from coach-derived historical estimates.
 const recent=[{id:'recent',date:K.add(today,-4),sets:[{exercise:lift,done:true,weight:90,reps:6,rir:null}]}];
 assert.equal(P.prescribe(lift,d.profile,recent,'intensity',{main:true,reps:3,rir:2}).weight,null);
 assert.equal(P.prescribe('front-squat',d.profile,[],'volume').weight,null);
 assert.equal(P.prescribe('dbbench',d.profile,[],'volume').weight,null);
});
test('frozen session context does not change with later profile or plan edits',()=>{
 const d=demoData(specs[0],0),p=K.prescription(d,'squat',today,feedback),s=K.session(p);
 p.researchContext.profile.weight=200;d.profile.age=90;
 assert.equal(s.researchContext.profile.weight,80);assert.equal(s.researchContext.profile.age,30);
});
