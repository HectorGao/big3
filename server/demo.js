const crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {createApi}=require('./api');
const C=require('../miniprogram/lib/catalog'),P=require('../miniprogram/lib/planner'),K=require('../miniprogram/lib/coach'),Store=require('../miniprogram/lib/store'),R=require('../miniprogram/lib/routines');
// Ephemeral fixture secret: never ship a reusable demo password in source control.
const DEMO_PASSWORD=crypto.randomBytes(24).toString('base64url');
const specs=[
 {username:'demo',age:30,weight:80,experience:'trained',goal:'strength',pb:[140,95,180]},
 {username:'demo_beginner',age:25,weight:65,experience:'beginner',goal:'strength',pb:[70,45,90]},
 {username:'demo_strength',age:38,weight:93,experience:'trained',goal:'strength',pb:[200,135,240]},
 {username:'demo_muscle',age:28,weight:72,experience:'trained',goal:'muscle',pb:[110,75,140]}
];
function demoData(spec,index,today=P.dateKey()){
 const d=Store.empty();d.synthetic=true;d.demoNotice='人工生成的界面调试数据，不是真实训练或研究样本';
 d.profile={age:spec.age,weight:spec.weight,experience:spec.experience,goal:spec.goal,days:[1,3,5,6],increment:2.5,pb:Object.fromEntries(C.lifts.map((l,i)=>[l.id,{weight:spec.pb[i],reps:1,date:K.add(today,-4),source:'synthetic-demo'}]))};
 for(let n=0;n<39;n++){
  const l=C.lifts[n%3],date=K.add(today,-89+Math.floor(n*85/38)),mode=n%12>=9?'deload':n%6<3?'volume':'intensity';
  const factor=(.57+n*.003)*(mode==='intensity'?1.12:mode==='deload'?.82:1);
  const mainWeight=Math.floor(spec.pb[n%3]*factor/2.5)*2.5,reps=mode==='intensity'?3:mode==='deload'?5:l.id==='deadlift'?5:spec.goal==='muscle'?8:6;
  const ids={squat:['split','curl-leg','pallof'],bench:['dbbench','row','pressdown'],deadlift:['curl-leg','row','deadbug']}[l.id];
  const exercises=[{...C.byId(l.id),sets:mode==='deload'?2:l.id==='deadlift'&&mode==='intensity'?2:3,reps,weight:mainWeight,rest:mode==='intensity'?240:180,rir:mode==='deload'?4:2,main:true},...ids.map((id,i)=>{const e=C.byId(id);return {...e,sets:mode==='deload'?1:2,reps:e.unit==='秒'?25:e.group==='core'?8:10,weight:e.loadConvention==='bodyweight'?0:Math.floor((12+index*3+n*.15+i*4)/2.5)*2.5,rest:90,rir:3};})];
  const s=P.createSession({date,lift:l.id,mode,exercises});
  s.id='demo:'+spec.username+':'+n;s.synthetic=true;s.completed=true;s.sessionCompleted=true;s.rpe=mode==='deload'?6:n%5===0?8:7;
  s.sets=s.sets.map((r,i)=>({...r,done:true,quality:true,success:true,rir:i%5===0?null:r.unit==='秒'?null:mode==='deload'?4:2+(n%2),loadConvention:C.byId(r.exercise).loadConvention,machineId:'default',source:'synthetic-demo'}));
  d.history.unshift(s);
  d.feedback.unshift({date,fatigue:n%9===0?4:n%4===0?3:2,pain:false,soreness:Object.fromEntries(l.muscles.map(m=>[m,n%9===0?2:1]))});
  if(n===36)d.favorites.push(R.fromRecord(s));
 }
 Store.validate(d);
 return d;
}
async function seedDemo(dbPath,today=P.dateKey()){
 if(process.env.NODE_ENV==='production'||process.env.BIG3_ORIGIN)throw Error('生产模式或配置正式站点来源时禁止创建测试账号');
 const fs=require('node:fs');
 if(fs.existsSync(dbPath)){const before=new DatabaseSync(dbPath);try{before.prepare('VACUUM INTO ?').run(dbPath+'.before-demo-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.sqlite');}finally{before.close();}}
 const api=createApi({dbPath,origin:()=> 'http://127.0.0.1'});api.close();const db=new DatabaseSync(dbPath);
 const results=[];let credentialsFile=null;
 try{
  const prepared=specs.map((s,i)=>({spec:s,data:demoData(s,i,today),salt:crypto.randomBytes(16).toString('hex')}));
  for(const p of prepared)p.password=p.salt+':'+crypto.scryptSync(DEMO_PASSWORD,p.salt,64).toString('hex');
  db.exec('BEGIN IMMEDIATE');
  try{
   for(const p of prepared){
    const old=db.prepare('SELECT id,is_demo FROM users WHERE username=?').get(p.spec.username);
    if(old&&!old.is_demo)throw Error('同名真实账号已存在，未更改任何账号：'+p.spec.username);
    if(old){results.push({username:p.spec.username,id:old.id,created:false});continue;}
    const id=crypto.randomUUID(),created=new Date().toISOString();
    db.prepare('INSERT INTO users(id,username,password,role,consent,created,is_demo) VALUES(?,?,?,?,?,?,1)').run(id,p.spec.username,p.password,'member',0,created);
    db.prepare('INSERT INTO states(user_id,revision,data,updated) VALUES(?,0,?,?)').run(id,JSON.stringify(p.data),created);
    results.push({username:p.spec.username,id,created:true});
   }
   const phrases=['今天 100 公斤，lightweight 💪','希望能收藏自己的容量日。','卧推先把动作做稳，再加重量。','完成训练，记得休息。','今天的腿举用了同一台设备。','想增加更详细的动作要点。','深蹲的进步比上周更稳定。','今天选择减量，不勉强冲纪录。','新增补录功能很实用。','先把余力记录完整。','希望手机上的数字按钮再清楚一些。','训练伙伴们加油 🔥','今天优先保证动作质量。','强度日，组间多休息一会儿。','想看最近一个月的训练分布。','胸托划船感觉很稳定。','今天尝试了不同的训练顺序。','没有疼痛才考虑正常训练。','少一点攀比，多一点记录。','训练完成，明天恢复。','收藏方案后调整重量很方便。','希望添加设备名称备注。','进步不一定每周都体现在重量上。','今天的训练很顺利 👏','建议增加更多动作替代方案。'];
   const existing=db.prepare('SELECT COUNT(*) n FROM messages m JOIN users u ON u.id=m.user_id WHERE u.is_demo=1').get().n;
   for(let i=Number(existing);i<100;i++)db.prepare('INSERT INTO messages(user_id,body,created,hidden) VALUES(?,?,?,0)').run(results[i%4].id,phrases[i%phrases.length]+' · 调试留言 '+(i+1),new Date(Date.now()-(100-i)*3600000).toISOString());
   const createdAccounts=results.filter(r=>r.created).map(r=>r.username);
   if(createdAccounts.length){credentialsFile=dbPath+'.demo-credentials-'+Date.now()+'.json';fs.writeFileSync(credentialsFile,JSON.stringify({accounts:createdAccounts,password:DEMO_PASSWORD,notice:'仅本机调试，不得公开'},null,2)+'\n',{flag:'wx',mode:0o600});}
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }finally{db.close();}
 return {accounts:results.map(({username,created})=>({username,created})),credentialsFile,notice:'仅限本地调试。新账号使用随机密码，保存在私密凭证文件；既有账号密码和数据不变。4 个模拟账号各 39 次训练；默认 100 条模拟留言。'};
}
module.exports={demoData,specs,DEMO_PASSWORD,seedDemo};
if(require.main===module){const path=require('node:path');seedDemo(process.env.BIG3_DB||path.join(__dirname,'../runtime/big3.sqlite')).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});}
