(function () {
  const P=typeof module!=='undefined'?require('./planner'):globalThis.MusclePlanner;
  const KEY='three-lift-v1';
  function empty(){return {version:2,profile:null,history:[],session:null,feedback:[],events:[],settings:{maxTesting:false}};}
  function validate(data) {
    if(!data||![1,2].includes(data.version)||!Array.isArray(data.history)||data.history.length>10000) throw new Error('备份格式或版本不支持');
    if(data.version===2){
      if(!Array.isArray(data.feedback)||!Array.isArray(data.events)||data.feedback.length>10000||data.events.length>10000||typeof data.settings?.maxTesting!=='boolean')throw Error('规划数据格式无效');
      for(const f of data.feedback)if(!P.validDate(f.date)||f.date>P.dateKey()||!Number.isInteger(f.fatigue)||f.fatigue<1||f.fatigue>5||typeof f.pain!=='boolean'||!f.soreness||Object.values(f.soreness).some(v=>!Number.isInteger(v)||v<0||v>3))throw Error('恢复反馈无效');
      for(const e of data.events)if(typeof e.id!=='string'||!e.id||!['skip','defer','test'].includes(e.kind)||!P.validDate(e.date)||!['squat','bench','deadlift'].includes(e.lift)||e.kind==='defer'&&(!P.validDate(e.to)||e.to<=e.date))throw Error('计划调整无效');
    }
    if(data.profile!==null) {const error=P.validateProfile(data.profile);if(error)throw new Error(error);}
    if(data.history.some(r=>P.validateRecord(r))) throw new Error('备份中存在无效训练记录');
    if(new Set(data.history.map(r=>r.id)).size!==data.history.length) throw new Error('备份包含重复记录');
    if(data.session!==null && data.session!==undefined) {
      const s=data.session;
      if(!s||typeof s.id!=='string'||!P.validDate(s.date)||!['squat','bench','deadlift'].includes(s.lift)||!['volume','intensity','recovery','technique','deload','test','assessment','manual'].includes(s.mode)||!Array.isArray(s.sets)||!s.sets.length||s.sets.length>100) throw new Error('进行中的训练数据无效');
      for(const row of s.sets) {
        const probe={...s,completed:false,rpe:7,sets:[{...row,weight:row.weight===''?0:row.weight,reps:row.reps===''?1:row.reps,done:true}]};
        if(P.validateRecord(probe)||typeof row.done!=='boolean'||row.done&&row.weight==='')throw new Error('进行中的训练组数据无效');
      }
      if(!Number.isFinite(s.deadline)||s.deadline<0||!Number.isFinite(Number(s.rpe))||Number(s.rpe)<1||Number(s.rpe)>10)throw new Error('训练计时或用力程度无效');
    }
    return data;
  }
  function createStore(driver) {
    return {
      load(){const raw=driver.getStorageSync(KEY);if(raw===''||raw===undefined||raw===null)return empty();try{const d=validate(typeof raw==='string'?JSON.parse(raw):raw);return d.version===1?{...empty(),...d,version:2}:d;}catch(e){throw new Error('本地数据无法读取，请先导出原始备份，未覆盖原数据。'+e.message);}},
      save(data){validate(data);const old=driver.getStorageSync(KEY);if(old){const prior=typeof old==='string'?JSON.parse(old):old;if(prior.version===1&&!driver.getStorageSync(KEY+'-migration-backup'))driver.setStorageSync(KEY+'-migration-backup',typeof old==='string'?old:JSON.stringify(old));}driver.setStorageSync(KEY,JSON.stringify(data));return data;},
      exportRaw(){const raw=driver.getStorageSync(KEY);return typeof raw==='string'?raw:JSON.stringify(raw||empty(),null,2);},
      importRaw(raw){if(typeof raw!=='string'||raw.length>5e6)throw new Error('备份应为不超过 5 MB 的 JSON 文件');const parsed=validate(JSON.parse(raw));const data=parsed.version===1?{...empty(),...parsed,version:2}:parsed;this.save(data);return data;},
      feedback(value){const d=this.load();d.feedback=[value,...d.feedback.filter(f=>f.date!==value.date)];this.save(d);},
      event(value){const d=this.load();if(d.events.some(e=>e.id===value.id))throw Error('该调整已经保存');d.events.push(value);this.save(d);},
      updateSession(session){const data=this.load();if(!data.session||data.session.id!==session.id)throw new Error('当前训练已经变化，请刷新后重试');data.session=session;this.save(data);return session;},
      finish(session,actualDate=P.dateKey()){
        const data=this.load();
        if(data.history.some(r=>r.id===session.id))throw new Error('这次训练已经保存');
        if(data.session&&data.session.id!==session.id)throw new Error('当前训练已经变化，请刷新后重试');
        if(!P.validDate(actualDate)||actualDate>P.dateKey())throw Error('实际训练日期无效');
        const record={...session,date:actualDate,startedDate:session.date,sets:session.sets.filter(s=>s.done),completed:session.sets.filter(s=>s.exercise===session.lift).every(s=>s.done&&s.success!==false&&Number(s.reps)>=Number(s.targetReps||s.reps))&&session.sets.some(s=>s.exercise===session.lift&&s.done)};
        const error=P.validateRecord(record);if(error)throw new Error(error);
        data.history.unshift(record);data.session=null;this.save(data);return record;
      }
    };
  }
  const api={KEY,empty,validate,createStore};if(typeof module!=='undefined')module.exports=api;else globalThis.MuscleStore=api;
})();
