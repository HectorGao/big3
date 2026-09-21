const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),runtime=path.join(root,'runtime'),stateFile=path.join(runtime,'local-server.json');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function state(){try{return JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{return null;}}
async function health(url){try{const r=await fetch(url+'/api/health',{signal:AbortSignal.timeout(800)});return r.ok?await r.json():null;}catch{return null;}}
async function freePort(port){return new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});}
async function start(){
 const old=state();if(old?.url){const h=await health(old.url);if(h?.instance===old.instance){console.log('Running: '+old.url+'/preview/index.html | '+h.name+' v'+h.version+' ('+h.build+')');return;}}
 let port=Number(process.env.PORT||4173);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be between 1024 and 65535');
 for(let attempts=0;!await freePort(port);attempts++,port++)if(attempts>=20||port>=65535)throw Error('No available local port');
 fs.mkdirSync(runtime,{recursive:true,mode:0o700});const log=fs.openSync(path.join(runtime,'local-server.log'),'a',0o600),instance=crypto.randomUUID();
 const child=spawn(process.execPath,['preview/server.js'],{cwd:root,detached:true,stdio:['ignore',log,log],env:{...process.env,PORT:String(port),BIG3_STRICT_PORT:'1',BIG3_INSTANCE:instance}});child.unref();fs.closeSync(log);
 let spawnError;child.once('error',e=>{spawnError=e;});const url='http://127.0.0.1:'+port;
 for(let i=0;i<60;i++){if(spawnError)throw spawnError;const h=await health(url);if(h?.instance===instance){fs.writeFileSync(stateFile,JSON.stringify({pid:child.pid,instance,url,startedAt:new Date().toISOString()},null,2),{mode:0o600});console.log('Started: '+url+'/preview/index.html | '+h.name+' v'+h.version+' ('+h.build+')');return;}await wait(150);}
 // This PID was created by this invocation; never kill an unrelated port owner.
 try{process.kill(child.pid,'SIGTERM');}catch{}throw Error('Startup failed; inspect runtime/local-server.log');
}
async function stop(){const s=state();if(!s){console.log('No managed local server');return;}const h=await health(s.url);if(h?.instance!==s.instance){console.log('Managed server is not responding; no unrelated process was stopped');return;}process.kill(s.pid,'SIGTERM');for(let i=0;i<40;i++){if(!await health(s.url)){fs.writeFileSync(stateFile,JSON.stringify({...s,stoppedAt:new Date().toISOString()},null,2),{mode:0o600});console.log('Stopped: '+s.url);return;}await wait(100);}throw Error('Server has not stopped yet');}
async function status(){const s=state(),h=s?await health(s.url):null;if(h?.instance===s?.instance&&h){console.log('Running: '+s.url+'/preview/index.html | '+h.name+' v'+h.version+' ('+h.build+')');}else{console.log('Stopped. Run npm run start:local');process.exitCode=1;}}
(async()=>{const action=process.argv[2]||'start';if(action==='start')await start();else if(action==='stop')await stop();else if(action==='restart'){await stop();await start();}else if(action==='status')await status();else throw Error('Use start, status, stop or restart');})().catch(e=>{console.error(e.message);process.exitCode=1;});
