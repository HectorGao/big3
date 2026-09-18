// Mechanical asset packaging only. Original images and review decisions are never altered.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),C=require('../miniprogram/lib/catalog');
const sourceDir=path.join(root,'docs/media-sources'),originals=path.join(root,'art-originals');
fs.mkdirSync(originals,{recursive:true});
const manifest={};
for(const e of C.exercises){
  const file=path.join(sourceDir,e.id+'.json');
  if(!fs.existsSync(file)){manifest[e.id]={status:'pending'};continue;}
  const source=JSON.parse(fs.readFileSync(file,'utf8')),retained=path.join(originals,e.id+'-'+path.basename(source.original));
  if(!fs.existsSync(retained))fs.copyFileSync(source.original,retained);
  const input=fs.existsSync(source.original)?source.original:retained;
  manifest[e.id]={status:source.status,reviewNotes:source.reviewNotes||'',phases:e.media.phases.length};
  if(source.status!=='reviewed')continue;
  const target=path.join(root,'miniprogram/media-'+e.group+'/assets/'+e.id+'.jpg');
  fs.mkdirSync(path.dirname(target),{recursive:true});
  execFileSync('sips',['-s','format','jpeg','-s','formatOptions','65','-Z','1500',input,'--out',target],{stdio:'ignore'});
  const dimensions=execFileSync('sips',['-g','pixelWidth','-g','pixelHeight',target],{encoding:'utf8'});
  const ratio=Number(dimensions.match(/pixelWidth: (\d+)/)[1])/Number(dimensions.match(/pixelHeight: (\d+)/)[1]);
  const bounds=source.phaseBounds||Array.from({length:e.media.phases.length+1},(_,i)=>i/e.media.phases.length);
  if(bounds.length!==e.media.phases.length+1||bounds[0]!==0||bounds.at(-1)!==1||bounds.some((v,i)=>i&&v<=bounds[i-1]))throw Error('Invalid stage boundaries: '+e.id);
  manifest[e.id].frames=bounds.slice(0,-1).map((start,i)=>{
    const span=bounds[i+1]-start,scale=Math.min(1/(span*ratio),1.25);
    return {width:100/span,height:100,left:-start/span*100,top:0,viewportWidth:span*ratio*scale*100,viewportHeight:scale/1.25*100,viewportLeft:(1-span*ratio*scale)/2*100,viewportTop:(1.25-scale)/2/1.25*100};
  });
  manifest[e.id].path='/media-'+e.group+'/assets/'+e.id+'.jpg';
}
const code='(function(){const manifest='+JSON.stringify(manifest,null,2)+';if(typeof module!=="undefined")module.exports=manifest;else globalThis.MuscleMedia=manifest;})();\n';
fs.writeFileSync(path.join(root,'miniprogram/lib/media-manifest.js'),code);
console.log('Media:',Object.values(manifest).filter(m=>m.status==='reviewed').length,'reviewed /',C.exercises.length);
