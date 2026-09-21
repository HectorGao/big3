const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const P=require('../miniprogram/lib/planner');
const S=require('../miniprogram/lib/store');
const root=path.resolve(__dirname,'../miniprogram');
function page(name,app){
 const file=path.join(root,'pages',name,name+'.js');let definition;
 const wx={showToast(){},switchTab(){},navigateTo(){},showModal({success}){success({confirm:true});},showActionSheet({success}){success({tapIndex:0});}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>{definition=d;},getApp:()=>app,wx,require:createRequire(file),setInterval,clearInterval,Date,console});
 const instance={...definition,data:JSON.parse(JSON.stringify(definition.data))};
 instance.setData=function(values){for(const [key,value] of Object.entries(values)){const keys=key.replace(/\[(\d+)\]/g,'.$1').split('.');let target=this.data;for(const part of keys.slice(0,-1))target=target[part];target[keys.at(-1)]=value;}};
 return instance;
}
function setup(){let raw;return {globalData:{},store:S.createStore({getStorageSync:()=>raw,setStorageSync:(k,v)=>{raw=v;}})};}
test('native plan folding never rewrites prescription, inputs or the active draft',()=>{
 const app=setup();app.store.save({...S.empty(),profile:{age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:120,reps:1,date:P.dateKey()}}}});
 const today=page('today',app);today.chooseMode({detail:{value:2}});today.editPlan({currentTarget:{dataset:{index:0,field:'weight'}},detail:{value:'70'}});
 const plan=JSON.stringify(today.data.plan),before=app.store.exportRaw(),id=today.data.plan.exercises[0].id;
 today.toggleExercise({currentTarget:{dataset:{id}}});assert.equal(today.data.foldedExercises[id],true);assert.equal(JSON.stringify(today.data.plan),plan);assert.equal(app.store.exportRaw(),before);
 today.toggleAllExercises();assert.equal(today.data.allPlanCollapsed,true);today.toggleAllExercises();assert.equal(today.data.allPlanCollapsed,false);assert.equal(JSON.stringify(today.data.plan),plan);
 today.start();const session=app.store.exportRaw();today.browsePlan();today.toggleAllExercises();assert.equal(app.store.exportRaw(),session);today.resume();assert.equal(app.store.exportRaw(),session);
});
test('native top preferences replace bodyweight, persist, and freeze once started',()=>{
 const K=require('../miniprogram/lib/coach'),app=setup();
 app.store.save({...S.empty(),profile:{age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:100,reps:1,date:P.dateKey()}}}});
 const today=page('today',app);today.data.lift='squat';today.chooseMode({detail:{value:3}});
 today.equipment({detail:{value:['杠铃','哑铃','器械','绳索']}});
 assert.ok(today.data.plan.exercises.some(e=>e.id==='pallof'));assert.ok(today.data.plan.exercises.every(e=>e.equipment!=='自重'));
 assert.deepEqual(today.data.plan,K.prescription(app.store.load(),'squat',P.dateKey(),today.data.readiness,{mode:'intensity'}));
 today.start();const snapshot=app.store.exportRaw();today.equipment({detail:{value:['自重']}});assert.equal(app.store.exportRaw(),snapshot);assert.match(today.data.error,/训练已开始/);
 today.data.session.sets[0]={...today.data.session.sets[0],weight:110,reps:1,done:true};today.finish();
 assert.equal(app.store.load().profile.pb.squat.weight,110);
 const profile=page('profile',app);profile.onShow();assert.equal(profile.data.pbRows[0].weight,110);assert.equal(profile.data.pbRows[0].automatic,true);
});
test('native mode/date selection and machine trial use shared prescriptions',()=>{
 const K=require('../miniprogram/lib/coach'),app=setup();
 const profile={age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{deadlift:{weight:150,reps:1,date:P.dateKey()}}};
 app.store.save({...S.empty(),profile});const today=page('today',app);today.data.lift='deadlift';today.refresh();
 today.chooseMode({detail:{value:4}});const light=today.data.plan.exercises[0].weight;
 today.chooseMode({detail:{value:3}});assert.ok(today.data.plan.exercises[0].weight>light);
 assert.deepEqual(today.data.plan,K.prescription(app.store.load(),'deadlift',P.dateKey(),today.data.readiness,{mode:'intensity'}));
 today.start();today.calibrate({currentTarget:{dataset:{id:'curl-leg'}}});
 Object.assign(today.data.trial,{weight:45,reps:12,rir:4,quality:true,machineId:'gym-A',increment:5});today.saveTrial();
 assert.equal(app.store.load().profile.machineIds['curl-leg'],'gym-A');assert.equal(today.data.session.sets.find(s=>s.exercise==='curl-leg').weight,45);
 today.data.showSession=false;today.chooseDate({detail:{value:K.add(P.dateKey(),1)}});assert.equal(today.data.plan.previewOnly,true);assert.equal(today.data.plan.canStart,false);
});
test('native recovery feedback follows viewed date and rejects future feedback',()=>{
 const K=require('../miniprogram/lib/coach'),app=setup(),overview=page('overview',app);
 overview.data.viewDate=K.add(P.dateKey(),-1);overview.feedback();assert.equal(overview.data.feedback.date,overview.data.viewDate);
 overview.data.feedback=null;overview.data.viewDate=K.add(P.dateKey(),1);overview.feedback();assert.equal(overview.data.feedback,null);assert.match(overview.data.error,/未来状态/);
});
test('native pages exist and every WXML event resolves to a page handler',()=>{
 const app=setup();const config=JSON.parse(fs.readFileSync(path.join(root,'app.json')));
 for(const route of config.pages){const basename=path.join(root,route);for(const ext of ['js','json','wxml','wxss'])assert.ok(fs.existsSync(basename+'.'+ext));const instance=page(route.split('/')[1],app);const wxml=fs.readFileSync(basename+'.wxml','utf8');for(const match of wxml.matchAll(/(?:bind|catch)(?:tap|change|input|blur)="([^"]+)"/g))assert.equal(typeof instance[match[1]],'function',route+': '+match[1]);}
});
test('native first launch, profile save, replacement, actual set log, and history flow',()=>{
 const app=setup();const today=page('today',app);today.refresh();assert.equal(today.data.plan.mode,'setup');
 const profile=page('profile',app);profile.onShow();profile.data.profile.age=30;profile.data.profile.weight=75;profile.data.profile.experience='trained';profile.data.pbRows[0].weight=100;profile.save();assert.equal(profile.data.error,'');
 today.refresh();assert.equal(today.data.plan.exercises[0].weight,65);today.replace({currentTarget:{dataset:{index:1}}});assert.equal(today.data.plan.exercises[1].id,'goblet');today.start();assert.ok(today.data.session.sets.some(s=>s.exercise==='goblet'));today.toggleSet({currentTarget:{dataset:{index:0}}});assert.equal(today.data.error,'');assert.equal(app.store.load().session.sets[0].done,true);today.finish();assert.equal(app.store.load().history.length,1);assert.equal(app.store.load().history[0].completed,false);assert.equal(today.data.plan.canStart,true);assert.equal(today.data.plan.mode,'recovery');
 const history=page('history',app);history.refresh();assert.equal(history.data.total,1);assert.equal(history.data.workSets,1);
});
test('native canvas pick carries selected muscle into atlas tab',()=>{
 const app=setup();const today=page('today',app);today.atlas({detail:{id:'chest'}});const atlas=page('atlas',app);atlas.onShow();assert.equal(atlas.data.muscle,'chest');assert.ok(atlas.data.exercises.some(e=>e.id==='bench'));
});
test('native stale sessions cannot add new sets',()=>{
 const app=setup();const profile={age:30,weight:75,experience:'beginner',goal:'strength',days:[1,3,5],increment:2.5,pb:{}};
 const session=P.createSession(P.makePlan({profile}));session.date='2026-09-01';session.sets[0].weight=10;app.store.save({...app.store.load(),profile,session});const today=page('today',app);today.refresh();today.toggleSet({currentTarget:{dataset:{index:0}}});assert.match(today.data.error,/跨日/);assert.equal(app.store.load().session.sets[0].done,false);
});
test('native PB estimate, editable weight/reps, and per-set reserve share web calculations',()=>{
 const app=setup();const profile=page('profile',app);profile.onShow();profile.data.profile={...profile.data.profile,age:30,weight:75,experience:'trained'};profile.data.pbRows[0].weight=120;profile.data.pbRows[0].reps=5;profile.estimates();assert.equal(profile.data.pbRows[0].estimate.range,'135–140');profile.save();
 const today=page('today',app);today.refresh();assert.equal(today.data.plan.exercises[0].weight,90);today.editPlan({currentTarget:{dataset:{index:0,field:'weight'}},detail:{value:'100'}});assert.equal(today.data.plan.exercises[0].reps,2);today.start();assert.equal(today.data.session.sets[0].weight,'100');assert.equal(today.data.session.sets[0].reps,2);today.setRir({currentTarget:{dataset:{index:0}},detail:{value:'4'}});assert.equal(app.store.load().session.sets[0].rir,3);
});
test('native browsing another lift preserves and resumes current workout',()=>{const app=setup();const p={age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{}};const session=P.createSession(P.makePlan({profile:p,lift:'bench'}));app.store.save({...app.store.load(),profile:p,session});const today=page('today',app);today.refresh();for(const lift of ['squat','deadlift','bench']){today.changeLift({currentTarget:{dataset:{id:lift}}});assert.equal(today.data.lift,lift);assert.equal(today.data.showSession,false);assert.ok(today.data.plan.exercises.length);assert.equal(app.store.load().session.id,session.id);}today.resume();assert.equal(today.data.showSession,true);assert.equal(today.data.lift,'bench');});
test('native direct load, frozen plan navigation and explicit skip preserve actual-only history',()=>{
 const app=setup(),profile={age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{deadlift:{weight:150,reps:1,date:P.dateKey()}}};
 app.store.save({...S.empty(),profile});const today=page('today',app);today.data.lift='deadlift';today.chooseMode({detail:{value:3}});today.start();
 const before=JSON.stringify(today.data.session.sets.map(r=>[r.targetWeight,r.targetReps]));
 today.directLoad({currentTarget:{dataset:{id:'curl-leg'}}});Object.assign(today.data.manualLoad,{weight:40,reps:12,machineId:'gym-test'});today.saveLoad();
 assert.equal(today.data.session.sets.find(r=>r.exercise==='curl-leg').weight,40);assert.equal(app.store.load().calibrations.length,0);
 today.browsePlan();assert.equal(today.data.plan.canStart,false);assert.equal(today.data.plan.exercises.find(e=>e.id==='curl-leg').weight,null);today.resume();
 assert.equal(JSON.stringify(today.data.session.sets.map(r=>[r.targetWeight,r.targetReps])),before);
 today.skipSet({currentTarget:{dataset:{index:0}}});assert.equal(today.data.session.sets[0].skipped,true);
 const index=today.data.session.sets.findIndex(r=>r.exercise==='curl-leg');today.toggleSet({currentTarget:{dataset:{index}}});today.finish();
 assert.equal(app.store.load().history[0].sets.length,1);assert.equal(app.store.load().history[0].skippedSets.length,1);
});
