const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),{createApi}=require('../server/api'),Echo=require('../miniprogram/lib/echo-settings'),Release=require('../miniprogram/lib/release');
test('release identity matches package and native title',()=>{
 assert.equal(Release.name,'举个铁子');assert.equal(Release.version,require('../package.json').version);assert.equal(Release.version,require('../package-lock.json').version);
 assert.equal(require('../miniprogram/app.json').window.navigationBarTitleText,Release.name);assert.match(Release.build,/^\d{8}\.\d+$/);
});
test('echo config accepts only bounded numeric values, enumerated styles and a literal color',()=>{
 assert.deepEqual(Echo.validate(Echo.defaults),Echo.defaults);
 assert.equal(Echo.validate({...Echo.defaults,topSpeed:0,backgroundSpeed:0,backgroundColor:'#AABBCC'}).backgroundColor,'#aabbcc');
 for(const input of [null,[],{}, {...Echo.defaults,extra:true},{...Echo.defaults,topStyle:'script'},{...Echo.defaults,backgroundMotion:'bad'},{...Echo.defaults,topSpeed:'10'},{...Echo.defaults,backgroundBlur:Infinity},{...Echo.defaults,backgroundSpeed:-1},{...Echo.defaults,backgroundColor:'red;display:none'},{...Echo.defaults,allowPersonalStyle:1}])assert.throws(()=>Echo.validate(input));
});
test('administrator echo settings persist independently, with authorization, CAS and atomic audit',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jugetiezi-settings-')),dbPath=path.join(dir,'test.sqlite');let api;
 const server=http.createServer((req,res)=>api.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;api=createApi({dbPath,origin:()=>origin});
 t.after(()=>{server.closeAllConnections();server.close();api.close();});const admin={},member={},anon={};
 async function call(client,route,method='GET',body,extra={}){const r=await fetch(origin+'/api/'+route,{method,headers:{Origin:origin,...(client.cookie?{Cookie:client.cookie}:{}),'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)}),cookie=r.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];return {status:r.status,data:await r.json()};}
 await call(admin,'auth/setup','POST',{username:'owner',password:'Abcd1234',privacyAccepted:true});await call(member,'auth/register','POST',{username:'member',password:'Abcd1234',privacyAccepted:true});
 await call(member,'messages','POST',{body:'Keep this record 💪',topic:'idea'});const before=(await call(member,'state')).data;
 await t.test('public reads are safe; anonymous and ordinary members cannot configure',async()=>{
  assert.equal((await call(anon,'health')).data.version,Release.version);assert.deepEqual((await call(anon,'echo-settings')).data.config,Echo.defaults);
  assert.equal((await call(anon,'admin/echo-settings')).status,401);assert.equal((await call(member,'admin/echo-settings')).status,403);
  for(const client of [anon,member])assert.equal((await call(client,'admin/echo-settings','PUT',{revision:0,config:Echo.defaults})).status,client===anon?401:403);
  assert.equal((await call(admin,'admin/echo-settings','PUT',{revision:0,config:Echo.defaults},{Origin:'https://untrusted.invalid'})).status,403);
 });
 await t.test('validation rejects malicious CSS and incomplete config before writing',async()=>{
  for(const body of [{revision:-1,config:Echo.defaults},{revision:0,config:{}},{revision:0,config:{...Echo.defaults,topSpeed:500}},{revision:0,config:{...Echo.defaults,backgroundColor:'url(https://bad.invalid)'}}])assert.equal((await call(admin,'admin/echo-settings','PUT',body)).status,400);
  assert.equal((await call(anon,'echo-settings')).data.revision,0);
 });
 const config={...Echo.defaults,topStyle:'vertical',topSpeed:6,allowPersonalStyle:false,backgroundStyle:'glass',backgroundMotion:'columns',backgroundSpeed:3,backgroundColor:'#986679',backgroundOpacity:.25};
 await t.test('saved config reaches public board; concurrent admin changes are rejected',async()=>{
  const result=await call(admin,'admin/echo-settings','PUT',{revision:0,config});assert.equal(result.status,200);assert.equal(result.data.revision,1);
  assert.equal((await call(admin,'admin/echo-settings','PUT',{revision:0,config:Echo.defaults})).status,409);
  const board=(await call(anon,'board')).data;assert.deepEqual(board.settings.config,config);assert.equal(board.messages[0].body,'Keep this record 💪');assert.deepEqual((await call(member,'state')).data,before);
 });
 await t.test('audit failure rolls back config and reopening preserves the last committed value',async()=>{
  const db=new DatabaseSync(dbPath),audit=db.prepare("SELECT * FROM audit WHERE action='update-echo-settings'").all();assert.equal(audit.length,1);assert.deepEqual(JSON.parse(audit[0].subject).config,config);
  db.exec("CREATE TRIGGER fail_echo_audit BEFORE INSERT ON audit WHEN NEW.action='update-echo-settings' BEGIN SELECT RAISE(ABORT,'test failure'); END");
  assert.equal((await call(admin,'admin/echo-settings','PUT',{revision:1,config:Echo.defaults})).status,500);db.exec('DROP TRIGGER fail_echo_audit');db.close();
  api.close();api=createApi({dbPath,origin:()=>origin});const result=(await call(anon,'echo-settings')).data;assert.equal(result.revision,1);assert.deepEqual(result.config,config);assert.deepEqual((await call(member,'state')).data,before);
 });
 await t.test('background uses public moderated messages only',async()=>{
  const id=(await call(anon,'board')).data.messages[0].id;await call(admin,'messages/'+id,'PATCH',{hidden:true});assert.equal((await call(anon,'board')).data.messages.length,0);assert.deepEqual((await call(anon,'board')).data.settings.config,config);
 });
});
