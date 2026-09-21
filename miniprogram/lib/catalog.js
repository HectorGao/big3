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
    ['curl-leg','俯卧腿弯举','Prone leg curl','器械',['hamstrings'],['俯卧贴稳，器械转轴与膝关节对齐，滚垫在小腿后下方。','稳定骨盆，屈膝拉动滚垫。','缓慢回程，保持张力。'],'避免挺腰借力。',['bridge']],
    ['row','胸托哑铃划船','Chest-supported row','哑铃',['back','biceps'],['俯卧在上斜凳上，胸部贴稳。','肘部向后拉，肩胛自然回收。','缓慢下放哑铃。'],'不仰头或用腰部甩动。',['pulldown']],
    ['pulldown','高位下拉','Lat pulldown','器械',['back','biceps'],['坐稳并固定大腿，握距舒适。','肘部向下拉，拉杆朝上胸靠近。','控制回程，肩部自然上旋。'],'不要颈后下拉或大幅后仰。',['row']],
    ['facepull','绳索面拉','Face pull','绳索',['back','shoulders'],['绳索设在面部附近高度。','拉向面部两侧，肘部自然打开。','控制还原，躯干不晃动。'],'用可控轻重量，不强行外旋。',['row']],
    ['curl','哑铃弯举','Dumbbell curl','哑铃',['biceps'],['自然站立，上臂贴近身体。','屈肘抬起哑铃，手腕稳定。','缓慢伸肘还原。'],'避免甩动躯干。',['row']],
    ['bridge','臀桥','Glute bridge','自重',['glutes','hamstrings'],['仰卧屈膝，双脚踩稳。','收紧腹部，抬髋到躯干与大腿成线。','短暂停留后控制下放。'],'不要以腰椎过伸代替伸髋。',['db-rdl']],
    ['calf','站姿提踵','Standing calf raise','自重',['calves'],['扶稳支撑物，前脚掌踩稳。','抬起脚跟，顶端短暂停留。','缓慢下放至舒适位置。'],'避免弹震；可先双腿后单腿。',[]],
    ['plank','平板支撑','Plank','自重',['core'],['前臂撑地，肘部在肩部下方。','头、躯干和骨盆保持自然直线。','保持呼吸，以姿势稳定为结束标准。'],'以秒计时，不憋气或塌腰。',['deadbug']],
    ['deadbug','死虫式','Dead bug','自重',['core'],['仰卧抬起四肢，腹部轻收。','交替伸展对侧手臂和腿。','在腰部稳定的范围内缓慢回收。'],'每侧计次，不为伸直而拱腰。',['plank']]
  ];
  rows.push(
    ['machine-press','坐姿器械推胸','Seated machine chest press','器械',['chest','triceps','shoulders'],['调节座椅，使握把约在胸部高度，肩背贴稳靠垫，双脚踩地。','手腕稳定，向前推动握把，不耸肩或抬离靠背。','推至舒适伸展，不猛锁肘；有控制地回到起点。'],'器械轨迹与标重各不相同；首次使用单独试重，不从卧推 PB 换算。',['dbbench','pushup','cable-fly']],
    ['weighted-bridge','杠铃负重臀桥','Weighted barbell glute bridge','杠铃',['glutes','hamstrings'],['仰卧地垫，肩背与头部接地，双脚踩稳；带护垫杠铃横放髋部，双手固定。','收腹抬髋，脚掌与肩背保持接地，杠铃随骨盆上升。','抬至肩、髋、膝近一直线，控制回落。'],'与靠凳臀推不同，肩背始终在地面；不要拱腰顶杠。装卸杠铃需留出安全空间。',['bridge','hip-thrust']],
    ['front-squat','前蹲','Front squat','杠铃',['quads','glutes','core'],['杠铃置于肩前，抬肘形成稳定支架。','足底踩稳，膝盖沿脚尖方向下蹲。','躯干稳定站起，保持抬肘。'],'勿用手腕独自承重；使用安全杆。',['goblet']],
    ['pause-squat','暂停深蹲','Paused squat','杠铃',['quads','glutes','core'],['上背架杠，吸气收紧躯干。','下蹲到可控深度，停约两秒，保持张力。','足底推地平稳站起。'],'暂停不放松腹部；不借底部反弹。',['squat']],
    ['tempo-squat','慢下放深蹲','Tempo squat','杠铃',['quads','glutes','core'],['稳定架杠并收紧躯干。','约三秒缓慢下蹲，足底均匀受力。','到可控深度后平稳站起。'],'控制速度优先于重量。',['goblet']],
    ['reverse-lunge','反向弓步蹲','Reverse lunge','哑铃',['quads','glutes'],['双手持铃，自然站立。','一脚向后迈步，前脚保持踩稳。','前腿推地回到站立，换侧。'],'每侧计次；不靠后脚猛推。',['split']],
    ['step-up','登阶','Step-up','哑铃',['quads','glutes'],['选择稳固且高度可控的台阶。','一脚完整踩台，前腿发力上台。','缓慢下台后换侧。'],'避免后腿蹬地借力；先徒手确认平衡。',['reverse-lunge']],
    ['leg-extension','腿屈伸','Leg extension','器械',['quads'],['膝关节对准器械转轴，靠背调稳。','伸膝抬起滚垫，骨盆保持贴座。','控制弯膝回程。'],'不弹起重块、不猛锁膝。',['legpress']],
    ['hip-thrust','杠铃臀推','Barbell hip thrust','杠铃',['glutes','hamstrings'],['肩胛下沿靠稳凳边，带垫杠铃放髋部。','脚掌踩稳，收腹抬髋。','顶端小腿接近竖直，控制下落。'],'不以后仰挺腰代替伸髋。',['bridge']],
    ['back-extension','45° 背伸','45-degree back extension','自重',['glutes','hamstrings','lowerback'],['大腿贴垫，髋折叠位置留出活动空间，脚踝固定。','髋向后折叠，躯干保持可控。','伸髋至身体成线即停止。'],'不追求顶端过伸；腰痛时不安排。',['bridge']],
    ['pause-bench','暂停卧推','Paused bench press','杠铃',['chest','triceps','shoulders'],['脚掌踩稳，肩背与臀部贴凳。','横向杠铃下降至胸前，轻停一秒保持张力。','平稳推起，腕肘对齐。'],'须有安全杆或保护者；不压胸反弹。',['bench']],
    ['close-bench','窄握卧推','Close-grip bench press','杠铃',['triceps','chest','shoulders'],['握距约肩宽，肩背贴凳。','肘自然靠近躯干，杠铃下降至胸前。','保持手腕稳定推起。'],'不是双手并拢；使用保护。',['pressdown']],
    ['incline-dbbench','上斜哑铃卧推','Incline dumbbell press','哑铃',['chest','shoulders','triceps'],['凳面调为约三十度，背部贴稳。','哑铃置于胸部两侧，前臂接近竖直。','向上推起后控制下放。'],'不靠腰部过度拱起完成。',['dbbench']],
    ['db-press','坐姿哑铃推举','Seated dumbbell shoulder press','哑铃',['shoulders','triceps'],['坐在有靠背的凳上，双脚踩稳。','哑铃从肩侧向上推起。','控制回到舒适深度。'],'避免腰椎过伸，不强压肩部幅度。',['lateral']],
    ['cable-fly','绳索夹胸','Cable chest fly','绳索',['chest','shoulders'],['滑轮约胸高，分腿站稳。','肘保持微屈，双臂在胸前合拢。','控制向两侧打开。'],'不将肩部拉至疼痛位置。',['pushup']],
    ['overhead-triceps','绳索过顶臂屈伸','Overhead cable triceps extension','绳索',['triceps'],['背对低滑轮，双手将绳索带到头后。','上臂稳定向上，伸肘。','控制屈肘回到头后。'],'不摆动腰背借力。',['pressdown']],
    ['incline-pushup','上斜俯卧撑','Incline push-up','自重',['chest','triceps','core'],['双手撑在稳定高台上。','身体成直线下降，胸部接近台边。','推起至肘伸直但不猛锁。'],'台面越高越容易；不塌腰。',['pushup']],
    ['cable-row','坐姿绳索划船','Seated cable row','绳索',['back','upperback','biceps'],['坐稳脚撑，躯干保持自然。','肘向后拉，握把接近腹部。','控制手臂伸长，躯干不甩动。'],'不以腰背后仰代替拉动。',['row']],
    ['barbell-row','杠铃划船','Bent-over barbell row','杠铃',['back','upperback','biceps','lowerback'],['屈髋俯身，腹部收紧，膝微屈。','杠铃拉向下胸或上腹。','控制下放，躯干角度稳定。'],'腰背负担较高，重硬拉后不默认叠加。',['row']],
    ['onearm-row','单臂哑铃划船','One-arm supported dumbbell row','哑铃',['back','upperback','biceps'],['一手和同侧膝支撑在凳上，另一脚踩稳。','持铃侧肘向髋部拉。','缓慢下放后换侧。'],'每侧计次；不扭腰或耸肩。',['row']],
    ['assisted-pullup','辅助引体向上','Assisted pull-up','器械',['back','biceps','upperback'],['设置助力，膝盖或脚放在助力垫。','肘向下拉，身体上升。','控制下降至舒适伸展。'],'助力重量越大越容易；不作普通负重换算。',['pulldown']],
    ['reverse-fly','反向飞鸟','Chest-supported reverse fly','哑铃',['upperback','shoulders'],['胸部贴住上斜凳，双臂自然下垂。','肘微屈向两侧展开。','缓慢收回，不抬胸。'],'选择能稳定控制的负荷。',['facepull']],
    ['hammer-curl','锤式弯举','Hammer curl','哑铃',['biceps'],['手心相对握铃，上臂贴近身体。','屈肘抬铃，保持中立握法。','缓慢下放。'],'不甩动身体或折腕。',['curl']],
    ['side-plank','侧平板支撑','Side plank','自重',['core'],['侧卧，肘放在肩下，双脚叠放或前后错开。','抬髋使头肩髋脚保持一线。','持续呼吸并计时，两侧分别完成。'],'不能稳定时改为屈膝支撑。',['deadbug']],
    ['bird-dog','鸟狗式','Bird dog','自重',['core','glutes','lowerback'],['四点跪姿，手在肩下、膝在髋下。','对侧手和腿缓慢伸长。','保持骨盆稳定后收回、换侧。'],'每侧计次，不抬腿到腰部过伸。',['deadbug']],
    ['pallof','Pallof 抗旋转推','Pallof press','绳索',['core'],['侧对胸高滑轮，双手持握把于胸前。','向前伸臂，抵抗绳索将身体拉转。','控制收回后换侧。'],'每侧计次；身体保持朝前，不跟随旋转。',['side-plank']],
    ['reverse-crunch','反向卷腹','Reverse crunch','自重',['core'],['仰卧屈髋屈膝，双臂放体侧。','缓慢将骨盆卷离地面。','控制回落，不甩腿。'],'动作幅度小，勿用颈部或惯性发力。',['deadbug']],
    ['suitcase-hold','单侧负重静态站立','Suitcase hold','哑铃',['core'],['一手持哑铃，双脚与髋同宽。','保持肩髋水平，站直呼吸并计时。','放下哑铃，换另一侧。'],'不向负重侧倾斜；每侧计时。',['side-plank']],
    ['seated-calf','坐姿提踵','Seated calf raise','器械',['calves'],['前脚掌踩平台，大腿贴住压垫。','抬起脚跟至可控高度。','缓慢下放。'],'不弹震，调整压垫避免膝部不适。',['calf']],
    ['single-calf','单腿提踵','Single-leg calf raise','自重',['calves'],['单脚站稳，一手扶固定物。','抬起支撑脚脚跟。','缓慢下降，换侧。'],'每侧计次，先保证平衡。',['calf']]
  );
  // Curated substitutions retain a related training role, not just a shared muscle.
  const extraAlternatives={bench:['machine-press'], 'cable-fly':['machine-press'], pushup:['machine-press'], bridge:['weighted-bridge','hip-thrust'], 'hip-thrust':['weighted-bridge'], 'db-rdl':['weighted-bridge'], 'curl-leg':['weighted-bridge'], plank:['pallof','suitcase-hold'],deadbug:['pallof','suitcase-hold'],'side-plank':['pallof','suitcase-hold'],'bird-dog':['pallof','suitcase-hold'],'reverse-crunch':['pallof'],pallof:['suitcase-hold','deadbug'],'suitcase-hold':['pallof'],calf:['seated-calf'],'single-calf':['seated-calf'],'incline-pushup':['dbbench'],dbbench:['cable-fly','machine-press']};
  for(const row of rows)row[7]=[...new Set([...row[7],...(extraAlternatives[row[0]]||[])])];
  const groups={squat:['squat','goblet','split','legpress','front-squat','pause-squat','tempo-squat','reverse-lunge','step-up','leg-extension'],hinge:['deadlift','sumo','rdl','db-rdl','bridge','curl-leg','hip-thrust','back-extension'],push:['bench','dbbench','pushup','lateral','pressdown','pause-bench','close-bench','incline-dbbench','db-press','cable-fly','overhead-triceps','incline-pushup'],pull:['row','pulldown','facepull','curl','cable-row','barbell-row','onearm-row','assisted-pullup','reverse-fly','hammer-curl'],core:['plank','deadbug','calf','side-plank','bird-dog','pallof','reverse-crunch','suitcase-hold','seated-calf','single-calf']};
  const timed=['plank','side-plank','suitcase-hold'];
  groups.hinge.push('weighted-bridge');
  groups.push.push('machine-press');
  const unilateral=['split','reverse-lunge','step-up','onearm-row','deadbug','bird-dog','pallof','single-calf','side-plank','suitcase-hold'];
  const isolation=['leg-extension','curl-leg','lateral','pressdown','overhead-triceps','cable-fly','reverse-fly','curl','hammer-curl','calf','seated-calf','single-calf'];
  const highBack=['squat','front-squat','pause-squat','tempo-squat','deadlift','sumo','rdl','db-rdl','barbell-row'];
  const patterns={squat:'膝主导',hinge:'髋主导',push:'上肢推',pull:'上肢拉',core:'躯干控制'};
  const purposes={split:'补充单侧下肢训练，观察两侧控制，不额外叠加轴向杠铃负荷','curl-leg':'通过屈膝训练腘绳肌，补充主项髋伸之外的功能',pallof:'训练抵抗旋转时的躯干控制','leg-extension':'补充股四头肌训练，减少额外腰背承重',row:'胸部支撑下训练上背与背阔肌，减少腰背静态承重','side-plank':'训练侧向躯干稳定，不追求大重量',dbbench:'补充推类工作量，左右独立控制；不从杠铃卧推重量直接换算',pressdown:'补充伸肘训练，不再增加整套复合推举',pulldown:'补充背阔肌与垂直拉动训练，避免重硬拉后的俯身承重',deadbug:'训练肢体运动时维持躯干稳定，以控制而非负重为目标'};
  const exercises=rows.map(([id,name,en,equipment,muscles,steps,caution,alternatives])=>{
    const group=Object.keys(groups).find(g=>groups[g].includes(id));
    const bodyweight=equipment==='自重',staticHold=timed.includes(id),perSide=unilateral.includes(id);
    const loadConvention=id==='assisted-pullup'?'assistance':bodyweight?'bodyweight':equipment==='杠铃'?'barbell-total':equipment==='哑铃'?(id==='goblet'||id==='suitcase-hold'||id==='onearm-row'?'single-implement':'per-hand'):'machine-stack';
    const weightUnit={assistance:'助力 kg',bodyweight:'自重 / 难度','barbell-total':'杠铃总重 kg','single-implement':'一只哑铃 kg','per-hand':'每只哑铃 kg','machine-stack':'器械标重 kg'}[loadConvention];
    return {id,name,en,equipment,muscles,primaryMuscles:muscles.slice(0,2),secondaryMuscles:muscles.slice(2),steps,caution,alternatives,group,unit:staticHold?'秒':perSide?'次/侧':'次',weightUnit,loadConvention,measurement:{kind:staticHold?'duration':'reps',perSide},movementPattern:id==='curl-leg'?'屈膝':id.includes('calf')||id==='calf'?'踝跖屈':patterns[group],difficulty:['front-squat','barbell-row'].includes(id)?'进阶':'基础',roles:lifts.some(l=>l.id===id)?['主项']:['辅助',...(group==='core'?['控制']:[])],fatigueTags:highBack.includes(id)?['腰背承重']:['低腰背负担'],isolation:isolation.includes(id),purpose:purposes[id]||('补充'+muscles.map(m=>musclesLookup(m)).join('、')+'的'+(staticHold?'静态控制':'动作训练')),commonErrors:[caution],alternativeCondition:'仅在器械可用、动作可控且目标肌群恢复允许时替换；换动作重新确认重量',media:{status:'pending',source:'original-imagegen',path:'/media-'+group+'/assets/'+id+'.jpg',phases:staticHold?['建立姿势','保持姿势']:['起始姿势','关键位置','结束姿势'],reference:'https://musclewiki.com/exercises/'+(group==='hinge'?'lowerback':group==='push'?'chest':group==='pull'?'lats':group==='core'?'abdominals':'quads')}};
  });
  function musclesLookup(id){return muscles.find(m=>m.id===id)?.name||id;}
  for(const e of exercises){if(['row','facepull','deadlift','sumo'].includes(e.id))e.muscles.push('upperback');if(['deadlift','sumo','rdl','db-rdl','squat'].includes(e.id))e.muscles.push('lowerback');}
  const primary={squat:['quads','glutes'],bench:['chest'],deadlift:['glutes','hamstrings'],row:['back','upperback'],pulldown:['back'],facepull:['upperback','shoulders'],dbbench:['chest'],pushup:['chest'],sumo:['glutes','quads'],'cable-row':['back','upperback'],'barbell-row':['back','upperback'],'onearm-row':['back','upperback'],'assisted-pullup':['back'],'incline-dbbench':['chest'],'db-press':['shoulders'],'cable-fly':['chest'],'pause-bench':['chest'],'close-bench':['triceps','chest'],'incline-pushup':['chest'],'back-extension':['glutes','hamstrings']};
  const phaseCues={
    deadlift:['杠铃靠近小腿，髋部后移，双手在腿外握杠并收紧躯干。','双脚推地，手臂伸直，杠铃贴腿越过膝部；不要主动耸肩或弯肘。','髋膝自然伸直站稳，不向后过度仰腰；随后控制下放。'],
    'pause-bench':['握稳杠铃，肩背与臀部贴凳、双脚踏地。','下放至胸肌下缘后短暂停稳，不弹胸；保护条件不足不练习大重量。','平稳推起，身体支撑点不变，再控制下放。'],
    'close-bench':['采用约肩宽握距，避免双手挤在一起。','杠铃下放至胸肌下缘，肘部靠近躯干、手腕在肘上方。','保持支撑，将杠铃推回胸部上方。'],
    'front-squat':['交叉臂前架示范：杠铃由前三角肌承托，肘部抬起。','足底保持着地，膝盖沿脚尖方向移动，控制下蹲。','保持肘位，腿部发力回站；握法需现场指导确认。'],
    sumo:['宽站距、脚尖外展，双手在双腿内握杠。','杠铃靠近身体，膝髋协调伸展，站距不变。','站直即止，不后仰；沿贴身路径控制回落。'],
    'back-extension':['大腿贴垫、脚踝固定，身体保持自然直线。','以髋关节为轴折叠，背部不主动弓起。','伸髋回到身体成线即停止，不追求腰部后仰。'],
    'step-up':['双手各持一铃，前脚完整踩上稳固台阶。','前腿发力上台，后脚离地，避免后腿用力蹬地。','台上站稳，再有控制地下台，按计划换侧。'],
    'bird-dog':['四点支撑：手在肩下，膝在髋下。','伸展对侧手脚，躯干与骨盆保持稳定。','回到四点支撑，再换另一侧。'],
    row:['胸部贴稳斜凳，双手持铃自然下垂。','肘向后拉，胸部不离开靠垫。','拉至可控终点后缓慢下放。'],
    lateral:['肘微屈，双臂放在体侧。','向两侧平稳抬臂，不耸肩。','抬至舒适肩高即止，再缓慢下放。'],
    pressdown:['屈肘握住绳索，上臂稳定。','保持肘部位置向下伸展。','伸肘至可控终点后缓慢还原。'],
    dbbench:['肩背和臀部贴凳，两铃在胸侧，前臂近竖直。','双手平稳上推，手腕保持稳定。','推至可控顶端，不撞击哑铃；缓慢下降。'],
    plank:['前臂和足尖支撑，肘在肩下，建立躯干直线。','保持呼吸；姿势开始变形即结束计时。']
  };
  const media=typeof module!=='undefined'?require('./media-manifest'):(globalThis.MuscleMedia||{});
  for(const e of exercises){
    if(e.id==='weighted-bridge')e.purpose='补充地面支撑下的髋伸训练，重点训练臀部；不能等同替代腿弯举的屈膝功能，与凳上臀推分别校准';
    e.primaryMuscles=primary[e.id]||e.primaryMuscles;
    e.secondaryMuscles=e.muscles.filter(m=>!e.primaryMuscles.includes(m));
    e.media={...e.media,status:media[e.id]?.status||'pending',available:media[e.id]?.status==='reviewed',frames:media[e.id]?.frames||[],phaseCues:phaseCues[e.id]||e.steps.slice(0,e.media.phases.length)};
    if(e.id==='side-plank'||e.id==='suitcase-hold')e.measurement.sideInstructions='左右分别保持指定秒数';
  }
  const catalog = {lifts,muscles,equipment,exercises,groups,byId: id => exercises.find(e=>e.id===id)};
  if(typeof module !== 'undefined') module.exports=catalog; else globalThis.MuscleCatalog=catalog;
})();
