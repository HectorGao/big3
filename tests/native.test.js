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
 const wx={showToast(){},switchTab(){},showModal({success}){success({confirm:true});},showActionSheet({success}){success({tapIndex:0});}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:d=>{definition=d;},getApp:()=>app,wx,require:createRequire(file),setInterval,clearInterval,Date,console});
 const instance={...definition,data:JSON.parse(JSON.stringify(definition.data))};
 instance.setData=function(values){for(const [key,value] of Object.entries(values)){const keys=key.replace(/\[(\d+)\]/g,'.$1').split('.');let target=this.data;for(const part of keys.slice(0,-1))target=target[part];target[keys.at(-1)]=value;}};
 return instance;
}
function setup(){let raw;return {globalData:{},store:S.createStore({getStorageSync:()=>raw,setStorageSync:(k,v)=>{raw=v;}})};}
test('native pages exist and every WXML event resolves to a page handler',()=>{
 const app=setup();const config=JSON.parse(fs.readFileSync(path.join(root,'app.json')));
 for(const route of config.pages){const basename=path.join(root,route);for(const ext of ['js','json','wxml','wxss'])assert.ok(fs.existsSync(basename+'.'+ext));const instance=page(route.split('/')[1],app);const wxml=fs.readFileSync(basename+'.wxml','utf8');for(const match of wxml.matchAll(/(?:bind|catch)(?:tap|change|input|blur)="([^"]+)"/g))assert.equal(typeof instance[match[1]],'function',route+': '+match[1]);}
});
test('native first launch, profile save, replacement, actual set log, and history flow',()=>{
 const app=setup();const today=page('today',app);today.refresh();assert.equal(today.data.plan.mode,'setup');
 const profile=page('profile',app);profile.onShow();profile.data.profile.age=30;profile.data.profile.weight=75;profile.data.profile.experience='trained';profile.data.pbRows[0].weight=100;profile.save();assert.equal(profile.data.error,'');
 today.refresh();assert.equal(today.data.plan.exercises[0].weight,70);today.replace({currentTarget:{dataset:{index:1}}});assert.equal(today.data.plan.exercises[1].id,'goblet');today.start();assert.ok(today.data.session.sets.some(s=>s.exercise==='goblet'));today.toggleSet({currentTarget:{dataset:{index:0}}});assert.equal(today.data.error,'');assert.equal(app.store.load().session.sets[0].done,true);today.finish();assert.equal(app.store.load().history.length,1);assert.equal(app.store.load().history[0].completed,false);assert.equal(today.data.plan.canStart,true);assert.equal(today.data.plan.mode,'recovery');
 const history=page('history',app);history.refresh();assert.equal(history.data.total,1);assert.equal(history.data.tonnage,350);
});
test('native canvas pick carries selected muscle into atlas tab',()=>{
 const app=setup();const today=page('today',app);today.atlas({detail:{id:'chest'}});const atlas=page('atlas',app);atlas.onShow();assert.equal(atlas.data.muscle,'chest');assert.ok(atlas.data.exercises.some(e=>e.id==='bench'));
});
test('native stale sessions cannot add new sets',()=>{
 const app=setup();const profile={age:30,weight:75,experience:'beginner',goal:'strength',days:[1,3,5],increment:2.5,pb:{}};
 const session=P.createSession(P.makePlan({profile,date:'2026-09-01'}));session.sets[0].weight=10;app.store.save({...app.store.load(),profile,session});const today=page('today',app);today.refresh();today.toggleSet({currentTarget:{dataset:{index:0}}});assert.match(today.data.error,/跨日/);assert.equal(app.store.load().session.sets[0].done,false);
});
test('native PB estimate, editable weight/reps, and per-set reserve share web calculations',()=>{
 const app=setup();const profile=page('profile',app);profile.onShow();profile.data.profile={...profile.data.profile,age:30,weight:75,experience:'trained'};profile.data.pbRows[0].weight=120;profile.data.pbRows[0].reps=5;profile.estimates();assert.equal(profile.data.pbRows[0].estimate.range,'135–140');profile.save();
 const today=page('today',app);today.refresh();assert.equal(today.data.plan.exercises[0].weight,95);today.editPlan({currentTarget:{dataset:{index:0,field:'weight'}},detail:{value:'100'}});assert.equal(today.data.plan.exercises[0].reps,3);today.start();assert.equal(today.data.session.sets[0].weight,'100');assert.equal(today.data.session.sets[0].reps,3);today.setRir({currentTarget:{dataset:{index:0}},detail:{value:'4'}});assert.equal(app.store.load().session.sets[0].rir,3);
});
test('native browsing another lift preserves and resumes current workout',()=>{const app=setup();const p={age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{}};const session=P.createSession(P.makePlan({profile:p,lift:'bench'}));app.store.save({...app.store.load(),profile:p,session});const today=page('today',app);today.refresh();for(const lift of ['squat','deadlift','bench']){today.changeLift({currentTarget:{dataset:{id:lift}}});assert.equal(today.data.lift,lift);assert.equal(today.data.showSession,false);assert.ok(today.data.plan.exercises.length);assert.equal(app.store.load().session.id,session.id);}today.resume();assert.equal(today.data.showSession,true);assert.equal(today.data.lift,'bench');});
