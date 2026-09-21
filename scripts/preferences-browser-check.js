const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../miniprogram/lib/planner'),Store=require('../miniprogram/lib/store');
const url=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 fs.mkdirSync('playwright-report',{recursive:true});
 try{for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   const key='three-lift-v1-qa-preferences-'+width;
   const fixture={...Store.empty(),profile:{age:30,weight:75,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:100,reps:1,date:P.dateKey()},deadlift:{weight:150,reps:1,date:P.dateKey()}}}};
   await page.goto(url+'/preview/index.html?qa=preferences-'+width+'#today');
   await page.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});await page.reload();
   await page.locator('[data-action="lift"][data-lift="deadlift"]').click();await page.locator('#free-mode').selectOption('intensity');
   assert.equal(await page.locator('[data-plan="deadbug"]').count(),3);
   const choice=name=>page.locator('[name="trainingEquipment"][value="'+name+'"]');
   await choice('自重').uncheck();assert.equal(await page.locator('[data-plan="deadbug"]').count(),0);assert.equal(await page.locator('[data-plan="pallof"]').count(),3);
   await choice('绳索').uncheck();assert.equal(await page.locator('[data-plan="suitcase-hold"]').count(),3);
   assert.equal(await page.locator('[data-plan="suitcase-hold"][data-field="weight"]').inputValue(),'');
   await choice('绳索').check();await page.locator('[data-action="replace"][data-id="pallof"]').click();
   assert.equal(await page.locator('[data-action="picker-select"][data-id="side-plank"]').isDisabled(),true);
   await page.locator('[data-action="picker-select"][data-id="suitcase-hold"]').click();
   await page.screenshot({path:'playwright-report/preferences-'+width+'.png',fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('[data-action="start"]').click();assert.equal(await choice('自重').isDisabled(),true);
   assert.match(await page.locator('.session-layout').textContent(),/单侧负重静态站立/);
   await page.locator('[data-action="discard"]').click();
   await page.locator('[data-action="lift"][data-lift="squat"]').click();await page.locator('#free-mode').selectOption('volume');
   await page.locator('[data-action="start"]').click();
   await page.locator('[data-set="0"][data-field="weight"]').fill('112.5');await page.locator('[data-set="0"][data-field="reps"]').fill('1');
   await page.locator('[data-action="toggle-set"][data-index="0"]').click();
   assert.equal(await page.locator('[data-action="toggle-set"][data-index="0"]').getAttribute('aria-pressed'),'true',await page.evaluate(()=>JSON.stringify({row:data.session.sets[0],error:document.querySelector('#error')?.textContent})));
   assert.equal(await page.locator('[name="trainingEquipment"]').count(),5);
   await page.locator('[data-action="finish"]').click();
   await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).history.length===1,key,{timeout:5000}).catch(async e=>{console.error(await page.locator('#app').innerText());throw e;});
   const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
   assert.equal(saved.history.length,1);assert.equal(saved.profile.pb.squat.weight,112.5);assert.equal(saved.profile.pb.squat.source,'training-single');
   await page.locator('nav [data-action="profile"],nav [href="#profile"]').first().click();
   assert.equal(await page.locator('[name="squatWeight"]').inputValue(),'112.5');assert.match(await page.locator('.auto-pb').textContent(),/自动更新/);
   assert.ok(await page.locator('#profile-form button[type="submit"]').evaluate(e=>e.getBoundingClientRect().width>100));
   await page.screenshot({path:'playwright-report/auto-pb-'+width+'.png',fullPage:true});
   // A separate QA-only fixture isolates multi-rep saving from same-day recovery/calibration gates.
   await page.evaluate(({key,saved})=>{localStorage.setItem(key,JSON.stringify({...saved,history:[],session:null}));location.hash='today';},{key,saved});await page.reload();await page.locator('[data-action="start"]').click();
   await page.locator('[data-set="0"][data-field="weight"]').fill('120');await page.locator('[data-set="0"][data-field="reps"]').fill('5');
   await page.locator('[data-rir="0"]').selectOption('1');await page.locator('[data-action="toggle-set"][data-index="0"]').click();await page.locator('[data-action="finish"]').click();
   await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).history.length===1,key);
   const multiSaved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(multiSaved.history[0].sets[0].rir,1);const estimated=multiSaved.profile;assert.equal(estimated.pb.squat.weight,112.5);assert.equal(estimated.estimatedPB.squat.reps,5);
   await page.evaluate(()=>{location.hash='profile';});await page.locator('.auto-pb').waitFor();assert.match(await page.locator('.auto-pb').textContent(),/训练估算最佳/);
   await page.screenshot({path:'playwright-report/estimated-pb-'+width+'.png',fullPage:true});
   await page.evaluate(()=>{location.hash='atlas';});await page.locator('[data-action="muscle"][data-id="glutes"]').click();await page.locator('#search').fill('负重臀桥');
   await page.locator('[data-action="detail"][data-id="weighted-bridge"]').first().click();
   await page.waitForFunction(()=>document.querySelector('#teaching-image')?.naturalWidth>0);
   for(let n=1;n<=3;n++){assert.match(await page.locator('#phase-label').textContent(),new RegExp(n+' / 3'));await page.screenshot({path:'playwright-report/weighted-bridge-'+width+'-'+n+'.png'});if(n<3)await page.locator('[data-action="figure-next"]').click();}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
   console.log('PASS '+width+'px: equipment substitutions, permitted alternatives, frozen draft, actual PB save, 3 bridge phases, no overflow');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
