const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const P=require('../miniprogram/lib/planner'),Store=require('../miniprogram/lib/store');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-browser-'));
const child=spawn(process.execPath,['preview/server.js'],{cwd:root,env:{...process.env,PORT:'0',BIG3_DB:path.join(dir,'accounts.sqlite')},stdio:['ignore','pipe','pipe']});
const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);child.stdout.on('data',b=>{const url=b.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(url){clearTimeout(timer);resolve(url);}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Test server exited'));});});
(async()=>{let browser;try{
 const url=await ready;assert.equal((await fetch(url+'/preview/..%2fruntime/big3.sqlite')).status,403);browser=await chromium.launch({headless:true,channel:'chrome'});fs.mkdirSync(path.join(root,'playwright-report'),{recursive:true});
 const fixture={...Store.empty(),profile:{age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:120,reps:1,date:P.dateKey()},bench:{weight:90,reps:1,date:P.dateKey()},deadlift:{weight:150,reps:1,date:P.dateKey()}}},feedback:[{date:P.dateKey(),fatigue:1,pain:false,soreness:{}}]};
 for(const width of [1280,768,640,390,360]){
  const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  const key='three-lift-v1-qa-workbench-'+width;await p.goto(url+'/preview/index.html?qa=workbench-'+width+'#today');await p.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});await p.reload();
  await p.locator('#free-mode').selectOption('volume');await p.locator('[data-action="add-exercise"]').click();
  await p.locator('[data-action="picker-type"][data-type="器械"]').click();
  await p.screenshot({path:path.join(root,'playwright-report/picker-'+width+'.png')});
  assert.equal(await p.locator('#detail').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  await p.locator('[data-action="picker-select"][data-id="legpress"]').click();assert.equal(await p.locator('[data-plan="legpress"][data-field="weight"]').inputValue(),'');
  await p.locator('[data-action="start"]').click();
  await p.locator('[data-action="browse-plan"]').click();assert.ok(await p.locator('.workout-toolbar [data-action="resume"]').isVisible());await p.locator('.workout-toolbar [data-action="resume"]').click();
  const oldTargets=await p.evaluate(()=>data.session.sets.map(s=>[s.targetWeight,s.targetReps]));
  await p.locator('[data-action="direct-load"][data-id="legpress"]').click();
  assert.equal(await p.locator('[name="machineId"]').inputValue(),'');await p.locator('#direct-load-form [name="weight"]').fill('80');await p.locator('#direct-load-form [name="reps"]').fill('10');await p.locator('#direct-load-form [type="submit"]').click();
  assert.deepEqual(await p.evaluate(()=>data.session.sets.map(s=>[s.targetWeight,s.targetReps])),oldTargets);
  const legIndex=await p.evaluate(()=>data.session.sets.findIndex(s=>s.exercise==='legpress'));
  await p.locator('[data-action="toggle-set"][data-index="'+legIndex+'"]').click();
  await p.locator('[data-action="skip-set"][data-index="0"]').click();assert.equal(await p.locator('[data-set="0"][data-field="weight"]').isDisabled(),true);
  await p.locator('[data-action="undo-set"][data-index="0"]').click();assert.equal(await p.locator('[data-set="0"][data-field="weight"]').isDisabled(),false);
  await p.locator('[data-action="skip-set"][data-index="0"]').click();await p.evaluate(()=>window.scrollTo(0,0));
  await p.screenshot({path:path.join(root,'playwright-report/workbench-'+width+'.png')});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.locator('[data-workout-exercise="legpress"] [data-action="detail"]').last().click();await p.waitForFunction(()=>document.querySelector('#teaching-image')?.naturalWidth>0);await p.locator('[data-action="close"]').click();
  await p.locator('[data-action="finish"]').click();const saved=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(saved.history.length,1);assert.equal(saved.history[0].sets.length,1);assert.equal(saved.history[0].skippedSets.length,1);assert.equal(saved.history[0].sets[0].weight,80);assert.deepEqual(errors,[]);await p.close();
  console.log('PASS '+width+'px: muscle/equipment picker, manual load, frozen targets, illustration, skip, partial save, overflow');
 }
 const ctxA=await browser.newContext({viewport:{width:1280,height:900}}),ctxB=await browser.newContext({viewport:{width:390,height:900}}),ctxC=await browser.newContext({viewport:{width:360,height:900}});
 const a=await ctxA.newPage(),b=await ctxB.newPage(),c=await ctxC.newPage(),errors=[];
 for(const p of [a,b,c]){p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(url+'/preview/index.html#today');await p.waitForFunction(()=>MuscleSync.setupRequired!==undefined);}
 await a.evaluate(f=>localStorage.setItem('three-lift-v1',JSON.stringify(f)),fixture);await a.reload();await a.waitForFunction(()=>MuscleSync.setupRequired===true);
 const password=crypto.randomBytes(18).toString('hex');
 async function auth(p,name,kind){await p.locator('[data-action="account"]').click();if(kind==='register')await p.locator('[data-action="auth-register"]').click();await p.locator('[name="username"]').fill(name);await p.locator('[name="password"]').fill(password);if(await p.locator('[name="privacy"]').count())await p.locator('[name="privacy"]').check();await p.locator('#account-form [type="submit"]').click();await p.waitForFunction(()=>!!MuscleSync.user);}
 await auth(a,'owner','setup');assert.equal(await a.evaluate(()=>data.profile),null);
 await a.locator('[data-action="import-guest"]').click();await a.waitForFunction(()=>data.profile?.weight===75&&MuscleSync.status==='已同步');await a.locator('[data-action="close"]').click();
 await b.reload();await b.waitForFunction(()=>MuscleSync.setupRequired===false);await auth(b,'owner','login');await b.locator('[data-action="close"]').click();assert.equal(await b.evaluate(()=>data.profile.weight),75);
 await b.evaluate(()=>{store.save({...data,profile:{...data.profile,weight:81}});return MuscleSync.flush();});await a.evaluate(()=>MuscleSync.refresh());assert.equal(await a.evaluate(()=>data.profile.weight),81);
 await c.reload();await c.waitForFunction(()=>MuscleSync.setupRequired===false);await auth(c,'member','register');await c.locator('[data-action="close"]').click();assert.equal(await c.evaluate(()=>data.profile),null);
 assert.equal(await c.evaluate(async()=>{try{await MuscleSync.api('admin/users');return 200;}catch(e){return e.status;}}),403);
 await a.locator('.community-trigger').click();await a.locator('#message-body').fill('100 kg lightweight <img src=x onerror=alert(1)>');await a.locator('[data-action="emoji"]').first().click();await a.locator('#message-form [type="submit"]').click();await a.waitForFunction(()=>document.querySelectorAll('.message').length===1);
 assert.equal(await a.locator('.message img').count(),0);await c.locator('.community-trigger').click();await c.locator('.message').waitFor();assert.match(await c.locator('.message p').textContent(),/💪/);assert.equal(await c.locator('[data-action="delete-message"]').count(),0);
 await a.locator('[data-action="visibility-message"]').click();assert.equal(await a.evaluate(async()=>(await MuscleSync.api('board')).messages.length),0);await a.locator('[data-action="visibility-message"]').click();assert.equal(await a.evaluate(async()=>(await MuscleSync.api('board')).messages.length),1);
 await c.screenshot({path:path.join(root,'playwright-report/community-mobile.png')});assert.equal(await c.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await a.locator('[data-action="close"]').click();await a.locator('[data-action="account"]').click();await a.locator('[data-action="admin"]').click();await a.locator('[data-action="admin-user"]').first().click();await a.locator('.admin-json').waitFor({state:'attached'});assert.match(await a.locator('#dialog-content').textContent(),/训练记录/);await a.screenshot({path:path.join(root,'playwright-report/admin-desktop.png')});await a.locator('[data-action="close"]').click();
 await ctxA.setOffline(true);await a.evaluate(()=>store.save({...data,profile:{...data.profile,weight:82}}));await a.evaluate(()=>MuscleSync.flush().catch(()=>{}));
 await b.evaluate(()=>{store.save({...data,profile:{...data.profile,weight:83}});return MuscleSync.flush();});await ctxA.setOffline(false);await a.evaluate(()=>MuscleSync.refresh().catch(()=>{}));await a.waitForFunction(()=>MuscleSync.conflict===true);
 await a.locator('[data-action="account"]').click();await a.locator('[data-action="sync-remote"]').click();await a.waitForFunction(()=>data.profile.weight===83);assert.equal(await a.evaluate(()=>JSON.parse(localStorage.getItem('three-lift-v1-account-'+MuscleSync.user.id+'-conflict-backup')).profile.weight),82);
 assert.deepEqual(errors,[]);console.log('PASS accounts: guest import opt-in, admin setup, two-device sync, isolation, safe message/emoji, audited admin view, offline conflict backup');
 }finally{if(browser)await browser.close();await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
})().catch(e=>{console.error(e);process.exitCode=1;});
