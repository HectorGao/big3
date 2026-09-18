const C=require('../../lib/catalog');
const P=require('../../lib/planner');
const S=require('../../lib/science');
const K=require('../../lib/coach');
Page({
 data:{selectedDate:P.dateKey(),freeMode:'',modeIndex:0,modeLabels:['按规划','技术日','容量日','强度日','恢复日','冲刺日'],modeValues:['','technique','volume','intensity','recovery','test'],lifts:C.lifts,lift:'squat',selected:['quads','glutes','core'],side:'front',plan:null,session:null,showSession:true,straightSets:S.straightSets,fatigueLevels:S.fatigueLevels,readiness:{fatigue:2,pain:false},error:'',detail:null,remaining:0,upcoming:[],rirOptions:['未记录','0 · 无余力','1 · 还能做 1 次','2 · 还能做 2 次','3 · 还能做 3 次','4 · 还能做 4 次','5 · 至少还能做 5 次']},
 onShow(){const chosen=getApp().globalData.selectedDate;if(chosen){this.setData({selectedDate:chosen,freeMode:'',modeIndex:0});getApp().globalData.selectedDate=null;}const lift=getApp().globalData.selectedLift;if(lift){this.setData({lift,showSession:false});getApp().globalData.selectedLift=null;}this.refresh();clearInterval(this.timer);this.timer=setInterval(()=>this.tick(),1000);},
 chooseDate(e){this.setData({selectedDate:e.detail.value,freeMode:'',modeIndex:0});this.refresh();},
 chooseToday(){this.setData({selectedDate:P.dateKey(),freeMode:'',modeIndex:0});this.refresh();},
 chooseMode(e){const index=Number(e.detail.value);this.setData({freeMode:this.data.modeValues[index],modeIndex:index});this.refresh();},
 onHide(){clearInterval(this.timer);},onUnload(){clearInterval(this.timer);},
 refresh(){try{
  const d=getApp().store.load(),active=d.session&&this.data.showSession,viewDate=active?d.session.date:this.data.selectedDate||P.dateKey();
  const lift=active?d.session.lift:this.data.lift,item=C.lifts.find(l=>l.id===lift);
  const readiness=K.feedback(d,viewDate)||{fatigue:2,pain:false,soreness:{}};
  const plan=K.prescription(d,lift,viewDate,readiness,{mode:this.data.freeMode||undefined});
  this.setData({lift,readiness,selected:item.muscles,side:lift==='deadlift'?'back':'front',session:d.session,plan,testStatus:K.testStatus(d,lift,viewDate,readiness),upcoming:K.rolling(d,viewDate).filter(p=>p.exercises.length).slice(0,5).map(p=>({...p,name:C.lifts.find(l=>l.id===p.lift).name+' · '+p.label})),error:'',date:P.dateKey(),viewDate,sessionLabel:active?K.labels[d.session.mode]:'',sessionMeasure:active&&d.session.sets.some(s=>s.unit==='秒')?'完成量':'次数'});this.tick();
 }catch(e){this.setData({error:e.message});}},
 changeLift(e){this.setData({lift:e.currentTarget.dataset.id,showSession:false});this.refresh();},
 resume(){if(this.data.session){this.setData({showSession:true,lift:this.data.session.lift});this.refresh();}},
 fatigue(e){this.setData({'readiness.fatigue':Number(e.detail.value)});this.saveReadiness();},
 pain(e){this.setData({'readiness.pain':e.detail.value});this.saveReadiness();},
 saveReadiness(){try{if(this.data.selectedDate>P.dateKey())throw Error('未来状态尚未发生，请在实际训练当天填写');getApp().store.feedback({...this.data.readiness,date:this.data.selectedDate,soreness:this.data.readiness.soreness||{}});this.refresh();}catch(e){this.setData({error:e.message});}},
 profile(){wx.switchTab({url:'/pages/profile/profile'});},
 atlas(e){getApp().globalData.selectedMuscle=e&&e.detail&&e.detail.id||C.lifts.find(l=>l.id===this.data.lift).muscle;wx.switchTab({url:'/pages/atlas/atlas'});},
 start(){try{const d=getApp().store.load();const fresh=K.prescription(d,this.data.lift,this.data.selectedDate,this.data.readiness,{mode:this.data.freeMode||undefined});if(d.session)throw new Error('已有进行中的训练');if(fresh.exercises.length&&fresh.mode===this.data.plan.mode&&fresh.date===this.data.plan.date)fresh.exercises=this.data.plan.exercises;if(!fresh.canStart)throw Error('只能在实际训练日期重新评估后开始');const save=()=>{d.session=K.session(fresh);if(fresh.mode==='test')d.session.protectionConfirmed=true;getApp().store.save(d);this.setData({showSession:true});this.refresh();};if(fresh.mode==='test')wx.showModal({title:'确认测试保护',content:'已有保护者或安全杆，无疼痛，且热身动作稳定？不满足请取消。',success:r=>{if(r.confirm){try{save();}catch(e){this.setData({error:e.message});}}}});else save();}catch(e){this.setData({error:e.message});}},
 editPlan(e){const {index,field}=e.currentTarget.dataset;const plan=JSON.parse(JSON.stringify(this.data.plan));const ex=plan.exercises[index];plan.exercises[index]=S.reviseSet({...ex,targetRir:ex.rir},field,e.detail.value);this.setData({plan});},
 editSet(e){const {index,field}=e.currentTarget.dataset;const session=JSON.parse(JSON.stringify(this.data.session));session.sets[index]=S.reviseSet(session.sets[index],field,e.detail.value);this.setData({session});},
 setRir(e){const session=JSON.parse(JSON.stringify(this.data.session));const value=Number(e.detail.value);session.sets[e.currentTarget.dataset.index].rir=value===0?null:value-1;try{this.persist(session);}catch(error){this.setData({error:error.message});}},
 persist(session){getApp().store.updateSession(session);this.setData({session,error:''});},
 toggleSet(e){try{const session=JSON.parse(JSON.stringify(this.data.session));if(session.date!==P.dateKey())throw new Error('这份训练草稿已跨日，请先保存已完成组或放弃，再重新评估今天的计划。');const row=session.sets[e.currentTarget.dataset.index];if(!row.done){if(row.calibrationRequired)throw Error('请先确认试重，不能将未知重量保存为工作组');const check={...session,completed:false,sets:[{...row,done:true}]};const error=P.validateRecord(check);if(error)throw new Error('先填写本组实际重量与次数。自重动作填 0 kg。');}row.done=!row.done;session.deadline=row.done?Date.now()+row.rest*1000:0;this.persist(session);this.tick();}catch(e){this.setData({error:e.message});}},
 setRpe(e){try{const session={...this.data.session,rpe:Number(e.detail.value)};this.persist(session);}catch(e){this.setData({error:e.message});}},
 tick(){const deadline=this.data.session&&this.data.session.deadline;const remaining=deadline?Math.max(0,Math.ceil((deadline-Date.now())/1000)):0;this.setData({remaining,timerText:Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0')});},
 skipTimer(){try{this.persist({...this.data.session,deadline:0});this.tick();}catch(e){this.setData({error:e.message});}},
 finish(){wx.showModal({title:'保存本次训练？',content:'只保存已勾选的实际组。实际日期：'+(this.data.session.actualDate||P.dateKey()),success:res=>{if(!res.confirm)return;try{getApp().store.finish(this.data.session,this.data.session.actualDate||P.dateKey());this.refresh();wx.showToast({title:'已重新规划两周'});}catch(e){this.setData({error:e.message});}}});},
 actualDate(e){try{this.persist({...this.data.session,actualDate:e.detail.value});}catch(error){this.setData({error:error.message});}},
 requestTest(){try{const d=getApp().store.load();const st=K.testStatus(d,this.data.lift);if(!st.eligible)throw Error(st.reason);getApp().store.event({id:'test:'+Date.now(),kind:'test',date:P.dateKey(),lift:this.data.lift});this.refresh();}catch(e){this.setData({error:e.message});}},
 nextAttempt(){try{this.persist(K.nextAttempt(this.data.session,getApp().store.load().profile));}catch(e){this.setData({error:e.message});}},
 stopTest(){try{this.persist({...this.data.session,stopTest:true});}catch(e){this.setData({error:e.message});}},
 flag(e){try{const s=JSON.parse(JSON.stringify(this.data.session)),row=s.sets[e.currentTarget.dataset.index];row[e.currentTarget.dataset.field]=e.detail.value;if(s.mode==='test'&&!e.detail.value)s.stopTest=true;this.persist(s);}catch(error){this.setData({error:error.message});}},
 manual(){this.setData({manualEntry:{date:P.dateKey(),weight:0,reps:5},manualExercises:C.exercises,manualIndex:0});},
 manualField(e){this.setData({['manualEntry.'+e.currentTarget.dataset.field]:e.detail.value});},
 manualExercise(e){this.setData({manualIndex:Number(e.detail.value)});},
 saveManual(){try{const d=getApp().store.load(),m=this.data.manualEntry;d.history.unshift({id:'manual:'+Date.now(),date:m.date,lift:this.data.lift,mode:'manual',completed:false,rpe:7,sets:[{exercise:C.exercises[this.data.manualIndex].id,unit:C.exercises[this.data.manualIndex].unit,weightUnit:C.exercises[this.data.manualIndex].weightUnit,loadConvention:C.exercises[this.data.manualIndex].loadConvention,weight:Number(m.weight),reps:Number(m.reps),done:true,rir:null}]});getApp().store.save(d);this.setData({manualEntry:null});this.refresh();}catch(e){this.setData({error:e.message});}},
 discard(){wx.showModal({title:'放弃本次训练？',content:'本次尚未保存的组记录将被移除，历史训练不受影响。',success:r=>{if(r.confirm){try{const d=getApp().store.load();d.session=null;getApp().store.save(d);this.refresh();}catch(e){this.setData({error:e.message});}}}});},
 showDetail(e){const ex=C.byId(e.currentTarget.dataset.id);wx.navigateTo({url:'/media-'+ex.group+'/detail?id='+ex.id});},closeDetail(){this.setData({detail:null});},noop(){},
 replace(e){const index=Number(e.currentTarget.dataset.index);const ex=this.data.plan.exercises[index];const options=ex.alternatives.map(C.byId);if(!options.length)return;wx.showActionSheet({itemList:options.map(e=>e.name),success:r=>{try{const replacement=options[r.tapIndex];const plan=JSON.parse(JSON.stringify(this.data.plan));const d=getApp().store.load();const history=d.history.filter(r=>!P.validateRecord(r)&&r.date<=P.dateKey()).sort((a,b)=>b.date.localeCompare(a.date));plan.exercises[index]=K.replaceExercise(d,plan,ex.id,replacement.id);this.setData({plan});}catch(error){this.setData({error:error.message});}}});},
 calibrate(e){const row=this.data.session.sets.find(r=>r.exercise===e.currentTarget.dataset.id&&!r.done);if(row)this.setData({trial:{exercise:row.exercise,weight:'',reps:row.targetReps,rir:row.targetRir??3,quality:false,increment:getApp().store.load().profile.exerciseIncrements?.[row.exercise]||(C.byId(row.exercise).equipment==='哑铃'?0.5:getApp().store.load().profile.increment),machineId:row.machineId||'default'},trialExercise:C.byId(row.exercise)});},
 trialField(e){this.setData({['trial.'+e.currentTarget.dataset.field]:e.detail.value});},
 closeTrial(){this.setData({trial:null});},
 saveTrial(){try{const result=getApp().store.calibrate(this.data.session.id,this.data.trial.exercise,this.data.trial);this.setData({trial:null});this.refresh();wx.showModal({title:result.trial.accepted?'试重已确认':'试重建议',content:result.trial.advice,showCancel:false});}catch(e){this.setData({error:e.message});}},
 skipPlan(){try{const p=this.data.plan;if(!p.skipAllowed)throw Error('该日不可直接跳过');getApp().store.event({id:p.planId,kind:'skip',date:p.date,lift:p.lift});this.refresh();wx.showToast({title:'已跳过，不计负荷'});}catch(e){this.setData({error:e.message});}}

});
