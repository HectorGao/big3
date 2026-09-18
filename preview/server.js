const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(pathname==='/'){res.writeHead(302,{Location:'/preview/index.html'+new URL(req.url,'http://localhost').search});res.end();return;}
  const file=pathname;
  const allowed=file.startsWith('/preview/')||file.startsWith('/miniprogram/lib/')||file.startsWith('/miniprogram/assets/')||/^\/miniprogram\/media-(squat|hinge|push|pull|core)\/assets\/[a-z-]+\.jpg$/.test(file)||file==='/node_modules/lucide/dist/umd/lucide.js';
  const target=path.resolve(root,'.'+file);
  if(!allowed||!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);});
});
let port=Number(process.env.PORT||4173);
server.on('error',e=>{if(e.code==='EADDRINUSE'){port++;server.listen(port,'127.0.0.1');}else throw e;});
server.listen(port,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:'+server.address().port));
