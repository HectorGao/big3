const {test}=require('node:test'),assert=require('node:assert/strict');
const {snapshot}=require('../server/research-export'),{prepare}=require('../research/prepare');
const Store=require('../miniprogram/lib/store'),P=require('../miniprogram/lib/planner'),K=require('../miniprogram/lib/coach');
const now=new Date(),today=P.dateKey(now),date=n=>K.add(today,n);
// These are in-memory test fixtures, not research participants or seed data.
function person(id='person-1',extra={}){
 const data=Store.empty();data.profile={age:30,weight:80,experience:'trained',goal:'strength'};
 data.history=Array.from({length:10},(_,i)=>({id:'session-'+i,date:date(-30+i*3),lift:'squat',mode:'volume',rpe:7,
  readiness:{fatigue:2,pain:false},sets:[{key:'squat-0',exercise:'squat',weight:80,reps:6,rir:2+(i%2),done:true,quality:true,success:true,unit:'次',loadConvention:'barbell-total',targetWeight:80,targetReps:6,targetRir:3,targetSetCount:3}]}));
 return {id,consent:1,is_demo:0,revision:2,updated:now.toISOString(),data:JSON.stringify(data),...extra};
}
const make=rows=>snapshot(rows||[person()],'https://test.invalid',now.toISOString());
const run=d=>prepare(d,{now});
test('research schema excludes non-consenting/demo users, synthetic sessions, identity and free text',()=>{
 const row=person(),d=JSON.parse(row.data);d.profile.name='private name';d.history[0].notes='private note';d.history[0].sets[0].machineId='private gym';d.history.push({...d.history[0],id:'simulation',synthetic:true});
 row.data=JSON.stringify(d);
 const result=make([row,person('no',{consent:0}),person('demo',{is_demo:1}),person('synthetic',{data:JSON.stringify({...d,synthetic:true})})]);
 assert.equal(result.records.length,1);assert.equal(result.records[0].history.length,10);assert.ok(!JSON.stringify(result).includes('private'));assert.ok(!JSON.stringify(result).includes('person-1'));
 assert.deepEqual(result.consentParticipants,[result.records[0].participant]);assert.equal(result.records[0].history[0].sets[0].done,true);
});
test('management backup, old schema, stale and future snapshots are refused',()=>{
 assert.throws(()=>run({kind:'big3-admin-archive'}),/管理备份/);
 assert.throws(()=>run({...make(),schema:1}),/schema 2/);
 assert.throws(()=>run({...make(),createdAt:new Date(+now-15*86400000).toISOString()}),/14 天/);
 assert.throws(()=>run({...make(),createdAt:new Date(+now+1).toISOString()}),/时间/);
});
test('only completed comparable work with frozen dose and exact RIR is labelled',()=>{
 const d=make(),s=d.records[0].history[0],original=s.sets[0];
 const changes=[{done:false},{skipped:true},{calibration:true},{warmup:true},{quality:null},{success:false},{targetWeight:null},{rir:null},{rir:5},{weight:90},{reps:5},{loadConvention:null}];
 s.sets=changes.map((change,i)=>({...original,id:'excluded-'+i,...change}));
 const result=run(d);assert.equal(result.rows.length,9);assert.equal(result.report.excluded.notWorkSet,4);assert.equal(result.report.excluded.changedDose,2);assert.equal(result.report.excluded.missingOrCensoredRir,2);
 assert.equal(result.report.canDeploy,false);assert.equal(result.report.trainedModel,false);
});
test('machine identity, duration, assistance and bodyweight cannot be pooled with kg repetitions',()=>{
 const d=make();for(const [i,patch] of [{exercise:'legpress',loadConvention:'machine-stack'}, {exercise:'plank',unit:'秒',loadConvention:'bodyweight'},{exercise:'assisted-pullup',loadConvention:'assistance'}].entries())Object.assign(d.records[0].history[i].sets[0],patch);
 assert.equal(run(d).rows.length,7);
});
test('duplicate snapshots are not accumulated; duplicate IDs deduplicate and conflicts fail closed',()=>{
 const d=make(),h=d.records[0].history;h.push(structuredClone(h[0]));
 const a=run(d),b=run(d);assert.deepEqual(a,b);assert.equal(a.rows.length,10);
 h.at(-1).sets[0].weight=90;assert.throws(()=>run(d),/冲突/);
});
test('withdrawal removes participant on next complete export and prevents roster mismatch',()=>{
 const a=run(make([person(),person('other')]));assert.equal(a.report.inputParticipants,2);
 const b=run(make([person(),person('other',{consent:0})]));assert.equal(b.report.inputParticipants,1);
 const bad=make();bad.consentParticipants=[];assert.throws(()=>run(bad),/名单/);
});
test('current profile never backfills past features; only frozen context is eligible',()=>{
 const d=make();d.records[0].profile={age:99,weight:200};
 const a=run(d);assert.ok(a.rows.every(r=>r.features.age===null&&r.features.bodyweight===null));
 d.records[0].history[0].context={schema:1,date:date(-30),profile:{age:30,weight:80},plannerVersion:'0.2.5'};
 const b=run(d);assert.equal(b.rows[0].features.bodyweight,80);assert.equal(b.rows[1].features.bodyweight,null);
});
test('no same-day/future outcome leakage and no participant/time overlap in evaluation splits',()=>{
 const d=make(Array.from({length:20},(_,i)=>person('person-'+i))),a=run(d);
 for(const p of d.records){const last=p.history.at(-1);last.sets[0].rir=0;}
 const b=run(d);assert.deepEqual(b.rows.filter(r=>r.date<date(-3)),a.rows.filter(r=>r.date<date(-3)));
 const train=a.rows.filter(r=>r.split==='train'),validation=a.rows.filter(r=>r.split==='validation'),testRows=a.rows.filter(r=>r.split==='test'),newUsers=a.rows.filter(r=>r.split==='newUsers');
 assert.ok(train.length&&validation.length&&testRows.length&&newUsers.length);
 assert.ok(train.at(-1).date<validation[0].date&&validation.at(-1).date<testRows[0].date);
 const known=new Set([...train,...validation,...testRows].map(r=>r.participant));assert.ok(newUsers.every(r=>!known.has(r.participant)));
 assert.ok(a.rows.filter(r=>r.date===date(-30)).every(r=>r.features.previousWeight===null));
 const same=make(),h=same.records[0].history;h[1].date=h[0].date;
 assert.ok(run(same).rows.filter(r=>r.date===date(-30)).every(r=>r.features.previousResidual===null));
});
test('retrospective, synthetic, pain, redated and future work cannot become regression labels',()=>{
 const d=make(),h=d.records[0].history;h[0].retrospective=true;h[1].synthetic=true;h[2].readiness.pain=true;h[3].date=date(1);
 h[4].context={schema:1,date:date(0)};assert.equal(run(d).rows.length,5);
});
test('local CLI writes private output, refuses overwrite and never imports into live data',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{run:cli}=require('../scripts/prepare-research');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-research-test-')),input=path.join(dir,'fixture.json'),out=path.join(dir,'dataset');fs.writeFileSync(input,JSON.stringify(make()));
 cli(input,out);assert.equal(fs.statSync(out).mode&0o777,0o700);assert.equal(fs.statSync(path.join(out,'dataset.json')).mode&0o777,0o600);assert.throws(()=>cli(input,out),/已存在/);
 const report=JSON.parse(fs.readFileSync(path.join(out,'report.json')));assert.equal(report.status,'collect-more-data');assert.equal(report.canDeploy,false);
});
