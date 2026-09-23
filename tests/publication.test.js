const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {inspect}=require('../scripts/check-repository');
test('static build rejects an unsafe public path before writing output',()=>{
 const {spawnSync}=require('node:child_process');
 const result=spawnSync(process.execPath,['scripts/build-web.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,BIG3_BASE_PATH:'/big3/"<script>'},encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/BIG3_BASE_PATH must be an absolute directory path/);
});
test('publication check rejects credential patterns and private paths without printing values',()=>{
 for(const file of ['runtime/state.json','backups/data.json','research-data/dataset.json','account.sqlite','test.sqlite.demo-credentials-1.json','.env','secrets.pem'])assert.ok(inspect(file,'').length,file);
 for(const content of ['ghp_'+crypto.randomBytes(30).toString('hex'),'-----BEGIN '+'PRIVATE KEY-----','Demo'+'Train!'+String(2026)])assert.ok(inspect('source.js',content).length);
 assert.deepEqual(inspect('server/api.js','const password=process.env.PASSWORD;'),[]);assert.deepEqual(inspect('.env.example','PORT=4173'),[]);
});
test('demo seeding uses a private random credential, keeps old credentials and never prints password',async()=>{
 const {seedDemo,DEMO_PASSWORD}=require('../server/demo'),{DatabaseSync}=require('node:sqlite');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'big3-seed-credentials-')),dbPath=path.join(dir,'fixture.sqlite');
 const first=await seedDemo(dbPath);assert.equal(first.password,undefined);assert.ok(!JSON.stringify(first).includes(DEMO_PASSWORD));assert.ok(first.credentialsFile);
 assert.equal(fs.statSync(first.credentialsFile).mode&0o777,0o600);assert.equal(JSON.parse(fs.readFileSync(first.credentialsFile)).password,DEMO_PASSWORD);
 const db=new DatabaseSync(dbPath,{readOnly:true}),before=db.prepare('SELECT id,password FROM users ORDER BY id').all();db.close();
 const second=await seedDemo(dbPath);assert.equal(second.credentialsFile,null);
 const read=new DatabaseSync(dbPath,{readOnly:true});assert.deepEqual(read.prepare('SELECT id,password FROM users ORDER BY id').all(),before);read.close();
});
