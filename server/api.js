const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{promisify}=require('node:util');
const {DatabaseSync}=require('node:sqlite'),Store=require('../miniprogram/lib/store');
const Release=require('../miniprogram/lib/release'),Echo=require('../miniprogram/lib/echo-settings');
const scrypt=promisify(crypto.scrypt),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const fail=(status,message)=>Object.assign(new Error(message),{status});
function createApi({dbPath,origin,production=process.env.NODE_ENV==='production'}){
 if(production){const url=new URL(origin());if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('生产模式必须配置完整 HTTPS 站点来源，不含路径或凭证');origin=()=>url.origin;}
 fs.mkdirSync(path.dirname(dbPath),{recursive:true,mode:0o700});
 const db=new DatabaseSync(dbPath);fs.chmodSync(dbPath,0o600);
 if(production&&db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='is_demo')&&db.prepare('SELECT 1 FROM users WHERE is_demo=1 LIMIT 1').get()){db.close();throw Error('生产数据库包含测试账号，已拒绝启动；请使用独立生产数据库，不要删除原测试资料');}
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,consent INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS states(user_id TEXT PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL,data TEXT NOT NULL,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,subject TEXT,created TEXT);`);
 db.exec('CREATE TABLE IF NOT EXISTS demo_debug(token TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES users(id),user_id TEXT NOT NULL REFERENCES users(id),session_token TEXT NOT NULL,expires INTEGER NOT NULL)');
 for(const [table,column] of [['messages','hidden'],['users','is_demo']])if(!db.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name===column))db.exec('ALTER TABLE '+table+' ADD COLUMN '+column+' INTEGER NOT NULL DEFAULT 0');
 if(!db.prepare('PRAGMA table_info(messages)').all().some(c=>c.name==='topic'))db.exec("ALTER TABLE messages ADD COLUMN topic TEXT NOT NULL DEFAULT 'training'");
 db.exec('CREATE TABLE IF NOT EXISTS site_settings(name TEXT PRIMARY KEY,revision INTEGER NOT NULL,value TEXT NOT NULL,updated TEXT)');
 db.prepare('INSERT OR IGNORE INTO site_settings VALUES(?,?,?,?)').run('echo',0,JSON.stringify(Echo.defaults),null);
 const echoSettings=()=>{const row=db.prepare("SELECT * FROM site_settings WHERE name='echo'").get();return {revision:row.revision,config:Echo.validate(JSON.parse(row.value)),updatedAt:row.updated};};
 const limits=new Map();
 const log=(actor,action,subject)=>db.prepare('INSERT INTO audit(actor,action,subject,created) VALUES(?,?,?,?)').run(actor,action,subject,new Date().toISOString());
 const publicUser=u=>({id:u.id,username:u.username,role:u.role,consent:!!u.consent,demo:!!u.is_demo});
 function throttle(key,max=12){const now=Date.now(),entry=limits.get(key);if(!entry||now>entry.until){if(limits.size>=1000)limits.delete(limits.keys().next().value);limits.set(key,{count:1,until:now+900000});}else if(++entry.count>max)throw fail(429,'操作过于频繁，请稍后再试');}
 async function body(req){if(!(req.headers['content-type']||'').startsWith('application/json'))throw fail(415,'需要 JSON 请求');let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>5500000)throw fail(413,'数据超过 5 MB 限制');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail(400,'请求格式无效');}}
 function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));}
 const sessionToken=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('big3_session='))?.slice(13);
 function authenticate(req){const token=sessionToken(req);if(!token)return null;const u=db.prepare('SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(hash(token),Date.now());return production&&u?.is_demo?null:u;}
 const cookie=token=>'big3_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+(token?'604800':'0')+(origin().startsWith('https:')?'; Secure':'');
 async function encode(password){const salt=crypto.randomBytes(16).toString('hex'),key=await scrypt(password,salt,64);return salt+':'+key.toString('hex');}
 async function match(password,encoded){const [salt,key]=(encoded||'00000000000000000000000000000000:'+('00'.repeat(64))).split(':');const candidate=await scrypt(password,salt,64);return crypto.timingSafeEqual(candidate,Buffer.from(key,'hex'));}
 function credentials(data){const username=String(data.username||'').trim().toLowerCase(),password=data.password;if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof password!=='string'||password.length<8||password.length>128)throw fail(400,'用户名使用 3–24 位字母、数字或下划线；密码需 8–128 位');return {username,password};}
 async function createUser(input,isSetup){
  const {username,password}=credentials(input),encoded=await encode(password);let u;
  db.exec('BEGIN IMMEDIATE');
  try{
   const exists=!!db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").get();if(isSetup&&exists)throw fail(409,'管理员已初始化');if(!isSetup&&!exists)throw fail(409,'请由站点负责人先初始化管理员');
   u={id:crypto.randomUUID(),username,password:encoded,role:isSetup?'admin':'member',consent:input.consent===true?1:0,created:new Date().toISOString()};
   db.prepare('INSERT INTO users(id,username,password,role,consent,created) VALUES(?,?,?,?,?,?)').run(u.id,u.username,u.password,u.role,u.consent,u.created);
   db.prepare('INSERT INTO states VALUES(?,?,?,?)').run(u.id,0,JSON.stringify(Store.empty()),u.created);log(u.id,isSetup?'setup':'register',u.id);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');if(String(e.message).includes('UNIQUE'))throw fail(409,'用户名已被使用');throw e;}
  return u;
 }
 function newSession(u,res){const token=crypto.randomBytes(32).toString('base64url');db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),u.id,Date.now()+604800000);send(res,200,{user:publicUser(u)},{'Set-Cookie':cookie(token)});}
 async function handle(req,res){
  let route;try{route=new URL(req.url,origin()).pathname;}catch{send(res,400,{error:'无效地址'});return true;}if(!route.startsWith('/api/'))return false;
  try{
   if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin())throw fail(403,'请求来源不受信任');
   if(production&&(route==='/api/auth/setup'||route.startsWith('/api/admin/debug')))throw fail(404,'接口不存在');
   if(route==='/api/health'&&req.method==='GET'){send(res,200,{ok:true,name:Release.name,version:Release.version,build:Release.build,instance:process.env.BIG3_INSTANCE||null});return true;}
   const actor=authenticate(req),debugToken=req.headers['x-big3-debug'];let user=actor,debug=null;
   if(route==='/api/admin/debug/stop'&&req.method==='POST'){
    if(!actor)throw fail(401,'请先登录');if(actor.role!=='admin')throw fail(403,'需要管理员权限');
    if(debugToken){db.prepare('DELETE FROM demo_debug WHERE token=? AND admin_id=? AND session_token=?').run(hash(debugToken),actor.id,hash(sessionToken(req)));log(actor.id,'debug-end',actor.id);}
    send(res,200,{user:publicUser(actor),debug:null});return true;
   }
   if(debugToken){
    if(production)throw fail(403,'生产环境不支持测试账号调试');
    if(!actor)throw fail(401,'请先登录');
    const scope=db.prepare('SELECT d.*,u.username,u.is_demo FROM demo_debug d JOIN users u ON u.id=d.user_id WHERE d.token=? AND d.admin_id=? AND d.session_token=? AND d.expires>?').get(hash(debugToken),actor.id,hash(sessionToken(req)),Date.now());
    if(actor.role!=='admin'||!scope||!scope.is_demo)throw fail(403,'调试身份已失效，请返回管理员');
    user=db.prepare('SELECT * FROM users WHERE id=?').get(scope.user_id);debug={admin:{id:actor.id,username:actor.username},expiresAt:scope.expires};
   }
   if(route==='/api/auth/me'&&req.method==='GET'){send(res,200,{user:user?publicUser(user):null,debug,setupRequired:!production&&!db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").get()});return true;}
   if(route==='/api/echo-settings'&&req.method==='GET'){send(res,200,echoSettings());return true;}
   if(route==='/api/board'&&req.method==='GET'){send(res,200,{settings:echoSettings(),messages:db.prepare('SELECT m.id,m.body,m.topic,m.created,u.username,u.is_demo demo FROM messages m JOIN users u ON m.user_id=u.id WHERE m.hidden=0 '+(production?'AND u.is_demo=0 ':'')+'ORDER BY m.id DESC LIMIT 100').all().reverse()});return true;}
   if(['/api/auth/setup','/api/auth/register','/api/auth/login'].includes(route)&&req.method==='POST'){
    throttle('auth:'+req.socket.remoteAddress);const input=await body(req),{username,password}=credentials(input);
    if(route.endsWith('/login')){const u=db.prepare('SELECT * FROM users WHERE username=?').get(username);if(!await match(password,u?.password)||!u||production&&u.is_demo)throw fail(401,'用户名或密码不正确');newSession(u,res);return true;}
    if(input.privacyAccepted!==true)throw fail(400,'请确认档案与管理员访问说明');
    const u=await createUser(input,route.endsWith('/setup'));
    newSession(u,res);return true;
   }
   if(!user)throw fail(401,'请先登录');
   if(req.headers['x-big3-account']&&req.headers['x-big3-account']!==user.id)throw fail(409,'账号已在其他页面切换，请刷新；未上传此设备数据');
   if(route==='/api/auth/logout'&&req.method==='POST'){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('big3_session='))?.slice(13);if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));send(res,200,{ok:true},{'Set-Cookie':cookie('')});return true;}
   if(route==='/api/account'&&req.method==='PATCH'){if(debug)throw fail(403,'调试模式不修改研究授权');const input=await body(req);if(typeof input.consent!=='boolean')throw fail(400,'授权选项无效');db.prepare('UPDATE users SET consent=? WHERE id=?').run(+input.consent,user.id);log(user.id,'consent',String(input.consent));send(res,200,{user:publicUser({...user,consent:+input.consent})});return true;}
   if(route==='/api/state'&&req.method==='GET'){const row=db.prepare('SELECT * FROM states WHERE user_id=?').get(user.id);send(res,200,{revision:row.revision,data:JSON.parse(row.data),updated:row.updated});return true;}
   if(route==='/api/state'&&req.method==='PUT'){
    const input=await body(req);if(!Number.isInteger(input.revision)||input.revision<0)throw fail(400,'同步版本无效');
    try{Store.validate(input.data);}catch(e){throw fail(400,e.message);}
    const serialized=JSON.stringify(input.data);if(Buffer.byteLength(serialized)>5000000)throw fail(413,'档案超过 5 MB');
    const changed=db.prepare('UPDATE states SET data=?,revision=revision+1,updated=? WHERE user_id=? AND revision=?').run(serialized,new Date().toISOString(),user.id,input.revision);
    if(!changed.changes)throw fail(409,'其他设备已更新，请先解决同步冲突');if(debug)log(actor.id,'debug-save',user.id);send(res,200,{revision:input.revision+1});return true;
   }
   if(route==='/api/messages'&&req.method==='GET'){const rows=db.prepare('SELECT m.id,m.body,m.topic,m.created,m.hidden,u.username,u.id userId,u.is_demo demo FROM messages m JOIN users u ON m.user_id=u.id '+(actor.role==='admin'?'':'WHERE m.hidden=0 OR m.user_id=? ')+'ORDER BY m.id DESC LIMIT 100').all(...(actor.role==='admin'?[]:[user.id]));send(res,200,{messages:rows.reverse()});return true;}
   if(route==='/api/messages'&&req.method==='POST'){throttle('post:'+user.id,20);const input=await body(req),text=typeof input.body==='string'?input.body.trim():'',topic=input.topic||'training';if(!text||text.length>280)throw fail(400,'内容需为 1–280 个字符');if(!['training','idea','question'].includes(topic))throw fail(400,'交流分类无效');db.prepare('INSERT INTO messages(user_id,body,topic,created) VALUES(?,?,?,?)').run(user.id,text,topic,new Date().toISOString());if(debug)log(actor.id,'debug-post',user.id);send(res,201,{ok:true});return true;}
   const message=route.match(/^\/api\/messages\/(\d+)$/);
   if(message&&req.method==='PATCH'){if(actor.role!=='admin')throw fail(403,'需要管理员权限');const input=await body(req);if(typeof input.hidden!=='boolean')throw fail(400,'显示状态无效');const changed=db.prepare('UPDATE messages SET hidden=? WHERE id=?').run(+input.hidden,Number(message[1]));if(!changed.changes)throw fail(404,'留言不存在');log(actor.id,input.hidden?'hide-message':'show-message',message[1]);send(res,200,{ok:true});return true;}
   if(message&&req.method==='DELETE'){const row=db.prepare('SELECT * FROM messages WHERE id=?').get(Number(message[1]));if(!row)throw fail(404,'留言不存在');if(row.user_id!==user.id&&actor.role!=='admin')throw fail(403,'无权删除');db.prepare('DELETE FROM messages WHERE id=?').run(row.id);log(actor.id,'delete-message',message[1]);send(res,200,{ok:true});return true;}
   if(route.startsWith('/api/admin/')){
    if(actor.role!=='admin')throw fail(403,'需要管理员权限');
    if(route==='/api/admin/echo-settings'&&req.method==='GET'){send(res,200,echoSettings());return true;}
    if(route==='/api/admin/echo-settings'&&req.method==='PUT'){
     const input=await body(req);if(!input||!Number.isInteger(input.revision)||input.revision<0)throw fail(400,'配置版本无效');let config;try{config=Echo.validate(input.config);}catch(e){throw fail(400,e.message);}
     db.exec('BEGIN IMMEDIATE');try{const before=echoSettings();if(before.revision!==input.revision)throw fail(409,'另一管理页面已更新，请重新载入配置后再保存');const updatedAt=new Date().toISOString();db.prepare("UPDATE site_settings SET revision=revision+1,value=?,updated=? WHERE name='echo'").run(JSON.stringify(config),updatedAt);log(actor.id,'update-echo-settings',JSON.stringify({before:before.config,config,revision:input.revision+1}));db.exec('COMMIT');send(res,200,{revision:input.revision+1,config,updatedAt});}catch(e){db.exec('ROLLBACK');throw e;}return true;
    }
    if(route==='/api/admin/debug'&&req.method==='POST'){
     const input=await body(req),target=db.prepare('SELECT * FROM users WHERE id=?').get(String(input.userId||''));
     if(!target?.is_demo||target.role==='admin')throw fail(403,'仅可进入模拟账号调试');
     const token=crypto.randomBytes(32).toString('base64url'),expiresAt=Date.now()+7200000;
     db.prepare('DELETE FROM demo_debug WHERE expires<=?').run(Date.now());
     db.prepare('INSERT INTO demo_debug VALUES(?,?,?,?,?)').run(hash(token),actor.id,target.id,hash(sessionToken(req)),expiresAt);log(actor.id,'debug-start',target.id);
     send(res,200,{user:publicUser(target),token,debug:{admin:{id:actor.id,username:actor.username},expiresAt}});return true;
    }
    if(route==='/api/admin/users'&&req.method==='GET'){send(res,200,{lastBackup:db.prepare("SELECT created FROM audit WHERE action='admin-backup' ORDER BY id DESC LIMIT 1").get()?.created||null,users:db.prepare('SELECT u.id,u.username,u.role,u.consent,u.is_demo,u.created,s.updated,s.data FROM users u JOIN states s ON s.user_id=u.id').all().map(r=>{const d=JSON.parse(r.data);return {...publicUser(r),created:r.created,updated:r.updated,sessions:d.history.length,hasProfile:!!d.profile};})});return true;}
    if(route==='/api/admin/backup'&&req.method==='POST'){
     if(debug)throw fail(403,'请先返回管理员身份，再生成备份');
     throttle('backup:'+actor.id,4);
     let archive;
     db.exec('BEGIN');
     try{
      const size=db.prepare('SELECT COALESCE(SUM(length(CAST(s.data AS BLOB))),0) bytes FROM states s JOIN users u ON u.id=s.user_id WHERE u.is_demo=0').get().bytes;
      if(size>25000000)throw fail(413,'档案超过网页备份的 25 MB 限制，请由服务器管理员使用数据库备份');
      const users=db.prepare('SELECT u.id,u.username,u.role,u.consent,u.is_demo,u.created,s.revision,s.updated,s.data FROM users u JOIN states s ON s.user_id=u.id WHERE u.is_demo=0 ORDER BY u.id').all().map(r=>({user:{...publicUser(r),created:r.created},revision:r.revision,updated:r.updated,data:JSON.parse(r.data)}));
      archive={kind:'big3-admin-archive',schema:1,createdAt:new Date().toISOString(),source:origin(),appVersion:Release.version,purpose:'operational-backup-not-research',notice:'管理备份，含个人资料；请保存在私密位置。不是研究授权，也不包含密码、登录凭证或测试账号。',users};
      log(actor.id,'admin-backup',String(users.length));db.exec('COMMIT');
     }catch(e){db.exec('ROLLBACK');throw e;}
     send(res,200,archive,{'Content-Disposition':'attachment; filename="jugetiezi-users-'+archive.createdAt.replace(/[:.]/g,'-')+'.json"'});return true;
    }
    const account=route.match(/^\/api\/admin\/users\/([a-z0-9-]+)$/);
    if(account&&req.method==='GET'){const row=db.prepare('SELECT u.id,u.username,u.role,u.consent,s.data FROM users u JOIN states s ON s.user_id=u.id WHERE u.id=?').get(account[1]);if(!row)throw fail(404,'用户不存在');log(actor.id,'view-records',row.id);send(res,200,{user:publicUser(row),data:JSON.parse(row.data)});return true;}
    if(route==='/api/admin/research-export'&&req.method==='GET'){
     if(debug)throw fail(403,'请先返回管理员身份，再导出研究数据');
     throttle('research:'+actor.id,4);
     const rows=db.prepare('SELECT u.id,u.consent,u.is_demo,s.revision,s.updated,s.data FROM users u JOIN states s ON s.user_id=u.id WHERE u.consent=1 AND u.is_demo=0 ORDER BY u.id').all();
     if(rows.reduce((n,r)=>n+Buffer.byteLength(r.data),0)>25000000)throw fail(413,'研究档案超过 25 MB，请使用服务器离线流程');
     const result=require('./research-export').snapshot(rows,origin());
     log(actor.id,'research-export',result.snapshotId);send(res,200,result);return true;
    }
   }
   throw fail(404,'接口不存在');
  }catch(e){if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'服务器处理失败，数据未确认保存'});else res.end();}
  return true;
 }
 return {handle,async initializeAdmin(input){return publicUser(await createUser(input,true));},close(){db.close();}};
}
module.exports={createApi};
