const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const {seedDemo,specs,DEMO_PASSWORD}=require('../server/demo');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-pb-browser-'));
(async()=>{let browser,child;try{
 const db=path.join(dir,'test.sqlite');await seedDemo(db);
 child=spawn(process.execPath,['preview/server.js'],{cwd:root,env:{...process.env,PORT:'0',BIG3_DB:db},stdio:['ignore','pipe','pipe']});
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.once('error',reject);child.stdout.on('data',b=>{const u=b.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(u){clearTimeout(timer);resolve(u);}});});
 browser=await chromium.launch({headless:true,channel:'chrome'});fs.mkdirSync(path.join(root,'playwright-report'),{recursive:true});
 for(const width of [1280,390])for(const spec of specs){
  const page=await browser.newPage({viewport:{width,height:940}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(url+'/preview/index.html#profile');await page.waitForFunction(()=>MuscleSync.setupRequired!==undefined);await page.locator('.account-trigger').click();await page.locator('[data-action=auth-login]').click();
  await page.locator('[name=username]').fill(spec.username);await page.locator('[name=password]').fill(DEMO_PASSWORD);await page.locator('#account-form [type=submit]').click();await page.waitForFunction(()=>MuscleSync.user?.demo);
  await page.locator('[data-action=close]').click();await page.evaluate(()=>location.hash='today');await page.locator('#free-mode').waitFor();
  const history=await page.evaluate(()=>JSON.stringify(data.history));
  for(const lift of ['squat','bench','deadlift']){
   await page.locator(`.lift-tile[data-lift="${lift}"]`).click();
   for(const mode of ['','recovery','volume','intensity']){
    await page.locator('#free-mode').selectOption(mode);
    const input=page.locator(`[data-plan="${lift}"][data-field=weight]`);
    const weight=Number(await input.inputValue());assert.ok(weight>0,spec.username+':'+lift+':'+mode);assert.equal(await input.getAttribute('placeholder'),'');
   }
   const weight=Number(await page.locator(`[data-plan="${lift}"][data-field=weight]`).inputValue());
   await page.locator('[data-action=start]').click();await page.locator(`[data-workout-exercise="${lift}"]`).waitFor();
   assert.equal(Number(await page.locator('[data-set="0"][data-field=weight]').inputValue()),weight);assert.equal(await page.locator('[data-set="0"][data-field=weight]').isDisabled(),false);
   assert.equal(await page.evaluate(()=>data.session.sets[0].calibrationRequired),false);
   if(spec.username==='demo'&&lift==='squat'){await page.screenshot({path:path.join(root,'playwright-report','pb-prescription-'+width+'.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   await page.locator('[data-action=discard]').click();await page.waitForFunction(()=>!data.session);await page.evaluate(()=>MuscleSync.flush());
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(data.history)),history);assert.deepEqual(errors,[]);await page.close();
  console.log('PASS '+spec.username+' '+width+'px: three PBs, four mode selectors, actual start/frozen weights, history unchanged');
 }
}finally{if(browser)await browser.close();if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
})().catch(error=>{console.error(error);process.exitCode=1;});
