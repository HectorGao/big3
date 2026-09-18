// Fresh staging only: do not delete directories or reuse unverified archive contents.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),hosting=JSON.parse(fs.readFileSync(path.join(root,'.openai/hosting.json')));
if(!hosting.project_id||hosting.static?.directory!=='dist')throw Error('Expected registered static Sites project');
execFileSync(process.execPath,[path.join(__dirname,'check-web.js')],{stdio:'inherit'});
const artifacts=path.join(root,'.release-artifacts');fs.mkdirSync(artifacts,{recursive:true});
const stage=fs.mkdtempSync(path.join(artifacts,'stage-'));
fs.cpSync(path.join(root,'dist'),path.join(stage,'dist'),{recursive:true,dereference:false});
fs.mkdirSync(path.join(stage,'dist/.openai'));
fs.writeFileSync(path.join(stage,'dist/.openai/hosting.json'),JSON.stringify(hosting,null,2)+'\n');
const archive=path.join(artifacts,path.basename(stage)+'.tar.gz');
execFileSync('tar',['-czf',archive,'-C',stage,'dist']);
const entries=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n');
if(!entries.includes('dist/.openai/hosting.json')||!entries.includes('dist/index.html')||entries.some(e=>!e.startsWith('dist/')||e.includes('../')))throw Error('Invalid static archive');
console.log(archive);
