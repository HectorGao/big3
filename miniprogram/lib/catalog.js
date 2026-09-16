(function () {
  const lifts = [
    { id: 'squat', name: '深蹲', en: 'SQUAT', muscle: 'quads', subtitle: '下肢力量', muscles: ['quads','glutes','core'] },
    { id: 'bench', name: '卧推', en: 'BENCH PRESS', muscle: 'chest', subtitle: '上肢推力', muscles: ['chest','shoulders','triceps'] },
    { id: 'deadlift', name: '硬拉', en: 'DEADLIFT', muscle: 'hamstrings', subtitle: '后侧链力量', muscles: ['hamstrings','glutes','back','lowerback','upperback'] }
  ];
  const muscles = [
    {id:'chest',name:'胸部',side:'front',lift:'bench'}, {id:'shoulders',name:'肩部',side:'front',lift:'bench'},
    {id:'biceps',name:'肱二头肌',side:'front',lift:'deadlift'}, {id:'core',name:'核心',side:'front',lift:'squat'},
    {id:'quads',name:'股四头肌',side:'front',lift:'squat'}, {id:'back',name:'背阔肌',side:'back',lift:'deadlift'},
    {id:'upperback',name:'斜方肌 / 菱形肌区',side:'back',lift:'deadlift',note:'斜方肌覆盖颈后至胸椎中线；菱形肌位于其深层，示意区域并非独立表层轮廓。'},
    {id:'lowerback',name:'竖脊肌 / 腰背',side:'back',lift:'deadlift',note:'竖脊肌位于脊柱两侧，腰部中线为脊柱及筋膜区域，不是一整块肌肉。'},
    {id:'triceps',name:'肱三头肌',side:'back',lift:'bench'}, {id:'glutes',name:'臀部',side:'back',lift:'squat'},
    {id:'hamstrings',name:'腘绳肌',side:'back',lift:'deadlift'}, {id:'calves',name:'小腿',side:'back',lift:'squat'}
  ];
  const equipment = ['全部器械','杠铃','哑铃','自重','器械','绳索'];
  const rows = [
    ['squat','杠铃深蹲','Barbell squat','杠铃',['quads','glutes','core'],['足底稳定，吸气收紧躯干。','膝盖沿脚尖方向屈伸，下蹲到可控深度。','保持杠铃在足中部上方，平稳站起。'],'避免膝内扣与失控塌腰；使用安全杆。',['goblet','legpress']],
    ['bench','杠铃卧推','Barbell bench press','杠铃',['chest','triceps','shoulders'],['双脚稳定，肩胛后收下沉，握距舒适。','手腕叠在前臂上方，缓慢下放到胸部附近。','保持臀部接触卧推凳，平稳推起。'],'使用保护杆或保护者，不独自尝试极限重量。',['dbbench','pushup']],
    ['deadlift','传统硬拉','Conventional deadlift','杠铃',['hamstrings','glutes','back','core'],['杠铃靠近小腿，脚位约髋宽。','屈髋握杠，收紧背阔肌与腹部。','双脚推地，杠铃贴身上升，髋膝自然伸直。'],'避免猛拽起杠和顶端过度后仰。',['sumo','rdl']],
    ['goblet','高脚杯深蹲','Goblet squat','哑铃',['quads','glutes','core'],['双手将哑铃托在胸前。','足底稳定，膝盖朝脚尖方向下蹲。','在可控深度停稳后站起。'],'不要为了深度牺牲躯干稳定。',['legpress']],
    ['split','保加利亚分腿蹲','Split squat','哑铃',['quads','glutes'],['后脚放在低凳上，前脚踩稳。','缓慢下降，前腿承担主要负荷。','前脚推地站起，左右各完成目标次数。'],'每侧计次；失去平衡时改为普通分腿蹲。',['goblet']],
    ['legpress','腿举','Leg press','器械',['quads','glutes'],['腰背和臀部贴住靠垫。','缓慢屈膝，下降到骨盆仍稳定的深度。','推起平台，不强行锁死膝盖。'],'避免骨盆卷起和膝内扣。',['goblet']],
    ['dbbench','哑铃卧推','Dumbbell bench press','哑铃',['chest','triceps','shoulders'],['坐稳后将哑铃带到胸两侧。','肩胛稳定，前臂保持接近竖直。','平稳推起并控制下放。'],'轻重量起步，不向旁边抛哑铃。',['pushup']],
    ['pushup','俯卧撑','Push-up','自重',['chest','triceps','core'],['双手略宽于肩，身体保持直线。','屈肘下降到可控深度。','推起身体，腹部持续收紧。'],'需要时改为上斜俯卧撑，避免塌腰。',['dbbench']],
    ['lateral','哑铃侧平举','Lateral raise','哑铃',['shoulders'],['肘部微屈，哑铃置于身体两侧。','抬臂到舒适高度，手腕保持自然。','缓慢下放，躯干不摆动。'],'不要耸肩借力或追求过重负荷。',['facepull']],
    ['pressdown','绳索下压','Triceps pushdown','绳索',['triceps'],['上臂贴近身体，握住绳索。','保持肘部位置，向下伸肘。','控制回程至肘部自然弯曲。'],'避免肩部前后摆动。',['pushup']],
    ['rdl','罗马尼亚硬拉','Romanian deadlift','杠铃',['hamstrings','glutes','back'],['膝盖微屈，收紧腹部与背部。','髋部向后移，杠铃贴近腿部下降。','到后侧拉伸且背部稳定的位置后站起。'],'深度由髋活动度决定，不强求触地。',['db-rdl']],
    ['db-rdl','哑铃罗马尼亚硬拉','Dumbbell RDL','哑铃',['hamstrings','glutes'],['哑铃放在腿前，膝盖微屈。','髋向后推，哑铃贴近双腿下降。','保持背部稳定，用臀部带动站起。'],'不要弓背或把动作变成深蹲。',['bridge']],
    ['sumo','相扑硬拉','Sumo deadlift','杠铃',['glutes','quads','hamstrings'],['双脚宽站，脚尖适度外展。','双手在双腿内侧握杠，收紧躯干。','膝盖向脚尖方向打开，推地站起。'],'站距以髋部舒适、可控为准。',['deadlift']],
    ['curl-leg','腿弯举','Leg curl','器械',['hamstrings'],['调整器械轴心与膝关节对齐。','稳定骨盆，屈膝拉动滚垫。','缓慢回程，保持张力。'],'避免挺腰借力。',['db-rdl']],
    ['row','胸托哑铃划船','Chest-supported row','哑铃',['back','biceps'],['俯卧在上斜凳上，胸部贴稳。','肘部向后拉，肩胛自然回收。','缓慢下放哑铃。'],'不仰头或用腰部甩动。',['pulldown']],
    ['pulldown','高位下拉','Lat pulldown','器械',['back','biceps'],['坐稳并固定大腿，握距舒适。','肘部向下拉，拉杆朝上胸靠近。','控制回程，肩部自然上旋。'],'不要颈后下拉或大幅后仰。',['row']],
    ['facepull','绳索面拉','Face pull','绳索',['back','shoulders'],['绳索设在面部附近高度。','拉向面部两侧，肘部自然打开。','控制还原，躯干不晃动。'],'用可控轻重量，不强行外旋。',['row']],
    ['curl','哑铃弯举','Dumbbell curl','哑铃',['biceps'],['自然站立，上臂贴近身体。','屈肘抬起哑铃，手腕稳定。','缓慢伸肘还原。'],'避免甩动躯干。',['row']],
    ['bridge','臀桥','Glute bridge','自重',['glutes','hamstrings'],['仰卧屈膝，双脚踩稳。','收紧腹部，抬髋到躯干与大腿成线。','短暂停留后控制下放。'],'不要以腰椎过伸代替伸髋。',['db-rdl']],
    ['calf','站姿提踵','Standing calf raise','自重',['calves'],['扶稳支撑物，前脚掌踩稳。','抬起脚跟，顶端短暂停留。','缓慢下放至舒适位置。'],'避免弹震；可先双腿后单腿。',[]],
    ['plank','平板支撑','Plank','自重',['core'],['前臂撑地，肘部在肩部下方。','头、躯干和骨盆保持自然直线。','保持呼吸，以姿势稳定为结束标准。'],'以秒计时，不憋气或塌腰。',['deadbug']],
    ['deadbug','死虫式','Dead bug','自重',['core'],['仰卧抬起四肢，腹部轻收。','交替伸展对侧手臂和腿。','在腰部稳定的范围内缓慢回收。'],'每侧计次，不为伸直而拱腰。',['plank']]
  ];
  const exercises = rows.map(([id,name,en,equipment,muscles,steps,caution,alternatives]) => ({id,name,en,equipment,muscles,steps,caution,alternatives,unit:id==='plank'?'秒':'次',weightUnit:equipment==='哑铃'?'单只 kg':equipment==='自重'?'额外负重 kg':equipment==='器械'||equipment==='绳索'?'器械标重 kg':'总重 kg'}));
  for(const e of exercises){if(['row','facepull','deadlift','sumo'].includes(e.id))e.muscles.push('upperback');if(['deadlift','sumo','rdl','db-rdl','squat'].includes(e.id))e.muscles.push('lowerback');}
  const catalog = {lifts,muscles,equipment,exercises,byId: id => exercises.find(e=>e.id===id)};
  if(typeof module !== 'undefined') module.exports=catalog; else globalThis.MuscleCatalog=catalog;
})();
