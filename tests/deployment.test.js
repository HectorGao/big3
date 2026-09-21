const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite'),{createApi}=require('../server/api'),{seedDemo,DEMO_PASSWORD}=require('../server/demo');
const Store=require('../miniprogram/lib/store'),P=require('../miniprogram/lib/planner'),K=require('../miniprogram/lib/coach');
const root=path.resolve(__dirname,'..'),creds=username=>({username,password:crypto.randomBytes(16).toString('hex'),privacyAccepted:true});
async function fixture(t,production=false,demos=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-deployment-')),dbPath=path.join(dir,'test.sqlite');if(demos)await seedDemo(dbPath);
 let api;const server=http.createServer((req,res)=>api.handle(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port,origin=production?'https://fitness.example.test':url;
 api=createApi({dbPath,production,origin:()=>origin});t.after(()=>{server.closeAllConnections();server.close();api.close();});
 async function call(client,route,method='GET',body,headers={}){
  const response=await fetch(url+'/api/'+route,{method,headers:{Origin:origin,...(client.cookie?{Cookie:client.cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
  const cookie=response.headers.get('set-cookie');if(cookie)client.cookie=cookie.split(';')[0];return {status:response.status,data:await response.json(),headers:response.headers,cookie};
 }
 return {call,api,dbPath,dir};
}
test('production uses terminal-only admin bootstrap and ordinary self registration',async t=>{
 const {api,call}=await fixture(t,true),admin={},guest={},member={},a=creds('owner'),m=creds('member');
 assert.equal((await call(guest,'auth/me')).data.setupRequired,false);
 assert.equal((await call(guest,'auth/setup','POST',a)).status,404);
 assert.equal((await call(guest,'auth/register','POST',m)).status,409);
 assert.equal((await api.initializeAdmin(a)).role,'admin');await assert.rejects(()=>api.initializeAdmin(creds('secondowner')),/已初始化/);
 const login=await call(admin,'auth/login','POST',a);assert.equal(login.status,200);assert.match(login.cookie,/; Secure/);assert.ok(!('password' in login.data.user));
 assert.equal((await call(member,'auth/register','POST',{...m,password:'1234567'})).status,400);
 assert.equal((await call(member,'auth/register','POST',{...m,password:'Eight123',role:'admin'})).data.user.role,'member');
 assert.equal((await call(member,'admin/users')).status,403);
 assert.equal((await call(guest,'auth/login','POST',{username:'demo',password:DEMO_PASSWORD})).status,401);
 assert.equal((await call(admin,'admin/debug','POST',{})).status,404);
 assert.equal((await call(admin,'auth/me','GET',null,{'X-Big3-Debug':'fake'})).status,403);
 assert.deepEqual((await call(guest,'board')).data.messages,[]);
});
test('production startup rejects demo databases and requires a clean HTTPS origin',async t=>{
 const {dbPath}=await fixture(t,false,true),read=new DatabaseSync(dbPath,{readOnly:true}),before=read.prepare('SELECT user_id,revision,data FROM states ORDER BY user_id').all();
 assert.throws(()=>createApi({dbPath,production:true,origin:()=> 'https://fitness.example.test'}),/包含测试账号/);
 for(const url of ['http://fitness.example.test','https://name:secret@fitness.example.test','https://fitness.example.test/path','https://fitness.example.test/?token=x'])assert.throws(()=>createApi({dbPath,production:true,origin:()=>url}),/HTTPS/);
 assert.deepEqual(read.prepare('SELECT user_id,revision,data FROM states ORDER BY user_id').all(),before);read.close();
});
test('production demo seed and noninteractive admin creation fail before writing a database',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-production-cli-')),dbPath=path.join(dir,'must-not-exist.sqlite');
 const env={...process.env,NODE_ENV:'production',BIG3_DB:dbPath,BIG3_ORIGIN:'https://fitness.example.test'};
 for(const file of ['server/demo.js','server/create-admin.js']){
  const result=spawnSync(process.execPath,[file],{cwd:root,env,encoding:'utf8'});
  assert.equal(result.status,1);assert.ok(!fs.existsSync(dbPath));assert.ok(!result.stdout.includes(DEMO_PASSWORD));
 }
});
test('admin backup preserves independent full states, excludes demos and credentials, and is not research consent',async t=>{
 const {api,call,dbPath}=await fixture(t,false,true),admin={},member={},guest={},a=creds('owner'),m=creds('member');
 await api.initializeAdmin(a);await call(admin,'auth/login','POST',a);await call(member,'auth/register','POST',m);
 const d=Store.empty();d.profile={age:31,weight:81,experience:'trained',goal:'strength',days:[1,3,5],increment:2.5,pb:{squat:{weight:120,reps:1,date:P.dateKey()}}};
 d.session=K.session(K.prescription(d,'squat',P.dateKey(),{fatigue:1,pain:false},{mode:'volume'}));
 d.history=[{...structuredClone(d.session),id:'completed-history',completed:true,sessionCompleted:true,sets:d.session.sets.filter(s=>s.exercise==='squat').map(s=>({...s,done:true,quality:true,success:true}))}];
 assert.equal((await call(member,'state','PUT',{revision:0,data:d})).status,200);
 const before=(await call(member,'state')).data,ownerBefore=(await call(admin,'state')).data;
 assert.equal((await call(guest,'admin/backup','POST',{})).status,401);
 assert.equal((await call(member,'admin/backup','POST',{})).status,403);
 assert.equal((await call(admin,'admin/backup','POST',{}, {Origin:'https://evil.invalid'})).status,403);
 assert.equal((await call(admin,'admin/users')).data.lastBackup,null);
 const result=await call(admin,'admin/backup','POST',{}),archive=result.data;
 assert.equal(result.status,200);assert.match(result.headers.get('content-disposition'),/attachment/);assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal(archive.kind,'big3-admin-archive');assert.equal(archive.purpose,'operational-backup-not-research');
 assert.equal(archive.users.length,2);assert.ok(archive.users.every(u=>u.user.demo===false));
 const exported=archive.users.find(u=>u.user.username==='member');assert.equal(exported.user.consent,false);assert.equal(exported.revision,1);assert.deepEqual(exported.data,d);
 const read=new DatabaseSync(dbPath,{readOnly:true}),serialized=JSON.stringify(archive);
 for(const secret of [a.password,m.password,DEMO_PASSWORD,...read.prepare('SELECT password FROM users').all().map(u=>u.password),...read.prepare('SELECT token FROM sessions').all().map(u=>u.token)])assert.ok(!serialized.includes(secret));
 assert.equal(read.prepare("SELECT subject FROM audit WHERE action='admin-backup'").get().subject,'2');read.close();
 assert.equal((await call(admin,'admin/users')).data.lastBackup,archive.createdAt);
 assert.deepEqual((await call(member,'state')).data,before);assert.deepEqual((await call(admin,'state')).data,ownerBefore);
 assert.equal((await call(admin,'admin/research-export')).data.records.length,0);
 const demo=(await call(admin,'admin/users')).data.users.find(u=>u.demo),debug=await call(admin,'admin/debug','POST',{userId:demo.id});
 assert.equal((await call(admin,'admin/backup','POST',{}, {'X-Big3-Debug':debug.data.token})).status,403);
});
test('backup audit failure does not return an archive or mark backup successful',async t=>{
 const {api,call,dbPath}=await fixture(t),admin={},a=creds('owner');await api.initializeAdmin(a);await call(admin,'auth/login','POST',a);
 const db=new DatabaseSync(dbPath);db.exec("CREATE TRIGGER fail_backup BEFORE INSERT ON audit WHEN NEW.action='admin-backup' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
 assert.equal((await call(admin,'admin/backup','POST',{})).status,500);
 assert.equal((await call(admin,'admin/users')).data.lastBackup,null);assert.equal(db.prepare('SELECT COUNT(*) n FROM states').get().n,1);db.close();
});
