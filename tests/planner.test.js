const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname, '../miniprogram/lib/planner.js');
test('planner module exists', () => assert.ok(fs.existsSync(modulePath), 'shared training engine is not implemented'));
if (fs.existsSync(modulePath)) {
  const P = require(modulePath);
  const profile = { age: 30, weight: 75, experience: 'trained', goal: 'strength', days: [1,3,5], increment: 2.5, pb: { squat: { weight: 100, reps: 1, date: '2026-09-01' } } };
  const date = '2026-09-09';
  const plan = (changes = {}, history = [], readiness = {}) => P.makePlan({ profile: {...profile,...changes}, history, readiness, lift: 'squat', date });
  const past = (date, mode = 'volume', lift = 'squat') => ({ id: date, date, lift, mode, completed: true, rpe: 7, sets: [{ exercise: lift, weight: 60, reps: 6, done: true }] });
  test('validates profile and PB, including real calendar dates', () => {
    assert.equal(P.validateProfile(profile), null);
    for (const value of [0, -1, Infinity, 'NaN']) assert.ok(P.validateProfile({...profile, weight: value}));
    assert.ok(P.validateProfile({...profile, age: 17}));
    assert.ok(P.validateProfile({...profile, days: []}));
    assert.ok(P.validateProfile({...profile, increment: 0}));
    assert.ok(P.validateProfile({...profile, pb: { squat: { weight: 100, reps: 11, date } } }));
    assert.ok(P.validateProfile({...profile, pb: { squat: { weight: 100, reps: 1, date: '2026-02-30' } } }));
    assert.equal(P.estimateMax(100,1), 100);
    assert.equal(P.estimateMax(60,5), 70);
  });
  test('no PB and beginners never receive heavy recommendations', () => {
    assert.equal(plan({pb:{}}).mode, 'technique');
    assert.equal(plan({pb:{}}).exercises[0].calibration, true);
    assert.equal(plan({pb:{}}).exercises[0].weight,null);
    assert.equal(plan({experience:'beginner'},[past('2026-09-05')]).mode, 'technique');
    assert.equal(plan({pb:{squat:{weight:100,reps:1,date:'2025-09-01'}}}).mode, 'technique');
  });
  test('cycles advance only on completed main sessions, never missed dates', () => {
    assert.equal(plan().mode, 'volume');
    assert.equal(plan({},[past('2026-09-05')]).mode, 'intensity');
    assert.equal(plan({},[past('2026-09-05','intensity')]).mode, 'volume');
    assert.equal(plan({},[past('2026-09-05','recovery')]).mode, 'volume');
    assert.equal(plan({},[{...past('2026-09-05'),completed:false}]).mode, 'volume');
    assert.equal(plan({},[past('2026-09-10')]).mode, 'volume');
    assert.equal(plan({},[past('2026-09-01','intensity'),past('2026-09-05')]).mode, 'intensity');
  });
  test('pain blocks training and recent posterior-chain sessions force rest', () => {
    assert.equal(plan({},[],{pain:true}).mode, 'rest');
    assert.equal(plan({},[past(date)]).mode, 'recovery');
    assert.equal(plan({},[past('2026-09-08','intensity','deadlift')]).mode, 'recovery');
    assert.equal(plan({},[],{fatigue:5}).mode, 'rest');
    assert.equal(plan({},[{...past('2026-09-05'),rpe:10}]).mode, 'recovery');
  });
  test('rounds main weight down and never uses main PB for assistance', () => {
    const p = plan();
    assert.equal(p.exercises[0].weight % 2.5, 0);
    assert.ok(p.exercises[0].weight <= 70);
    const changed=plan({pb:{squat:{weight:200,reps:1,date:'2026-09-01'}}});
    assert.deepEqual(p.exercises.slice(1).map(e=>e.weight),changed.exercises.slice(1).map(e=>e.weight));
    assert.ok(p.warmup.length > 0);
    assert.ok(p.exercises.every(e => e.sets > 0 && e.reps > 0));
  });
  test('record validation rejects fabricated empty completions and invalid sets', () => {
    assert.equal(P.validateRecord(past(date)), null);
    assert.ok(P.validateRecord({...past(date),sets:[]}));
    assert.ok(P.validateRecord({...past(date),sets:[{exercise:'squat',weight:-1,reps:6,done:true}]}));
    assert.ok(P.validateRecord({...past(date),rpe:11}));
  });
  test('latest incomplete high effort overrides older completed cycle',()=>{
    const p=plan({},[past('2026-09-04'),{...past('2026-09-07'),completed:false,rpe:10}]);
    assert.equal(p.mode,'recovery');
  });
  test('fatigued beginner is never assigned more weight than technique day',()=>{
    assert.ok(plan({experience:'beginner'},[],{fatigue:4}).exercises[0].weight<=plan({experience:'beginner'}).exercises[0].weight);
  });
  test('import validation rejects contradictory completed reps',()=>{
    const r=past('2026-09-04');r.sets[0].targetReps=8;
    assert.ok(P.validateRecord(r));
  });
}
