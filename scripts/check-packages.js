const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../miniprogram'),config=require('../miniprogram/app.json'),project=require('../project.config.json');
const ignores=project.packOptions.ignore.map(r=>r.value),packages=(config.subPackages||[]).map(p=>p.root);
const sizes=Object.fromEntries(['main',...packages].map(k=>[k,0]));
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name),relative=path.relative(root,full);if(ignores.some(i=>relative===i||relative.startsWith(i+'/')))continue;if(entry.isDirectory())scan(full);else{const group=packages.find(p=>relative.startsWith(p+'/'))||'main';sizes[group]+=fs.statSync(full).size;if(group==='main'&&/\.(wxml|wxss)$/.test(relative)){const text=fs.readFileSync(full,'utf8');assert.ok(!/src=["']\/media-[^"']+assets/.test(text),'Main package directly references subpackage image: '+relative);}}}}
scan(root);
for(const [name,bytes] of Object.entries(sizes)){console.log(name+': '+(bytes/1024).toFixed(1)+' KiB');assert.ok(bytes<1.8*1024*1024,name+' exceeds conservative 1.8 MiB budget');}
assert.ok(Object.values(sizes).reduce((a,b)=>a+b,0)<18*1024*1024,'Total exceeds conservative 18 MiB budget');
if(process.argv.includes('--complete')){
 const C=require('../miniprogram/lib/catalog'),M=require('../miniprogram/lib/media-manifest');
 for(const e of C.exercises){assert.equal(M[e.id]?.status,'reviewed','Unreviewed media: '+e.id);assert.ok(fs.existsSync(path.join(root,M[e.id].path)),'Missing media: '+e.id);}
}
