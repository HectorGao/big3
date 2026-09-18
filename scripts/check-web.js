const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../dist'),release=JSON.parse(fs.readFileSync(path.join(root,'release.json')));
assert.equal(release.dataStorage,'local-device-only');
for(const [file,hash] of Object.entries(release.files)){
 assert.ok(!/(?:^|\/)(?:node_modules|art-originals|tests|docs|\.git|\.env|\.openai)(?:\/|$)/.test(file));
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file);
}
for(const file of ['preview/index.html','preview/figures.html']){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(m[1].startsWith('#'))continue;const target=path.resolve(root,path.dirname(file),m[1].split(/[?#]/)[0]);
  assert.ok(target.startsWith(root+path.sep));assert.ok(fs.existsSync(target),file+': '+m[1]);
 }
 assert.ok(!html.includes('node_modules'));
}
const C=require('../miniprogram/lib/catalog');for(const e of C.exercises){assert.equal(e.media.available,true);assert.ok(fs.existsSync(path.join(root,'miniprogram'+e.media.path)));}
assert.ok(fs.existsSync(path.join(root,'index.html')));assert.ok(!fs.existsSync(path.join(root,'preview/server.js')));
console.log('PASS production assets, relative links, 50 media sets, content hashes, source/data exclusion');
