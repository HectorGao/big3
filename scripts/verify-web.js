const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../dist'),release=JSON.parse(fs.readFileSync(path.join(root,'release.json')));
const basePath=release.basePath||'/';
const mime={'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname,file=pathname===basePath?'index.html':pathname.slice(basePath.length);
 if(!pathname.startsWith(basePath)||!Object.hasOwn(release.files,file)&&file!=='release.json'){res.writeHead(404,{'Content-Type':mime['.html']});res.end(fs.readFileSync(path.join(root,'404.html')));return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain','Cache-Control':'no-cache'});res.end(fs.readFileSync(path.join(root,file)));
});
function run(file,url){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path.join(__dirname,file)],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PREVIEW_URL:url},stdio:'inherit'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(file+' exited '+code)));});}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+basePath.slice(0,-1);
 try{
  for(const file of ['/.git/config','/.env','/docs/media-sources/bench.json','/preview/server.js'])assert.equal((await fetch(url+file)).status,404);
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
  try{
   const page=await browser.newPage();await page.goto(url+'/?qa=release-entry#atlas');await page.waitForLoadState('networkidle');assert.equal(page.url(),url+'/preview/index.html?qa=release-entry#atlas');assert.ok(await page.locator('#app').textContent());
   assert.equal((await page.goto(url+'/missing/nested-page')).status(),404);await page.getByRole('link',{name:'返回举个铁子'}).click();await page.waitForURL(url+'/preview/index.html');
   await page.waitForFunction(()=>document.querySelector('#sync-label')?.textContent.includes('本地可用'));await page.locator('[data-action="account"]').click();
   await page.locator('.account-error').waitFor();assert.match(await page.locator('.account-error').textContent(),/无法连接在线账号服务/);assert.equal(await page.locator('#account-form').count(),0);
  }finally{await browser.close();}
  await run('browser-check.js',url);await run('media-browser-check.js',url);
  console.log('PASS deployable artifact: root routing, excluded paths, desktop/mobile training and complete media');
 }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
