const fs=require('node:fs'),path=require('node:path');
const {prepare}=require('../research/prepare');
function run(inputPath,outputPath){
 if(!inputPath||!outputPath)throw Error('用法：npm run research:prepare -- 授权研究快照.json 新的私密输出目录');
 if(fs.statSync(inputPath).size>25000000)throw Error('研究快照超过 25 MB');
 const result=prepare(JSON.parse(fs.readFileSync(inputPath,'utf8')));
 const output=path.resolve(outputPath);
 if(fs.existsSync(output))throw Error('输出目录已存在；请选择新的版本目录，不覆盖或拼接旧数据');
 fs.mkdirSync(output,{recursive:true,mode:0o700});
 for(const [name,value] of Object.entries({manifest:result.manifest,dataset:{schema:1,rows:result.rows},report:result.report}))fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({output,samples:result.report.samples,participants:result.report.usableParticipants,status:result.report.status,canDeploy:false},null,2));
}
if(require.main===module){try{run(...process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={run};
