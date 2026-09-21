const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const {createApi}=require('../server/api');
const production=process.env.NODE_ENV==='production'||!!process.env.BIG3_ORIGIN;
if(production&&!process.env.BIG3_ORIGIN)throw Error('生产模式需设置 BIG3_ORIGIN 为正式 HTTPS 来源');
let api;
const server=http.createServer(async(req,res)=>{
  if(await api.handle(req,res))return;
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(pathname==='/'){res.writeHead(302,{Location:'/preview/index.html'+new URL(req.url,'http://localhost').search});res.end();return;}
  const target=path.resolve(root,'.'+pathname);
  const file='/'+path.relative(root,target).split(path.sep).join('/');
  const allowed=/^\/preview\/(index\.html|figures\.html|app\.js|coach-ui\.js|style\.css|workbench\.(js|css)|sync\.js|account-ui\.js|routines\.(js|css)|board\.(js|css)|drag-sort\.js|motion\.css|site-settings\.js|echo-admin\.css)$/.test(file)||/^\/miniprogram\/lib\/[a-z-]+\.js$/.test(file)||/^\/miniprogram\/assets\/[a-z-]+\.(png|jpg|svg)$/.test(file)||/^\/miniprogram\/media-(squat|hinge|push|pull|core)\/assets\/[a-z-]+\.jpg$/.test(file)||file==='/node_modules/lucide/dist/umd/lucide.js';
  if(!allowed||!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'});res.end(data);});
});
api=createApi({production,dbPath:process.env.BIG3_DB||path.join(root,'runtime',production?'big3-production.sqlite':'big3.sqlite'),origin:()=>process.env.BIG3_ORIGIN||'http://127.0.0.1:'+server.address().port});
let port=Number(process.env.PORT||4173);
server.on('error',e=>{if(e.code==='EADDRINUSE'&&process.env.BIG3_STRICT_PORT!=='1'){port++;server.listen(port,'127.0.0.1');}else throw e;});
server.listen(port,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:'+server.address().port));
