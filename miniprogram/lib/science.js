(function () {
  const sources = [
    {id:'ACSM26',title:'ACSM 2026：抗阻训练立场声明解读',url:'https://acsm.org/resistance-training-guidelines-update-2026/',note:'规律训练、力量训练偏重负荷、增肌重视周训练量；不支持人人通用的最优处方。'},
    {id:'ACSM09',title:'ACSM (2009) Progression models in resistance training',url:'https://pubmed.ncbi.nlm.nih.gov/19204579/',note:'依据训练经验、目标安排负荷和休息；超过目标次数后渐进增加负荷。'},
    {id:'LOAD17',title:'Schoenfeld et al. (2017)：低负荷与高负荷荟萃分析',url:'https://pubmed.ncbi.nlm.nih.gov/28834797/',note:'较高负荷更有利于最大力量；增肌可发生在不同负荷范围。该研究纳入方案练至力竭，不等于建议每组力竭。'},
    {id:'RM',title:'ExRx：1–10 次估算 1RM',url:'https://exrx.net/Calculators/OneRepMax',note:'估算有动作和个体误差；Epley 与 Brzycki 的差异范围不是统计置信区间。'},
    {id:'RIR',title:'Zourdos et al. (2016)：基于剩余次数的 RPE',url:'https://doi.org/10.1519/JSC.0000000000001049',note:'RIR/RPE 辅助调节努力程度；初学者需要练习校准，不能视为精密测量。'},
    {id:'AUTO25',title:'2025：训练负荷与训练量的自我调节综述',url:'https://pubmed.ncbi.nlm.nih.gov/39864040/',note:'支持监测准备度与表现后调整负荷和训练量的思路；不验证本软件 1–5 档及固定降重百分比。'},
    {id:'SETS17',title:'Ribeiro et al. (2017)：传统组与金字塔组',url:'https://pubmed.ncbi.nlm.nih.gov/27749731/',note:'老年女性试验中，两种方式均产生改善，组间无显著差异；不能认为每组递增重量必然更优。'},
    {id:'AUTO24',title:'2024：自我调节并非必然增加训练收益',url:'https://pubmed.ncbi.nlm.nih.gov/38814694/',note:'24 名训练男性、10 周试验，恢复感受调节方案未带来额外力量和增肌优势；避免宣称自动规划保证最优。'}
  ];
  const valid = (v,min,max) => v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max;
  const round = n=>Math.round(n*10)/10;
  const fatigueLevels=[
    {value:1,label:'精力充沛',description:'睡眠和精神状态良好，热身轻松，无明显酸痛。',action:'按原计划训练；不因状态好自动冲击 PB。',load:1,sets:0,rir:0},
    {value:2,label:'正常可练',description:'有轻微日常疲劳，但动作稳定，热身表现接近平时。',action:'保持计划负荷，逐组核对目标余力。',load:1,sets:0,rir:0},
    {value:3,label:'中等疲劳',description:'睡眠不足或酸痛明显，热身比平时吃力，但无疼痛。',action:'工作重量约减 10%，每动作减 1 组，多留 1 次余力。',load:0.9,sets:-1,rir:1},
    {value:4,label:'明显疲劳',description:'恢复较差，注意力或动作控制下降，日常活动也觉得累。',action:'转恢复日，减少动作和组数，不安排大重量。',load:1,sets:0,rir:0},
    {value:5,label:'不适合负重',description:'极度疲劳、身体不适，或热身时无法稳定控制动作。',action:'今天休息；之后的计划仅供预览，恢复后重新评估。',load:0,sets:0,rir:0}
  ];
  function fatigueInfo(value=2){const level=fatigueLevels.find(l=>l.value===Number(value));if(!level)throw Error('疲劳程度必须为 1–5 的整数');return level;}
  const straightSets='相同重量 × 相同次数是常规工作组（直组），用于稳定训练刺激和比较进步。先完成热身；组间充分休息。若后续组余力低于目标或动作变形，应减重或提前结束，不必强行做齐。';
  function estimatePB(weight,reps,bodyweight) {
    if(!valid(weight,1,600)||!valid(reps,1,10)||!Number.isInteger(Number(reps)))return null;
    weight=Number(weight);reps=Number(reps);
    const epley=reps===1?weight:weight*(1+reps/30),brzycki=reps===1?weight:weight*36/(37-reps);
    const low=round(Math.min(epley,brzycki)),high=round(Math.max(epley,brzycki));
    return {epley:round(epley),brzycki:round(brzycki),low,high,range:low===high?String(low):low+'–'+high,relative:valid(bodyweight,30,350)?round(low/Number(bodyweight)):null,measured:reps===1};
  }
  function trainingMax(profile,estimate) {return estimate?round(estimate.low*(profile.experience==='beginner'||Number(profile.age)>=65?0.85:0.90)):null;}
  function roundLoad(weight,increment) {return Math.floor((weight+1e-8)/increment)*increment;}
  function repsAtLoad(weight,capacity,rir=2) {
    if(!valid(weight,0.1,600)||!valid(capacity,0.1,1000)||Number(weight)>Number(capacity))return null;
    const reps=Math.floor(30*(Number(capacity)/Number(weight)-1)-rir+1e-7);
    return reps<1?null:Math.min(15,reps);
  }
  function loadForReps(capacity,reps,rir,increment=2.5) {return roundLoad(capacity/(1+(reps+rir)/30),increment);}
  function reviseSet(row,field,value) {
    const updated={...row,[field]:value,done:false};
    if(row.index!==undefined)updated.rir=null;
    if(field==='weight'&&row.unit!=='秒'&&row.loadConvention!=='assistance'&&row.loadConvention!=='bodyweight') {
      const reserve=row.targetRir===undefined?2:row.targetRir;
      const reps=row.capacity?repsAtLoad(value,row.capacity,reserve):null;
      updated.advice=!row.capacity?'尚无可靠的同动作能力基准，无法科学推算次数。请填写试重后的可控次数；不能把加重直接换成固定少做两次。':reps===null?'该重量无法在当前模型下保留目标余力。请减重，或明确填写经过试重确认的次数。':'根据同动作训练基准 '+row.capacity+' kg、保留 '+reserve+' 次余力反算；这不是精确能力保证。';
      updated.reps=reps===null?'':reps;
      if(reps!==null&&row.index===undefined)updated.targetReps=reps;
    }
    if(field==='weight'&&row.loadConvention==='assistance'){updated.reps='';updated.advice='助力越大越容易，不能用普通加重公式换算次数；请实际试做确认。';}
    if(field==='reps'&&valid(value,1,300))updated.advice='已手动修改次数；按实际能力完成，不必勉强达到目标。';
    return updated;
  }
  const api={sources,estimatePB,trainingMax,roundLoad,repsAtLoad,loadForReps,reviseSet,fatigueLevels,fatigueInfo,straightSets};
  if(typeof module!=='undefined')module.exports=api;else globalThis.MuscleScience=api;
})();
