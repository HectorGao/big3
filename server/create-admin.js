const path=require('node:path'),{Writable}=require('node:stream'),readline=require('node:readline/promises');
const {createApi}=require('./api');

async function main(){
 if(!process.stdin.isTTY||!process.stdout.isTTY||process.argv.length>2)throw Error('请在交互终端运行 npm run admin:create；不要通过命令参数或管道传入密码');
 let muted=false,api;
 const output=new Writable({write(chunk,encoding,done){if(!muted)process.stdout.write(chunk);done();}});
 const rl=readline.createInterface({input:process.stdin,output,terminal:true});
 async function secret(prompt){process.stdout.write(prompt);muted=true;try{return await rl.question('');}finally{muted=false;process.stdout.write('\n');}}
 try{
  const production=process.env.NODE_ENV==='production'||!!process.env.BIG3_ORIGIN;
  const dbPath=process.env.BIG3_DB||path.join(__dirname,'../runtime',production?'big3-production.sqlite':'big3.sqlite');
  console.log('初始化管理员数据库：'+dbPath);
  const username=await rl.question('管理员用户名（3–24 位字母、数字、下划线）：');
  const password=await secret('设置密码（至少 8 位，不回显）：'),confirm=await secret('再次输入密码：');
  if(password!==confirm)throw Error('两次密码不一致，未创建账号');
  api=createApi({dbPath,production,origin:()=>process.env.BIG3_ORIGIN||'https://localhost'});
  await api.initializeAdmin({username,password});
  console.log('管理员已创建。没有默认管理员密码；普通用户可自行注册。');
 }finally{rl.close();api?.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
