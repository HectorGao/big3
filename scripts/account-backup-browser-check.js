const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const {createApi}=require('../server/api'),{seedDemo,DEMO_PASSWORD}=require('../server/demo'),Store=require('../miniprogram/lib/store'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-backup-browser-')),shots=path.join(root,'playwright-report');
(async()=>{let browser,child;try{
 const db=path.join(dir,'test.sqlite');await seedDemo(db);const api=createApi({dbPath:db,origin:()=> 'http://127.0.0.1'}),password=crypto.randomBytes(18).toString('hex');await api.initializeAdmin({username:'backup_owner',password});api.close();
 child=spawn(process.execPath,['preview/server.js'],{cwd:root,env:{...process.env,PORT:'0',BIG3_DB:db},stdio:['ignore','pipe','pipe']});
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);child.once('error',reject);child.stdout.on('data',b=>{const u=b.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(u){clearTimeout(timer);resolve(u);}});});
 browser=await chromium.launch({headless:true,channel:'chrome'});fs.mkdirSync(shots,{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:960},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(url+'/preview/index.html#profile');await page.locator('.account-trigger').click();await page.locator('[name=username]').fill('backup_owner');await page.locator('[name=password]').fill(password);await page.locator('#account-form [type=submit]').click();await page.waitForFunction(()=>MuscleSync.user?.role==='admin');
 const before=await page.evaluate(()=>MuscleSync.api('state'));
 await page.locator('[data-action=admin]').click();assert.match(await page.locator('.backup-status').innerText(),/本周待备份/);
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:960});const pending=page.waitForEvent('download');await page.locator('[data-action=admin-backup]').click();const download=await pending;
  assert.match(download.suggestedFilename(),/^jugetiezi-users-.*\.json$/);const archive=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(archive.kind,'big3-admin-archive');assert.equal(archive.users.length,1);assert.equal(archive.users[0].user.username,'backup_owner');assert.deepEqual(archive.users[0].data,Store.empty());assert.ok(!JSON.stringify(archive).includes(password));assert.ok(!JSON.stringify(archive).includes(DEMO_PASSWORD));
  await page.waitForFunction(()=>document.querySelector('.backup-status')?.textContent.includes('本周已生成'));
  assert.equal(await page.locator('#detail').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:path.join(shots,'admin-weekly-backup-'+width+'.png')});
 }
 assert.deepEqual(await page.evaluate(()=>MuscleSync.api('state')),before);
 const researchDownload=page.waitForEvent('download');await page.locator('[data-action=research-export]').click();const researchFile=await researchDownload;
 assert.match(researchFile.suggestedFilename(),/^big3-consented-research-.*\.json$/);
 const research=JSON.parse(fs.readFileSync(await researchFile.path(),'utf8'));assert.equal(research.schema,2);assert.equal(research.records.length,0);assert.equal(require('../research/prepare').prepare(research).report.samples,0);
 const id=await page.evaluate(async()=>(await MuscleSync.api('admin/users')).users.find(u=>u.demo).id);
 await page.locator(`[data-action=start-debug][data-id="${id}"]`).click();await page.waitForFunction(()=>!!MuscleSync.debug);await page.locator('.account-trigger').click();await page.locator('[data-action=admin]').click();assert.equal(await page.locator('[data-action=admin-backup]').isDisabled(),true);
 await page.locator('[data-action=close]').click();await page.locator('[data-action=stop-debug]').click();await page.waitForFunction(()=>!MuscleSync.debug);
 for(const file of ['server/demo.js','server/create-admin.js','runtime/big3.sqlite','.env','tests/accounts.test.js'])assert.equal((await page.request.get(url+'/'+file)).status(),403);
 const guest=await browser.newPage();await guest.goto(url+'/preview/index.html#profile');await guest.locator('.account-trigger').click();assert.ok(!(await guest.locator('#dialog-content').innerText()).includes(DEMO_PASSWORD));assert.equal(await guest.locator('[data-action=admin-backup]').count(),0);await guest.locator('[name=username]').fill('demo');await guest.locator('[name=password]').fill(DEMO_PASSWORD);await guest.locator('#account-form [type=submit]').click();await guest.waitForFunction(()=>MuscleSync.user?.demo);assert.equal(await guest.locator('[data-action=admin]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS local demo login, real JSON downloads on desktop/mobile, no credentials/demos in backups, weekly status, no profile overwrite, debug/guest restrictions, private source/DB denial');
}finally{if(browser)await browser.close();if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
})().catch(error=>{console.error(error);process.exitCode=1;});
