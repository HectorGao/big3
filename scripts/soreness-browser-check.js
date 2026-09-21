const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const P=require('../miniprogram/lib/planner'),Store=require('../miniprogram/lib/store');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-soreness-'));
const shots=path.join(root,'playwright-report');
const fixture={...Store.empty(),profile:{age:30,weight:80,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:120,reps:1,date:P.dateKey()},bench:{weight:90,reps:1,date:P.dateKey()},deadlift:{weight:160,reps:1,date:P.dateKey()}}},feedback:[{date:P.dateKey(),fatigue:1,pain:false,soreness:{}}]};
(async()=>{let child,browser;try{
 child=spawn(process.execPath,['preview/server.js'],{cwd:root,env:{...process.env,PORT:'0',BIG3_DB:path.join(dir,'test.sqlite')},stdio:['ignore','pipe','pipe']});
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.once('error',reject);child.stdout.on('data',b=>{const u=b.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(u){clearTimeout(timer);resolve(u);}});});
 browser=await chromium.launch({headless:true,channel:'chrome'});fs.mkdirSync(shots,{recursive:true});
 for(const width of [1280,768,390,360]){
  const page=await browser.newPage({viewport:{width,height:950},hasTouch:width<500}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const qa='soreness-'+width,key=Store.KEY+'-qa-'+qa;
  await page.goto(url+'/preview/index.html?qa='+qa+'#today');
  await page.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});await page.reload();
  await page.locator('#free-mode').selectOption('volume');
  for(const [id,values] of [['squat',['4','3']],['split',['3','2']]]){
   for(const value of values){const input=page.locator(`[data-plan="${id}"][data-field="sets"]`);await input.fill(value);await input.press('Tab');}
  }
  assert.deepEqual(await page.evaluate(()=>currentPlan.exercises.filter(e=>['squat','split'].includes(e.id)).map(e=>e.sets)),['3','2']);
  const before=await page.evaluate(()=>JSON.stringify(data));
  await page.locator('[data-action="feedback"]').first().click();
  assert.equal(await page.locator('[data-heat-muscle="quads"] small').textContent(),'5 组涉及');
  assert.equal(await page.locator('[data-heat-muscle="biceps"] small').textContent(),'0 组涉及');
  for(const text of await page.locator('[data-heat-muscle] small').allTextContents())assert.match(text,/^(0|[1-9]\d*) 组涉及$/);
  for(const side of ['front','back']){
   await page.locator(`[data-action="heat-${side}"]`).click();
   assert.equal(await page.locator('#detail').evaluate(e=>e.open),true,'Changing sides must not submit feedback');
   assert.equal(await page.evaluate(()=>feedbackSide),side);
   assert.equal(await page.evaluate(()=>JSON.stringify(data)),before);
   const canvas=page.locator('#heat-map');
   await canvas.scrollIntoViewIfNeeded();
   const metrics=await canvas.evaluate(c=>({w:c.clientWidth,h:c.clientHeight}));
   const point=side==='front'?{x:130,y:300,id:'quads'}:{x:130,y:270,id:'glutes'};
   await canvas.click({position:{x:point.x*metrics.w/320,y:point.y*metrics.h/620}});
   assert.equal(await page.locator(`[data-heat-muscle="${point.id}"]`).evaluate(e=>e.classList.contains('selected')),true);
   await page.locator('#detail').evaluate(e=>e.scrollTop=0);
   await page.screenshot({path:path.join(shots,`soreness-fixed-${side}-${width}.png`)});
   assert.equal(await page.locator('#detail').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  }
  await page.locator('[data-action="close"]').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(data)),before);
  await page.goto(url+'/preview/index.html?qa='+qa+'#atlas');
  for(const side of ['front','back']){
   await page.locator(`[data-action="side"][data-side="${side}"]`).click();
   await page.screenshot({path:path.join(shots,`anatomy-restored-${side}-${width}.png`)});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  if(width===1280){
   const pixels=await page.evaluate(()=>{
    const review=document.createElement('canvas');review.id='anatomy-head-review';review.width=640;review.height=250;review.style.cssText='position:fixed;inset:0;z-index:9999;background:white';document.body.append(review);
    const out=[],ctx=review.getContext('2d');
    for(const [i,side] of ['front','back'].entries()){
     const body=document.createElement('canvas');body.width=640;body.height=1240;const bctx=body.getContext('2d');A.draw(bctx,640,1240,side,[],{quads:5,glutes:5});
     out.push([...bctx.getImageData(320,62,1,1).data]);
     const p=side==='front'?[260,600]:[260,540];out.push([...bctx.getImageData(...p,1,1).data]);
     ctx.drawImage(body,225,0,200,235,i*320+60,0,200,235);
    }
    return out;
   });
   assert.deepEqual(pixels,[[248,248,250,255],[246,179,202,255],[248,248,250,255],[246,179,202,255]],'Original head fill and heat colors must both remain');
   await page.locator('#anatomy-head-review').screenshot({path:path.join(shots,'anatomy-restored-heads.png')});
  }
  assert.deepEqual(errors,[]);await page.close();
  console.log(`PASS ${width}px: edited 3 + 2 = 5; integer labels; front/back heat selection; no feedback auto-save; restored anatomy; no overflow`);
 }
}finally{if(browser)await browser.close();if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
})().catch(error=>{console.error(error);process.exitCode=1;});
