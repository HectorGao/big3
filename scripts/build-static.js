const {execFileSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const [command,args] of [[process.execPath,['scripts/check-repository.js']],[process.execPath,['--test','tests/*.test.js']],[process.execPath,['scripts/build-web.js']],[process.execPath,['scripts/check-web.js']]]){
 // Node 24 supports test globs; no shell interpolation or deployment credentials required.
 execFileSync(command,args,{cwd:root,stdio:'inherit'});
}
