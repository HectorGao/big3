const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const forbidden=/(?:^|\/)(?:runtime|backups|research-data|research-models|art-originals|node_modules|dist|playwright-report|test-results|\.release-artifacts|\.wrangler|\.edgeone)(?:\/|$)|(?:^|\/)\.env(?:\..*)?$|\.(?:sqlite(?:3)?(?:-wal|-shm)?|db|pem|key)$|(?:three-lift-|jugetiezi-users-|big3-consented-research|\.demo-credentials-).*\.json$/;
const patterns=[
 ['legacy demo password',/DemoTrain!\d{4}/],
 ['GitHub credential',/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
 ['API credential',/\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
 ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['AWS credential',/\bAKIA[A-Z0-9]{16}\b/],
];
function inspect(file,content){
 const issues=[];
 if(forbidden.test(file)&&!file.endsWith('/.env.example')&&file!=='.env.example')issues.push('private/generated path');
 for(const [label,pattern] of patterns)if(pattern.test(content))issues.push(label);
 return issues;
}
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:40*1024*1024});
function check({staged=false,history=false}={}){
 const files=[...new Set(git(staged?['ls-files','-z']:['ls-files','-z','--cached','--others','--exclude-standard']).split('\0').filter(Boolean))];
 const issues=[];let historical=0;
 for(const file of files){
  let content='';
  if(staged){if(/\.(?:js|json|md|html|css|ya?ml|wxss|wxml|txt)$/.test(file))content=git(['show',':'+file]);}
  else {const target=path.join(root,file);if(!fs.existsSync(target))continue;if(fs.lstatSync(target).isSymbolicLink()){issues.push(file+': symbolic link requires manual review');continue;}if(fs.statSync(target).size<2000000&&/\.(?:js|json|md|html|css|ya?ml|wxss|wxml|txt)$/.test(file))content=fs.readFileSync(target,'utf8');}
  for(const why of inspect(file,content))issues.push(file+': '+why);
 }
 if(history){
  // Audit the history being published, not local recovery/checkpoint refs.
  const objects=git(['rev-list','--objects','HEAD']).trim().split('\n');
  for(const line of objects){const space=line.indexOf(' ');if(space<0)continue;const oid=line.slice(0,space),file=line.slice(space+1);
   if(!/\.(?:js|json|md|html|css|ya?ml|wxss|wxml|txt|sqlite3?|db|pem|key)$/.test(file)&&!forbidden.test(file))continue;
   if(git(['cat-file','-t',oid]).trim()!=='blob')continue;
   historical++;const content=Number(git(['cat-file','-s',oid]).trim())<2000000?git(['cat-file','blob',oid]):'';
   for(const why of inspect(file,content))issues.push(file+' @ '+oid.slice(0,12)+': '+why);
  }
 }
 if(issues.length)throw Error('Repository publication check failed (values redacted):\n'+issues.join('\n'));
 console.log('PASS repository publication patterns: '+files.length+' files, '+historical+' historical blobs. This is a bounded check, not a guarantee that every secret is detectable.');
}
module.exports={inspect,check};
if(require.main===module){try{check({staged:process.argv.includes('--staged'),history:process.argv.includes('--history')});}catch(e){console.error(e.message);process.exitCode=1;}}
