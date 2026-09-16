(function () {
  // Each movement has explicit pose geometry and a selected view; units are drawing coordinates.
  const benchAxes={torso:[[0,35,54],[0,87,57]],bar:[[-97,76,72],[97,76,72]]};
  const figures={
    squat:{equipment:'bar-back',view:'斜前方',poses:[[[160,35],[158,62],[129,91],[147,60],[150,136],[150,183],[147,233]],[[191,89],[179,114],[151,144],[168,112],[125,166],[179,181],[147,233]]],cue:'双手固定上背杠位；下蹲时膝沿脚尖方向，足底不离地'},
    bench:{equipment:'bench-bar',view:'斜侧方',poses:[[[0,0]],[[1,1]]],cue:'肩背与臀部接触凳面，杠铃横跨胸部，手腕与前臂对齐'},
    dbbench:{equipment:'bench-db',view:'斜侧方',poses:[[[0,0]],[[1,1]]],cue:'双侧独立握铃，肩背稳定；推起后不碰撞哑铃'},
    deadlift:{equipment:'bar',view:'斜前方',poses:[[[204,86],[189,113],[184,163],[177,215],[126,155],[166,180],[145,233]],[[160,35],[158,64],[158,111],[156,157],[151,139],[149,187],[145,233]]],cue:'起始杠铃贴近小腿；推地伸髋，不在顶端后仰'},
    sumo:{equipment:'sumo',view:'正面',poses:[[[150,82],[150,107],[133,157],[130,210],[150,157],[104,180],[77,231]],[[150,32],[150,62],[131,111],[130,158],[150,133],[107,182],[77,231]]],cue:'双手在双腿内侧，脚尖外展，膝盖沿脚尖方向'},
    goblet:{equipment:'goblet',view:'侧面',poses:[[[158,36],[153,64],[137,104],[173,86],[146,138],[146,185],[141,231]],[[195,89],[177,113],[170,153],[198,122],[126,166],[183,185],[148,231]]],cue:'双手托住哑铃上端，胸前持铃，控制下蹲'},
    split:{equipment:'split',view:'侧面',poses:[[[172,37],[166,67],[171,115],[176,160],[149,140],[178,183],[189,231]],[[177,77],[168,106],[171,151],[175,195],[145,178],[193,186],[191,231]]],cue:'后脚背放低凳，前脚掌与脚跟踩稳，每侧计次'},
    legpress:{equipment:'legpress',view:'侧面',poses:[[[77,92],[91,118],[118,156],[141,179],[123,184],[179,133],[234,82]],[[77,92],[91,118],[118,156],[141,179],[123,184],[139,115],[191,85]]],cue:'骨盆与腰背贴垫，平台随双脚移动，不锁死膝盖'},
    pushup:{equipment:'floor',view:'侧面',poses:[[[235,105],[207,120],[204,173],[201,229],[145,155],[96,193],[43,229]],[[245,169],[218,183],[173,188],[201,229],[151,199],[97,214],[43,229]]],cue:'双手固定支撑，头、躯干和骨盆保持一线'},
    lateral:{equipment:'lateral',view:'正面',poses:[[[150,32],[150,63],[118,109],[109,155],[150,140],[132,186],[127,232]],[[150,32],[150,63],[102,76],[58,89],[150,140],[132,186],[127,232]]],cue:'双臂侧抬，肘微屈；不要耸肩或甩动躯干'},
    pressdown:{equipment:'cable-top',view:'侧面',poses:[[[150,34],[147,64],[149,112],[191,94],[139,138],[140,186],[135,232]],[[150,34],[147,64],[149,112],[157,158],[139,138],[140,186],[135,232]]],cue:'上臂保持原位，绳索向下伸肘，回程缓慢'},
    rdl:{equipment:'bar',view:'斜侧方',poses:[[[161,34],[157,64],[158,112],[157,158],[148,140],[145,187],[142,232]],[[232,86],[208,107],[195,155],[183,201],[134,146],[151,185],[142,232]]],cue:'先站稳，再髋后移；杠铃贴腿，膝盖仅微屈'},
    'db-rdl':{equipment:'db',view:'侧面',poses:[[[160,35],[155,64],[155,112],[153,159],[145,138],[142,186],[139,232]],[[227,91],[205,113],[197,159],[188,205],[132,148],[147,186],[139,232]]],cue:'两只哑铃贴腿下降，到背部仍能稳定的位置即可'},
    row:{equipment:'row',view:'斜侧方',poses:[[[230,69],[207,92],[201,139],[195,187],[143,140],[105,181],[86,232]],[[230,69],[207,92],[166,112],[195,148],[143,140],[105,181],[86,232]]],cue:'胸部贴住上斜凳；肘向后拉，肩胛自然回收，不抬胸'},
    pulldown:{equipment:'pulldown',view:'斜前方',poses:[[[151,65],[151,91],[122,55],[130,19],[145,154],[195,154],[189,232]],[[151,65],[151,91],[114,132],[126,101],[145,154],[195,154],[189,232]]],cue:'大腿固定，拉杆向上胸，不拉到颈后；躯干不大幅摆动'},
    facepull:{equipment:'facepull',view:'斜侧方',poses:[[[140,35],[143,66],[189,70],[235,75],[138,138],[141,186],[139,232]],[[140,35],[143,66],[111,88],[152,48],[138,138],[141,186],[139,232]]],cue:'绳索拉向面部两侧，双手分开，肘部自然外展'},
    curl:{equipment:'db',view:'侧面',poses:[[[154,35],[149,65],[148,114],[151,162],[140,139],[138,186],[135,232]],[[154,35],[149,65],[148,114],[182,82],[140,139],[138,186],[135,232]]],cue:'上臂固定在体侧，屈肘抬铃，避免前后摆动'},
    'curl-leg':{equipment:'legcurl',view:'侧面',poses:[[[240,127],[213,143],[221,179],[241,202],[151,153],[99,159],[45,162]],[[240,127],[213,143],[221,179],[241,202],[151,153],[99,159],[87,107]]],cue:'膝关节对准转轴，小腿推动滚垫；骨盆不抬离凳面'},
    bridge:{equipment:'floor',view:'侧面',poses:[[[53,214],[79,221],[120,224],[160,226],[145,223],[190,181],[230,230]],[[53,214],[79,221],[120,224],[160,226],[147,190],[192,167],[230,230]]],cue:'双脚和肩背稳定，抬髋至肩髋膝成线，不以挺腰代替'},
    calf:{equipment:'calf',view:'侧面',poses:[[[154,37],[150,66],[183,105],[226,102],[143,139],[143,185],[139,231]],[[154,23],[150,52],[182,89],[226,102],[143,125],[143,171],[141,217]]],cue:'扶稳支撑物，前脚掌保持接触地面，仅抬起脚跟'},
    plank:{equipment:'plank',view:'侧面',poses:[[[232,144],[207,160],[210,226],[252,226],[150,181],[99,205],[45,231]],[[232,144],[207,160],[210,226],[252,226],[150,181],[99,205],[45,231]]],cue:'前臂与脚尖支撑，肘在肩下；保持呼吸，以姿势稳定为结束标准'},
    deadbug:{equipment:'deadbug',view:'斜侧方',poses:[[[53,216],[78,220],[79,173],[80,125],[144,221],[148,168],[201,168]],[[53,216],[78,220],[42,199],[13,165],[144,221],[195,212],[250,213]]],cue:'对侧手脚缓慢伸展；另一侧保持抬起，腰部不拱起'}
  };
  function line(ctx,points,color,width){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  function circle(ctx,p,r,color){ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function polygon(ctx,points,color,stroke='#55516e'){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  function limb(ctx,points,color,width){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];const length=Math.hypot(b[0]-a[0],b[1]-a[1]);const nx=-(b[1]-a[1])/length,ny=(b[0]-a[0])/length;const w=width/2,v=w*.68;polygon(ctx,[[a[0]+nx*w,a[1]+ny*w],[b[0]+nx*v,b[1]+ny*v],[b[0]-nx*v,b[1]-ny*v],[a[0]-nx*w,a[1]-ny*w]],color);circle(ctx,a,w*.8,color);circle(ctx,b,v,color);}}
  function head(ctx,p,front=false){circle(ctx,p,14,'#ececef');ctx.strokeStyle='#55516e';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p[0],p[1]-3,12,Math.PI,Math.PI*2);ctx.stroke();circle(ctx,[p[0]+(front?-5:6),p[1]-2],1.2,'#55516e');if(front)circle(ctx,[p[0]+5,p[1]-2],1.2,'#55516e');line(ctx,[[p[0]+5,p[1]+5],[p[0]+9,p[1]+4]],'#55516e',1);}
  function benchPressPanel(ctx,phase,dumbbells=false){
    // Oblique technical projection: x is across the bench, y runs head-to-foot, z is height.
    const p=([x,y,z])=>[90+0.60*x+0.65*y,220+0.25*x-0.30*y-0.80*z];
    const poly=(points,color)=>polygon(ctx,points.map(p),color);
    const stroke=(points,color,width)=>line(ctx,points.map(p),color,width);
    const bone=(points,color,width)=>limb(ctx,points.map(p),color,width);
    stroke([[-90,-35,0],[95,-35,0]],'#e7e7ed',2);
    for(const x of [-74,74]){stroke([[x,113,0],[x,113,113]],'#aaa8b7',5);stroke([[x-15,105,0],[x+15,121,0]],'#aaa8b7',4);}
    for(const y of [5,108])for(const x of [-15,15])stroke([[x,y,0],[x,y,38]],'#aaa8b7',4);
    poly([[-19,-4,34],[19,-4,34],[19,124,34],[-19,124,34]],'#c1c0cb');
    poly([[-19,-4,41],[19,-4,41],[19,124,41],[-19,124,41]],'#d9d8e0');
    for(const x of [-1,1]){bone([[x*12,25,53],[x*34,-10,36],[x*40,-33,5]],x<0?'#eeeeF1':'#e5e5e9',14);stroke([[x*40,-33,4],[x*42,-48,3]],'#e5e5e9',9);}
    poly([[-16,21,52],[16,21,52],[18,42,55],[-18,42,55]],'#d1cfdb');
    const [hipAxis,shoulderAxis]=benchAxes.torso;
    poly([[-14,hipAxis[1],hipAxis[2]],[14,hipAxis[1],hipAxis[2]],[23,shoulderAxis[1],shoulderAxis[2]],[-23,shoulderAxis[1],shoulderAxis[2]]],'#f57b9f');
    stroke([[0,87,57],[0,105,55]],'#ededf0',12);
    head(ctx,p([0,118,54]),true);
    const y=phase?92:76,z=phase?121:72;
    for(const sign of [-1,1]){
      const arm=[[sign*23,87,57],phase?[sign*31,90,90]:[sign*43,74,40],[sign*43,y,z]];
      bone(arm,sign<0?'#ededf0':'#ededf0',12);
    }
    if(dumbbells){for(const sign of [-1,1])dumbbell(ctx,p([sign*43,y,z]));}
    else {
      stroke(benchAxes.bar.map(v=>[v[0],y,z]),'#55516e',5);
      for(const x of [-79,79]){
        const ring=[];for(let i=0;i<24;i++){const t=i*Math.PI/12;ring.push([x,y+18*Math.cos(t),z+18*Math.sin(t)]);}
        poly(ring,'#858196');circle(ctx,p([x,y,z]),3,'#dddce4');
      }
      for(const sign of [-1,1])circle(ctx,p([sign*43,y,z]),4,'#ededf0');
    }
    ctx.font='10px sans-serif';ctx.fillStyle='#55516e';ctx.textAlign='center';ctx.fillText(phase?'推起：双手向上，肩背保持支撑':'下放：仰卧，杠铃横跨胸部',150,254);
  }
  function dumbbell(ctx,p){line(ctx,[[p[0]-10,p[1]],[p[0]+10,p[1]]],'#605b75',4);line(ctx,[[p[0]-9,p[1]-7],[p[0]-9,p[1]+7]],'#605b75',5);line(ctx,[[p[0]+9,p[1]-7],[p[0]+9,p[1]+7]],'#605b75',5);}
  function bar(ctx,p){line(ctx,[[p[0]-47,p[1]],[p[0]+47,p[1]]],'#605b75',4);line(ctx,[[p[0]-36,p[1]-17],[p[0]-36,p[1]+17]],'#605b75',9);line(ctx,[[p[0]+36,p[1]-17],[p[0]+36,p[1]+17]],'#605b75',9);}
  function bench(ctx,a,b){line(ctx,[a,b],'#aaa6bb',13);line(ctx,[[a[0],a[1]+6],[a[0]-6,230]],'#aaa6bb',5);line(ctx,[[b[0],b[1]+6],[b[0]+6,230]],'#aaa6bb',5);}
  function panel(ctx,f,pose,phase){
    const [head,shoulder,elbow,hand,hip,knee,foot]=pose;const eq=f.equipment;
    if(eq==='bench-bar'||eq==='bench-db'){benchPressPanel(ctx,phase,eq==='bench-db');return;}
    if(eq==='bar-back'||eq==='bar'||eq==='sumo'||eq==='lateral'){liftingPanel(ctx,f,phase);return;}
    line(ctx,[[22,236],[280,236]],'#e9e8ef',2);
    if(eq==='row')bench(ctx,[141,151],[216,107]);
    if(eq.startsWith('bench'))bench(ctx,[113,173],[233,173]);
    if(eq==='legcurl')bench(ctx,[92,174],[205,164]);
    if(eq==='pulldown'){bench(ctx,[126,167],[183,167]);line(ctx,[[235,233],[235,10],[146,10]],'#aaa6bb',5);line(ctx,[[175,10],hand],'#aaa6bb',2);line(ctx,[[hand[0]-40,hand[1]],[hand[0]+20,hand[1]]],'#aaa6bb',5);}
    if(eq==='cable-top'||eq==='facepull'){line(ctx,[[263,233],[263,15]],'#aaa6bb',5);line(ctx,[[263,eq==='cable-top'?20:72],hand],'#aaa6bb',2);}
    if(eq==='legpress'){bench(ctx,[78,118],[111,191]);line(ctx,[[265,22],[173,161]],'#aaa6bb',5);line(ctx,[[foot[0]-13,foot[1]-12],[foot[0]+15,foot[1]+12]],'#aaa6bb',9);}
    if(eq==='split')bench(ctx,[72,176],[102,176]);
    if(eq==='calf'){line(ctx,[[220,231],[220,86]],'#aaa6bb',4);}
    // Far-side limbs use a lighter tone to make bilateral support legible.
    const farKnee=eq==='sumo'?[300-knee[0],knee[1]]:eq==='split'?[111,phase?204:171]:[knee[0]-12,knee[1]+2];
    const farFoot=eq==='sumo'?[300-foot[0],foot[1]]:eq==='split'?[88,171]:[foot[0]-13,foot[1]];
    limb(ctx,[hip,farKnee,farFoot],'#e6e5ed',15);
    if(eq==='lateral'&&phase)line(ctx,[shoulder,[192,80],[232,87]],'#e6e5ed',10);
    else if(eq==='deadbug'){line(ctx,[hip,[154,166],[208,166]],'#e6e5ed',11);line(ctx,[shoulder,[92,169],[94,121]],'#e6e5ed',9);}
    else line(ctx,[[shoulder[0]-8,shoulder[1]+4],[elbow[0]-10,elbow[1]+3],[hand[0]-10,hand[1]+3]],'#e6e5ed',9);
    limb(ctx,[hip,knee,foot],'#ecebf0',17);line(ctx,[[foot[0]-3,foot[1]],[foot[0]+14,eq==='calf'?230:Math.min(230,foot[1]+3)]],'#777087',9);line(ctx,[[foot[0]+4,foot[1]-1],[foot[0]+11,foot[1]]],'#eeeeF1',2);
    limb(ctx,[shoulder,hip],'#f79cba',31);line(ctx,[shoulder,head],'#ecebf0',11);
    circle(ctx,head,14,'#ecebf0');ctx.strokeStyle='#55516e';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(head[0],head[1]-3,12,Math.PI,Math.PI*2);ctx.stroke();circle(ctx,[head[0]+7,head[1]-2],1.3,'#55516e');line(ctx,[[head[0]+7,head[1]+6],[head[0]+11,head[1]+5]],'#55516e',1);
    circle(ctx,hip,12,'#cdc9d8');limb(ctx,[shoulder,elbow,hand],'#ecebf0',13);circle(ctx,hand,5,'#ecebf0');
    if(['db','row','bench-db','split','goblet','lateral'].includes(eq)){if(eq!=='goblet'&&eq!=='lateral')dumbbell(ctx,[hand[0]-10,hand[1]+3]);dumbbell(ctx,hand);}
    if(eq==='lateral'&&phase)dumbbell(ctx,[232,87]);
    if(['bar','sumo','bench-bar'].includes(eq))bar(ctx,hand);
    if(eq==='bar-back')bar(ctx,[shoulder[0],shoulder[1]-7]);
    if(eq==='legcurl')circle(ctx,foot,8,'#aaa6bb');
  }
  function liftingPanel(ctx,f,phase){
    const eq=f.equipment,front=eq==='sumo'||eq==='lateral';
    const p=([x,y,z])=>front?[150+x,238-z]:[155+x*.72+y*.48,238+x*.14-z];
    const bone=(points,width=12,color='#ecebf0')=>limb(ctx,points.map(p),color,width);
    const stroke=(points,width=2,color='#55516e')=>line(ctx,points.map(p),color,width);
    const squat=eq==='bar-back',hinge=eq==='bar';
    const lowered=squat?phase===1:hinge?(f.cue.includes('先站稳')?phase===1:phase===0):eq==='sumo'&&phase===0;
    const hip=lowered?(squat?[0,-36,82]:[0,-26,100]):[0,0,126];
    const shoulder=lowered?(squat?[0,3,140]:[0,45,135]):[0,0,195];
    const headPoint=[0,shoulder[1]+(lowered?8:0),shoulder[2]+27];
    const stance=eq==='sumo'?64:24;
    stroke([[-110,-20,0],[110,25,0]],1,'#e5e3eb');
    for(const sign of [-1,1]){
      const knee=[sign*stance,lowered?(squat?28:15):0,lowered?49:63],ankle=[sign*stance,0,6];
      bone([[sign*15,hip[1],hip[2]],knee,ankle],17);
      stroke([ankle,[sign*stance,23,4]],9,'#aba5b9');
    }
    const torso=[[-17,hip[1],hip[2]],[17,hip[1],hip[2]],[28,shoulder[1],shoulder[2]],[-28,shoulder[1],shoulder[2]]];
    polygon(ctx,torso.map(p),'#f3adC5');
    stroke([shoulder,headPoint],11,'#ecebf0');head(ctx,p(headPoint),front);
    let barY=lowered?29:8,barZ=lowered?24:134;
    if(squat){barY=shoulder[1]-3;barZ=shoulder[2]-4;}
    for(const sign of [-1,1]){
      const origin=[sign*27,shoulder[1],shoulder[2]];
      const hand=eq==='lateral'?(phase?[sign*108,0,183]:[sign*40,0,130]):[sign*(eq==='sumo'?23:43),barY,barZ];
      const elbow=eq==='lateral'?(phase?[sign*67,0,188]:[sign*34,0,161]):squat?[sign*46,shoulder[1]-7,shoulder[2]-35]:[sign*34,(shoulder[1]+barY)/2,(shoulder[2]+barZ)/2];
      bone([origin,elbow,hand],12);if(eq==='lateral')dumbbell(ctx,p(hand));
    }
    if(eq!=='lateral'){
      stroke([[-98,barY,barZ],[98,barY,barZ]],4);
      for(const sign of [-1,1]){const ring=[];for(let n=0;n<24;n++){const a=n*Math.PI/12;ring.push(p([sign*80,barY+19*Math.cos(a),barZ+19*Math.sin(a)]));}polygon(ctx,ring,'#b4aebf');circle(ctx,p([sign*80,barY,barZ]),3,'#f5f3f8');}
    }
  }
  function draw(ctx,width,height,id,phase=null){
    const f=figures[id];if(!f)throw Error('缺少动作示意：'+id);
    ctx.clearRect(0,0,width,height);ctx.save();
    if(phase!==null){const scale=Math.min(width/320,height/270);ctx.translate((width-320*scale)/2,(height-270*scale)/2);ctx.scale(scale,scale);panel(ctx,f,f.poses[phase],phase);ctx.restore();return;}
    const scale=Math.min(width/640,height/270);ctx.translate((width-640*scale)/2,(height-270*scale)/2);ctx.scale(scale,scale);
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,640,260);
    ctx.save();ctx.translate(4,0);panel(ctx,f,f.poses[0],0);ctx.restore();
    ctx.save();ctx.translate(336,0);panel(ctx,f,f.poses[1],1);ctx.restore();
    line(ctx,[[307,126],[329,126]],'#d65180',2);line(ctx,[[323,120],[329,126],[323,132]],'#d65180',2);
    ctx.restore();
  }
    const api={figures,draw,benchAxes};if(typeof module!=='undefined')module.exports=api;else globalThis.MuscleFigures=api;
})();
