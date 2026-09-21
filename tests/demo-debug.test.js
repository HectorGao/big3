const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),{createApi}=require('../server/api'),{seedDemo,DEMO_PASSWORD}=require('../server/demo');
test('admin demo debugging preserves identity, isolation and authorization',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-debug-')),dbPath=path.join(dir,'test.sqlite');await seedDemo(dbPath);
 let api;const server=http.createServer((req,res)=>api.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;api=createApi({dbPath,origin:()=>origin});
 t.after(()=>{server.closeAllConnections();server.close();api.close();});
 const admin={},member={},demo={},anon={},secondLogin={};
 async function call(client,route,method='GET',body,extra={}){const res=await fetch(origin+'/api/'+route,{method,headers:{Origin:origin,...(client.cookie?{Cookie:client.cookie}:{}),...(client.debug?{'X-Big3-Debug':client.debug}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined}),cookie=res.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];return {status:res.status,data:await res.json(),cookie};}
 let owner,uid,scope;
 await t.test('minimum eight characters is enforced on server and works on login',async()=>{
  assert.equal((await call(admin,'auth/setup','POST',{username:'owner',password:'abcdefg',privacyAccepted:true})).status,400);
  owner=(await call(admin,'auth/setup','POST',{username:'owner',password:'Abcd1234',privacyAccepted:true})).data.user;
  assert.equal(owner.role,'admin');
  assert.equal((await call(member,'auth/register','POST',{username:'member',password:'abcdefg',privacyAccepted:true})).status,400);
  const registered=await call(member,'auth/register','POST',{username:'member',password:'Abcd1234',privacyAccepted:true});assert.equal(registered.status,200);
  assert.equal((await call(secondLogin,'auth/login','POST',{username:'owner',password:'Abcd1234'})).status,200);
  assert.equal((await call(demo,'auth/login','POST',{username:'demo',password:DEMO_PASSWORD})).status,200);
 });
 await t.test('only admin may enter an explicit demo, not an ordinary member account',async()=>{
  const users=(await call(admin,'admin/users')).data.users;uid=users.find(u=>u.username==='demo').id;
  assert.equal((await call(anon,'admin/debug','POST',{userId:uid})).status,401);
  assert.equal((await call(member,'admin/debug','POST',{userId:uid})).status,403);
  assert.equal((await call(admin,'admin/debug','POST',{userId:users.find(u=>u.username==='member').id})).status,403);
  scope=await call(admin,'admin/debug','POST',{userId:uid});assert.equal(scope.status,200);assert.equal(scope.cookie,null);
  assert.equal(scope.data.user.id,uid);assert.equal(scope.data.debug.admin.id,owner.id);
  assert.equal((await call(admin,'auth/me')).data.user.id,owner.id);
 });
 await t.test('scope is bound to the admin login session; mismatched headers cannot write',async()=>{
  const token=scope.data.token;
  assert.equal((await call(member,'auth/me','GET',null,{'X-Big3-Debug':token})).status,403);
  assert.equal((await call(secondLogin,'auth/me','GET',null,{'X-Big3-Debug':token})).status,403);
  assert.equal((await call(admin,'auth/me','GET',null,{'X-Big3-Debug':'forged'})).status,403);
  admin.debug=token;assert.equal((await call(admin,'auth/me')).data.user.id,uid);
  const snapshot=(await call(admin,'state')).data;
  assert.equal((await call(admin,'state','PUT',snapshot,{'X-Big3-Account':owner.id})).status,409);
  snapshot.data.settings.debugMarker='demo-only';assert.equal((await call(admin,'state','PUT',snapshot,{'X-Big3-Account':uid})).status,200);
  assert.equal((await call(demo,'state')).data.data.settings.debugMarker,'demo-only');
  assert.equal((await call(secondLogin,'state')).data.data.settings.debugMarker,undefined);
  assert.equal((await call(admin,'account','PATCH',{consent:true})).status,403);
  assert.equal((await call(admin,'admin/users')).status,200);
 });
 await t.test('topics persist, legacy posts default to training, and admin may moderate while debugging',async()=>{
  assert.equal((await call(admin,'messages','POST',{body:'A suggestion',topic:'idea'})).status,201);
  assert.equal((await call(member,'messages','POST',{body:'A training note'})).status,201);
  assert.equal((await call(member,'messages','POST',{body:'Bad topic',topic:'admin'})).status,400);
  const board=(await call(anon,'board')).data.messages,message=board.find(m=>m.body==='A suggestion');
  assert.equal(message.topic,'idea');assert.equal(message.username,'demo');assert.equal(board.find(m=>m.body==='A training note').topic,'training');
  assert.equal((await call(admin,'messages/'+message.id,'PATCH',{hidden:true})).status,200);
  assert.ok(!(await call(anon,'board')).data.messages.some(m=>m.id===message.id));
  assert.equal((await call(admin,'messages/'+message.id,'PATCH',{hidden:false})).status,200);
 });
 await t.test('exit revokes scope even after expiry; original admin state is intact',async()=>{
  const old=admin.debug,db=new DatabaseSync(dbPath);db.prepare('UPDATE demo_debug SET expires=0').run();
  assert.equal((await call(admin,'state')).status,403);
  const end=await call(admin,'admin/debug/stop','POST',{});assert.equal(end.status,200);assert.equal(end.data.user.id,owner.id);
  assert.equal((await call(admin,'state')).status,403);delete admin.debug;
  assert.equal((await call(admin,'state')).data.data.profile,null);assert.equal(db.prepare('SELECT COUNT(*) n FROM demo_debug').get().n,0);
  for(const action of ['debug-start','debug-save','debug-post','debug-end'])assert.equal(db.prepare('SELECT actor FROM audit WHERE action=?').get(action).actor,owner.id);
  assert.equal((await call(admin,'auth/me','GET',null,{'X-Big3-Debug':old})).status,403);db.close();
 });
});
