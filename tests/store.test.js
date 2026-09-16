const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createStore}=require('../miniprogram/lib/store');
const P=require('../miniprogram/lib/planner');
const profile={age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{}};
function setup(){const memory={};const driver={getStorageSync:k=>memory[k],setStorageSync:(k,v)=>{memory[k]=v;}};return {memory,driver,store:createStore(driver)};}
test('storage round trip and raw export preserve actual user data',()=>{
 const {store}=setup();const d=store.load();d.profile=profile;store.save(d);assert.deepEqual(store.load().profile,profile);assert.equal(JSON.parse(store.exportRaw()).version,2);
});
test('corrupt storage is not silently replaced',()=>{const {store,driver}=setup();driver.setStorageSync('three-lift-v1','bad-json');assert.throws(()=>store.load(),/未覆盖/);assert.equal(store.exportRaw(),'bad-json');});
test('write failure is surfaced',()=>{const {store,driver}=setup();driver.setStorageSync=()=>{throw Error('quota');};assert.throws(()=>store.save(store.load()),/quota/);});
test('empty session cannot be logged, partial session does not advance cycle',()=>{
 const {store}=setup();const d=store.load();d.profile=profile;store.save(d);const s=P.createSession(P.makePlan({profile,lift:'squat'}));assert.throws(()=>store.finish(s));s.sets[0].weight=10;s.sets[0].done=true;const r=store.finish(s);assert.equal(r.completed,false);assert.equal(store.load().history.length,1);assert.throws(()=>store.finish(s),/已经保存/);
});
test('invalid backups leave old data intact',()=>{const {store}=setup();const d=store.load();d.profile=profile;store.save(d);const before=store.exportRaw();assert.throws(()=>store.importRaw('{"version":2}'));assert.equal(store.exportRaw(),before);});
test('shortened main reps do not count as a completed prescribed session',()=>{
 const {store}=setup();const s=P.createSession(P.makePlan({profile,lift:'squat'}));s.sets.forEach(row=>{row.done=true;row.weight=10;});s.sets[0].reps=1;assert.equal(store.finish(s).completed,false);
});
test('old session cannot clear a different active workout',()=>{
 const {store}=setup();const a=P.createSession(P.makePlan({profile,lift:'squat'}));const b=P.createSession(P.makePlan({profile,lift:'bench'}));store.save({...store.load(),profile,session:b});a.sets[0].weight=10;a.sets[0].done=true;assert.throws(()=>store.finish(a),/变化/);assert.equal(store.load().session.id,b.id);
});
test('cross-day archive uses conservative finish date for recovery',()=>{
 const {store}=setup();const s=P.createSession(P.makePlan({profile,lift:'squat',date:'2026-09-01'}));s.sets[0].weight=10;s.sets[0].done=true;store.save({...store.load(),profile,session:s});assert.equal(store.finish(s).date,P.dateKey());
});
