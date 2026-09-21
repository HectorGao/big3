const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createApi}=require('../server/api'),Store=require('../miniprogram/lib/store');
test('account API persists isolated records, enforces permissions, and rejects stale sync',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'big3-api-')),dbPath=path.join(directory,'test.sqlite');let api;
 const server=http.createServer((req,res)=>api.handle(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 api=createApi({dbPath,origin:()=>origin});t.after(()=>{server.closeAllConnections();server.close();api.close();});
 const admin={},alice={},bob={},anonymous={};
 async function call(client,route,method='GET',body,headers={}){const r=await fetch(origin+'/api/'+route,{method,headers:{Origin:origin,...(client.cookie?{Cookie:client.cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});const cookie=r.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];return {status:r.status,data:await r.json(),cookie};}
 const creds=(username,consent=false)=>({username,password:crypto.randomBytes(18).toString('hex'),privacyAccepted:true,consent});const a=creds('alice',true),b=creds('bob');
 await t.test('explicit first-run admin, strong password storage and normal registration',async()=>{
  assert.equal((await call(anonymous,'auth/me')).data.setupRequired,true);
  assert.equal((await call(anonymous,'auth/register','POST',a)).status,409);
  const result=await call(admin,'auth/setup','POST',creds('owner'));assert.equal(result.status,200);assert.equal(result.data.user.role,'admin');assert.match(result.cookie,/HttpOnly/);assert.match(result.cookie,/SameSite=Strict/);assert.ok(!('password' in result.data.user));
  assert.equal((await call(anonymous,'auth/setup','POST',creds('hacker'))).status,409);
  assert.equal((await call(alice,'auth/register','POST',{...a,role:'admin'})).data.user.role,'member');assert.equal((await call(bob,'auth/register','POST',b)).status,200);
  assert.equal((await call(anonymous,'auth/login','POST',{...a,password:b.password})).status,401);
  const bytes=fs.readFileSync(dbPath).toString();assert.ok(!bytes.includes(a.password));
 });
 await t.test('guest access and CSRF are denied; identity cannot be taken from request body',async()=>{
  assert.equal((await call(anonymous,'state')).status,401);
  assert.equal((await call(alice,'state','PUT',{revision:0,data:Store.empty()},{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await call(alice,'state','PUT',{revision:0,data:Store.empty()},{'X-Big3-Account':'wrong-account'})).status,409);
  assert.equal((await call(alice,'state','PUT',{revision:0,data:{history:'bad'}})).status,400);
 });
 await t.test('independent accounts, version conflicts, and valid persistent state',async()=>{
  const d=Store.empty();d.profile={age:31,weight:81,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{}};
  assert.equal((await call(alice,'state','PUT',{revision:0,data:d,userId:'bob'})).status,200);
  assert.equal((await call(alice,'state','PUT',{revision:0,data:Store.empty()})).status,409);
  assert.equal((await call(bob,'state')).data.data.profile,null);
  assert.equal((await call(alice,'state')).data.data.profile.weight,81);
  api.close();api=createApi({dbPath,origin:()=>origin});assert.equal((await call(alice,'state')).data.data.profile.weight,81);
 });
 let first;
 await t.test('board keeps text literal and restricts moderation to owner/admin',async()=>{
  const body='100 kg lightweight 💪 <img src=x onerror=alert(1)>';
  assert.equal((await call(alice,'messages','POST',{body})).status,201);
  const list=(await call(bob,'messages')).data.messages;first=list[0];assert.equal(first.body,body);assert.equal(first.username,'alice');
  assert.equal((await call(bob,'messages/'+first.id,'DELETE')).status,403);
  assert.equal((await call(admin,'messages/'+first.id,'DELETE')).status,200);
  assert.equal((await call(alice,'messages','POST',{body:'x'.repeat(281)})).status,400);
 });
 await t.test('admin data access and opt-in research export are separate',async()=>{
  assert.equal((await call(alice,'admin/users')).status,403);assert.equal((await call(bob,'admin/research-export')).status,403);
  const users=(await call(admin,'admin/users')).data.users,uid=users.find(u=>u.username==='alice').id;
  assert.equal((await call(bob,'admin/users/'+uid)).status,403);
  assert.equal((await call(admin,'admin/users/'+uid)).data.data.profile.age,31);
  const state=(await call(alice,'state')).data,day=require('../miniprogram/lib/planner').dateKey();
  state.data.history=[{id:'private-session-id',date:day,lift:'squat',mode:'volume',rpe:7,completed:true,sets:[{key:'private-set-id',exercise:'squat',done:true,quality:true,success:true,weight:80,reps:6,rir:2,targetWeight:80,targetReps:6,targetRir:3,targetSetCount:1,unit:'次',loadConvention:'barbell-total'}]}];
  assert.equal((await call(alice,'state','PUT',state)).status,200);
  let exp=(await call(admin,'admin/research-export')).data;assert.equal(exp.records.length,1);assert.equal(exp.schema,2);assert.ok(!JSON.stringify(exp).includes('alice'));assert.ok(!JSON.stringify(exp).includes('private-session-id'));
  const prepared=require('../research/prepare').prepare(exp);assert.equal(prepared.rows.length,1);assert.equal(prepared.rows[0].label,-1);
  assert.equal((await call(alice,'account','PATCH',{consent:false})).status,200);exp=(await call(admin,'admin/research-export')).data;assert.equal(exp.records.length,0);
  assert.equal((await call(alice,'auth/logout','POST',{})).status,200);assert.equal((await call(alice,'state')).status,401);
 });
});
