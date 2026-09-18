const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../miniprogram/lib/catalog');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
 fs.mkdirSync('playwright-report',{recursive:true});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto((process.env.PREVIEW_URL||'http://127.0.0.1:4173')+'/preview/index.html?qa=media-'+width+'#atlas');
   await page.waitForLoadState('networkidle');let stages=0;
   for(const e of C.exercises){
    await page.evaluate(id=>showExercise(id),e.id);
    await page.waitForFunction(()=>{const img=document.querySelector('#teaching-image');return img.complete&&img.naturalWidth>0;});
    const pixels=await page.evaluate(()=>{
     const canvas=document.createElement('canvas');canvas.width=120;canvas.height=60;
     const ctx=canvas.getContext('2d');ctx.drawImage(document.querySelector('#teaching-image'),0,0,120,60);
     const data=ctx.getImageData(0,0,120,60).data;let ink=0;for(let i=0;i<data.length;i+=4)if(Math.min(data[i],data[i+1],data[i+2])<200)ink++;
     return ink;
    });
    assert.ok(pixels>80,e.id+' is nonblank');
    for(let phase=0;phase<e.media.phases.length;phase++){
     assert.match(await page.locator('#phase-label').textContent(),new RegExp('^'+(phase+1)+' / '+e.media.phases.length));
     assert.ok((await page.locator('#phase-cue').textContent()).trim().length>0,e.id+' has a stage cue');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     const box=await page.locator('.teaching-frame').boundingBox();assert.ok(box.width>200&&box.width<=width);
     stages++;
     if(phase===1&&['squat','bench','deadlift','row'].includes(e.id))await page.screenshot({path:`playwright-report/media-${e.id}-${width}.png`});
     if(phase+1<e.media.phases.length)await page.locator('[data-action="figure-next"]').click();
    }
    await page.locator('[data-action="figure-zoom"]').click();assert.equal(await page.locator('.teaching-frame.zoomed').count(),1);
    await page.locator('[data-action="close"]').click();
   }
   assert.deepEqual(errors,[]);console.log(`PASS ${width}px: ${C.exercises.length} teaching sets, ${stages} stages, pixel content, zoom, no overflow`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
