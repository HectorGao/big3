const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {seedDemo,DEMO_PASSWORD}=require('../server/demo'),{createApi}=require('../server/api'),{DatabaseSync}=require('node:sqlite');
test('four isolated demo accounts and 100 messages seed idempotently; admin can hide and show publicly visible messages',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-demo-')),dbPath=path.join(dir,'demo.sqlite');await seedDemo(dbPath);await seedDemo(dbPath);
 let api;const server=http.createServer((req,res)=>api.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;api=createApi({dbPath,origin:()=>origin});
 t.after(()=>{server.closeAllConnections();server.close();api.close();});
 const anon={},admin={},demo={};
 async function call(client,route,method='GET',body){const res=await fetch(origin+'/api/'+route,{method,headers:{Origin:origin,...(client.cookie?{Cookie:client.cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(res.headers.get('set-cookie'))client.cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,data:await res.json()};}
 assert.equal((await call(anon,'auth/me')).data.setupRequired,true);
 const login=await call(demo,'auth/login','POST',{username:'demo',password:DEMO_PASSWORD});assert.equal(login.data.user.demo,true);
 const state=(await call(demo,'state')).data.data;assert.equal(state.history.length,39);assert.equal(state.synthetic,true);assert.equal(state.history.every(h=>h.synthetic),true);
 assert.equal((await call(anon,'board')).data.messages.length,100);assert.equal((await call(anon,'state')).status,401);
 assert.equal((await call(admin,'auth/setup','POST',{username:'owner',password:crypto.randomBytes(20).toString('hex'),privacyAccepted:true})).status,200);
 const users=(await call(admin,'admin/users')).data.users;assert.equal(users.filter(u=>u.demo).length,4);
 const message=(await call(anon,'board')).data.messages[0];assert.equal((await call(demo,'messages/'+message.id,'PATCH',{hidden:true})).status,403);
 assert.equal((await call(admin,'messages/'+message.id,'PATCH',{hidden:true})).status,200);assert.equal((await call(anon,'board')).data.messages.length,99);assert.equal((await call(admin,'messages')).data.messages.find(m=>m.id===message.id).hidden,1);
 assert.equal((await call(admin,'messages/'+message.id,'PATCH',{hidden:false})).status,200);assert.equal((await call(anon,'board')).data.messages.length,100);
 await call(demo,'account','PATCH',{consent:true});assert.equal((await call(admin,'admin/research-export')).data.records.length,0);
 const modified={...state,settings:{...state.settings,marker:'preserved'}};await call(demo,'state','PUT',{revision:0,data:modified});await seedDemo(dbPath);assert.equal((await call(demo,'state')).data.data.settings.marker,'preserved');
 const db=new DatabaseSync(dbPath);assert.equal(db.prepare('SELECT COUNT(*) n FROM messages').get().n,100);assert.ok(db.prepare("SELECT 1 FROM audit WHERE action='hide-message'").get());db.close();
});
