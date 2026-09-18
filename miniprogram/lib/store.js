(function () {
  const P=typeof module!=='undefined'?require('./planner'):globalThis.MusclePlanner;
  const KEY='three-lift-v1';
  const C=typeof module!=='undefined'?require('./catalog'):globalThis.MuscleCatalog;
  const migrate=d=>({...empty(),...d,version:3,calibrations:d.calibrations||[]});
  function empty(){return {version:3,calibrations:[],profile:null,history:[],session:null,feedback:[],events:[],settings:{maxTesting:false}};}
  function validate(data) {
    if(!data||![1,2,3].includes(data.version)||!Array.isArray(data.history)||data.history.length>10000) throw new Error('备份格式或版本不支持');
    if(data.version>=2){
      if(!Array.isArray(data.feedback)||!Array.isArray(data.events)||data.feedback.length>10000||data.events.length>10000||typeof data.settings?.maxTesting!=='boolean')throw Error('规划数据格式无效');
      for(const f of data.feedback)if(!P.validDate(f.date)||f.date>P.dateKey()||!Number.isInteger(f.fatigue)||f.fatigue<1||f.fatigue>5||typeof f.pain!=='boolean'||!f.soreness||Object.values(f.soreness).some(v=>!Number.isInteger(v)||v<0||v>3))throw Error('恢复反馈无效');
      for(const e of data.events)if(typeof e.id!=='string'||!e.id||!['skip','defer','test'].includes(e.kind)||!P.validDate(e.date)||!['squat','bench','deadlift'].includes(e.lift)||e.kind==='defer'&&(!P.validDate(e.to)||e.to<=e.date))throw Error('计划调整无效');
    }
    if(data.version===3){
      if(!Array.isArray(data.calibrations)||data.calibrations.length>10000)throw Error('试重记录无效');
      for(const t of data.calibrations)if(!t.id||!C.byId(t.exercise)||!P.validDate(t.date)||t.date>P.dateKey()||!Number.isFinite(t.weight)||t.weight<0||t.weight>600||!Number.isInteger(t.reps)||t.reps<1||t.reps>300||(C.byId(t.exercise).unit==='秒'?t.rir!==null&&t.rir!==undefined&&!Number.isInteger(t.rir):!Number.isInteger(t.rir)||t.rir<0||t.rir>5)||typeof t.accepted!=='boolean'||typeof t.quality!=='boolean')throw Error('试重输入无效');
      if(new Set(data.calibrations.map(t=>t.id)).size!==data.calibrations.length)throw Error('试重重复');
    }
    if(data.profile!==null) {const error=P.validateProfile(data.profile);if(error)throw new Error(error);}
    if(data.history.some(r=>P.validateRecord(r))) throw new Error('备份中存在无效训练记录');
    if(new Set(data.history.map(r=>r.id)).size!==data.history.length) throw new Error('备份包含重复记录');
    if(data.session!==null && data.session!==undefined) {
      const s=data.session;
      if(!s||typeof s.id!=='string'||!P.validDate(s.date)||!['squat','bench','deadlift'].includes(s.lift)||!['volume','intensity','recovery','technique','deload','test','assessment','manual'].includes(s.mode)||!Array.isArray(s.sets)||!s.sets.length||s.sets.length>100) throw new Error('进行中的训练数据无效');
      for(const row of s.sets) {
        const probe={...s,completed:false,rpe:7,sets:[{...row,weight:row.weight===''||row.weight===null?0:row.weight,reps:row.reps===''?1:row.reps,done:true}]};
        probe.sets[0].calibrationRequired=false;
        if(P.validateRecord(probe)||typeof row.done!=='boolean'||row.done&&(row.weight===''||row.weight===null||row.calibrationRequired))throw new Error('进行中的训练组数据无效');
      }
      if(!Number.isFinite(s.deadline)||s.deadline<0||!Number.isFinite(Number(s.rpe))||Number(s.rpe)<1||Number(s.rpe)>10)throw new Error('训练计时或用力程度无效');
    }
    return data;
  }
  function createStore(driver) {
    return {
      load(){const raw=driver.getStorageSync(KEY);if(raw===''||raw===undefined||raw===null)return empty();try{const d=validate(typeof raw==='string'?JSON.parse(raw):raw);return migrate(d);}catch(e){throw new Error('本地数据无法读取，请先导出原始备份，未覆盖原数据。'+e.message);}},
      save(data){validate(data);const old=driver.getStorageSync(KEY);if(old){const prior=typeof old==='string'?JSON.parse(old):old;if(prior.version<3){const backup=KEY+(prior.version===1?'-migration-backup':'-v2-backup');if(!driver.getStorageSync(backup))driver.setStorageSync(backup,typeof old==='string'?old:JSON.stringify(old));}}driver.setStorageSync(KEY,JSON.stringify(migrate(data)));return data;},
      exportRaw(){const raw=driver.getStorageSync(KEY);return typeof raw==='string'?raw:JSON.stringify(raw||empty(),null,2);},
      importRaw(raw){if(typeof raw!=='string'||raw.length>5e6)throw new Error('备份应为不超过 5 MB 的 JSON 文件');const parsed=validate(JSON.parse(raw));const data=migrate(parsed);const previous=driver.getStorageSync(KEY);if(previous)driver.setStorageSync(KEY+'-import-backup',typeof previous==='string'?previous:JSON.stringify(previous));this.save(data);return data;},
      feedback(value){const d=this.load();d.feedback=[value,...d.feedback.filter(f=>f.date!==value.date)];this.save(d);},
      event(value){const d=this.load();if(d.events.some(e=>e.id===value.id))throw Error('该调整已经保存');d.events.push(value);this.save(d);},
      updateSession(session){const data=this.load();if(!data.session||data.session.id!==session.id)throw new Error('当前训练已经变化，请刷新后重试');data.session=session;this.save(data);return session;},
      calibrate(sessionId,exercise,input){
        const d=this.load(),s=d.session,e=C.byId(exercise);
        if(!s||s.id!==sessionId||!e)throw Error('训练已变化，请刷新后重试');
        if(s.date!==P.dateKey())throw Error('跨日草稿请先保存并重新评估');
        const feedback=d.feedback.find(f=>f.date===P.dateKey());
        if(s.readiness?.pain||s.readiness?.fatigue>=5||feedback?.pain||feedback?.fatigue>=5)throw Error('当前状态不适合试重');
        const row=s.sets.find(r=>r.exercise===exercise&&!r.done);
        if(!row)throw Error('没有待校准的工作组');
        const attempts=d.calibrations.filter(t=>t.exercise===exercise&&t.date===P.dateKey());
        if(attempts.length>=3)throw Error('当天最多三次试重；仍不合适时保留待校准，避免反复疲劳');
        if(attempts.some(t=>!t.quality||t.rir===0))throw Error('今天该动作已出现失控、疼痛或力竭，不再试重；请先恢复或接受现场指导');
        const timed=e.unit==='秒';
        if(input.weight===''||input.reps===''||input.weight==null||input.reps==null||!timed&&(input.rir===''||input.rir==null))throw Error('请填写实际重量、完成量和余力');
        const weight=Number(input.weight),reps=Number(input.reps),rir=timed?null:Number(input.rir),quality=input.quality===true;
        const increment=Number(input.increment??d.profile.exerciseIncrements?.[exercise]??(e.equipment==='哑铃'?0.5:d.profile.increment));
        if(!Number.isFinite(increment)||increment<0.25||increment>50)throw Error('最小加重档位应为 0.25–50 kg');
        const machineId=String(input.machineId||row.machineId||'default').trim();
        if(!machineId||machineId.length>80)throw Error('器械标识应为 1–80 个字符');
        if(!Number.isFinite(weight)||weight<0||weight>600||!Number.isInteger(reps)||reps<1||reps>300||!timed&&(!Number.isInteger(rir)||rir<0||rir>5))throw Error('试重数值无效');
        const target=row.targetRir??3,accepted=quality&&reps>=row.targetReps&&(timed||rir>=target&&rir<=Math.min(5,target+1));
        const trial={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),sessionId:s.id,exercise,date:P.dateKey(),weight,reps,rir,quality,accepted,increment,loadConvention:e.loadConvention,machineId,kind:'calibration'};
        const easy=quality&&reps>=row.targetReps&&rir>target+1;
        trial.advice=accepted?'已确认工作重量；只填写尚未完成组。':!quality||rir===0?'停止试重，先恢复或请教练检查动作。':easy?(e.loadConvention==='assistance'?'助力减少一档后再评估。':'负荷增加最小一档后再评估。'):(e.loadConvention==='assistance'?'增加助力后再评估。':'降低一个档位后再评估。');
        if(accepted)s.sets=s.sets.map(r=>r.exercise===exercise&&!r.done?{...r,weight,confirmedTargetWeight:weight,calibrationRequired:false,calibrationId:trial.id,loadConvention:e.loadConvention,machineId:trial.machineId,source:'当天确认试重',loadSource:'当天确认试重',done:false}:r);
        if(accepted){
          d.profile.exerciseIncrements={...d.profile.exerciseIncrements,[exercise]:increment};
          if(['machine-stack','assistance'].includes(e.loadConvention))d.profile.machineIds={...d.profile.machineIds,[exercise]:machineId};
        }
        d.calibrations.push(trial);this.save(d);return {session:s,trial};
      },
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
