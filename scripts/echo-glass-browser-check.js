const {chromium}=require('playwright'),{PNG}=require('pngjs'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const {seedDemo}=require('../server/demo'),P=require('../miniprogram/lib/planner'),Store=require('../miniprogram/lib/store');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-echo-glass-')),shots=path.join(root,'playwright-report');
const fixture={...Store.empty(),profile:{age:30,weight:80,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:120,reps:1,date:P.dateKey()},bench:{weight:90,reps:1,date:P.dateKey()},deadlift:{weight:160,reps:1,date:P.dateKey()}}}};
function difference(a,b){assert.equal(a.length,b.length);let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;}
(async()=>{let browser,child;try{
 const db=path.join(dir,'test.sqlite');await seedDemo(db);
 child=spawn(process.execPath,['preview/server.js'],{cwd:root,env:{...process.env,PORT:'0',BIG3_DB:db},stdio:['ignore','pipe','pipe']});
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.once('error',reject);child.stdout.on('data',b=>{const u=b.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(u){clearTimeout(timer);resolve(u);}});});
 browser=await chromium.launch({headless:true,channel:'chrome'});fs.mkdirSync(shots,{recursive:true});
 for(const width of [1280,768,390,360]){
  const page=await browser.newPage({viewport:{width,height:960},hasTouch:width<500}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const qa='glass-'+width,key=Store.KEY+'-qa-'+qa,target=url+'/preview/index.html?qa='+qa;
  await page.goto(target+'#profile');await page.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});await page.reload();
  await page.locator('.echo-card').first().waitFor();const state=await page.evaluate(()=>JSON.stringify(data));
  for(const route of ['overview','today','atlas','history','profile']){
   await page.locator(`#nav [href="#${route}"]`).click();
   await page.waitForFunction(route=>document.querySelector('#page-label').textContent===({overview:'概览',today:'今日训练',atlas:'肌肉图谱',history:'训练记录',profile:'我的档案'})[route],route);
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('main')).transform==='none');
   const pos=await page.evaluate(()=>{const main=document.querySelector('main'),echo=document.querySelector('#message-ribbon'),footer=document.querySelector('.global-footer');return {after:main.nextElementSibling===echo,below:echo.getBoundingClientRect().top>=main.getBoundingClientRect().bottom-1,footer:echo.nextElementSibling===footer,position:getComputedStyle(echo).position,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert.deepEqual(pos,{after:true,below:true,footer:true,position:'relative',overflow:false},`${width}px ${route}`);
  }
  await page.locator('[data-action=ribbon-pause]').click();await page.evaluate(()=>scrollTo(0,0));await page.mouse.move(0,0);
  await page.screenshot({path:path.join(shots,`liquid-profile-${width}.png`)});
  const main=await page.locator('main').boundingBox(),clip={x:main.x+2,y:Math.max(0,main.y)+2,width:main.width-4,height:550};
  const visible=PNG.sync.read(await page.screenshot({clip}));
  await page.locator('#message-background').evaluate(el=>el.style.visibility='hidden');
  const hidden=PNG.sync.read(await page.screenshot({clip}));
  const diff=difference(visible.data,hidden.data);assert.ok(diff>.6,`Background should be visible through content, difference ${diff}`);
  await page.locator('#message-background').evaluate(el=>el.style.removeProperty('visibility'));
  await page.locator('#message-ribbon').scrollIntoViewIfNeeded();await page.mouse.move(0,0);
  await page.screenshot({path:path.join(shots,`liquid-footer-${width}.png`)});
  const card=page.locator('.echo-card').first();assert.match(await card.evaluate(e=>getComputedStyle(e).backdropFilter),/blur\(18px\).*saturate/);
  for(const button of await page.locator('.echo-band-heading button').all()){const b=await button.boundingBox();assert.ok(b.width>=44&&b.height>=44);}
  if(width===1280){
   const box=await card.boundingBox();await page.mouse.move(box.x+10,box.y+10);await page.waitForFunction(()=>document.querySelector('.echo-card').style.getPropertyValue('--glass-angle'));
   const angle=await card.evaluate(e=>e.style.getPropertyValue('--glass-angle')),first=PNG.sync.read(await card.screenshot());
   await page.mouse.move(box.x+box.width-10,box.y+box.height-10);await page.waitForFunction(angle=>document.querySelector('.echo-card').style.getPropertyValue('--glass-angle')!==angle,angle);
   const next=PNG.sync.read(await card.screenshot());assert.ok(difference(first.data,next.data)>.4,'Pointer reflection changes pixels');
  }
  await page.locator('.echo-card').first().click();await page.locator('.echo-dialog').waitFor();await page.locator('[data-action=close]').click();
  for(const style of ['vertical','diagonal','quiet','ribbon']){
   await page.locator('[data-action=echo-style]').click();await page.locator(`[name=echo-style][value=${style}]`).check();await page.locator('[data-action=close]').click();
   await page.locator('#message-ribbon').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(shots,`liquid-${style}-${width}.png`)});
  }
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#message-background').isVisible(),false);assert.equal(await page.locator('.echo-track').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference',contrast:'more'});assert.equal(await page.locator('#message-background').isVisible(),false);assert.equal(await card.evaluate(e=>getComputedStyle(e).backdropFilter),'none');assert.equal(await card.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  await page.emulateMedia({contrast:'no-preference'});assert.equal(await page.evaluate(()=>JSON.stringify(data)),state);assert.deepEqual(errors,[]);
  await page.close();console.log(`PASS ${width}px: footer position on five routes, visible wall pixels (${diff.toFixed(2)}), glass material, 44px controls, four styles, dialog, reduced motion/contrast, data preservation`);
 }
}finally{if(browser)await browser.close();if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
})().catch(error=>{console.error(error);process.exitCode=1;});
