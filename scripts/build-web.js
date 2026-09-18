const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
const M=require('../miniprogram/lib/media-manifest');
const files=['preview/index.html','preview/figures.html','preview/app.js','preview/coach-ui.js','preview/style.css',
 ...['media-manifest','catalog','science','planner','coach','store','anatomy'].map(name=>'miniprogram/lib/'+name+'.js'),
 'miniprogram/assets/equipment.jpg',...Object.values(M).map(m=>'miniprogram'+m.path)];
const allowed=new Set([...files,'vendor/lucide.js','vendor/LICENSE.lucide','index.html','404.html','_headers','release.json']);
function checkTree(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const full=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('Unexpected symlink in build output');
 if(entry.isDirectory())checkTree(full);else if(!allowed.has(path.relative(out,full)))throw Error('Unexpected build file; review individually: '+full);
}}
checkTree(out);
function write(file,content){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
for(const file of files){
 let content=fs.readFileSync(path.join(root,file));
 if(file==='preview/index.html')content=content.toString().replace('../node_modules/lucide/dist/umd/lucide.js','../vendor/lucide.js').replace('请重新打开项目内的 preview/index.html，或运行 npm run preview。','请刷新页面重试；请勿清除浏览器数据，以免丢失本机训练记录。');
 if(file==='preview/style.css')content=content.toString().replaceAll('../miniprogram/assets/equipment.png','../miniprogram/assets/equipment.jpg');
 write(file,content);
}
write('vendor/lucide.js',fs.readFileSync(path.join(root,'node_modules/lucide/dist/umd/lucide.js')));
write('vendor/LICENSE.lucide',fs.readFileSync(path.join(root,'node_modules/lucide/LICENSE')));
for(const file of ['preview/index.html','preview/figures.html']){
 const html=fs.readFileSync(path.join(out,file),'utf8').replace(/(src|href)="([^"]+\.(?:js|css))"/g,(match,attr,url)=>{
  const asset=path.resolve(out,path.dirname(file),url),hash=crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex').slice(0,12);
  return `${attr}="${url}?v=${hash}"`;
 });write(file,html);
}
write('index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>三项训练</title><script>location.replace("./preview/index.html"+location.search+location.hash)</script><a href="./preview/index.html">进入三项训练</a></html>\n');
write('404.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>页面不存在</title><h1>页面不存在</h1><a href="/">返回三项训练</a></html>\n');
write('_headers','/*\n  Cache-Control: no-cache\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n');
const hashes={};for(const file of [...allowed].filter(f=>f!=='release.json').sort())hashes[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(out,file))).digest('hex');
write('release.json',JSON.stringify({format:1,dataStorage:'local-device-only',files:hashes},null,2)+'\n');
console.log('Web build ready: '+allowed.size+' files, '+Object.keys(M).length+' exercise image sets. No user data included.');
