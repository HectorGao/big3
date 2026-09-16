const K=require('../../lib/coach'),P=require('../../lib/planner'),C=require('../../lib/catalog');
Page({
 data:{report:null,detail:null,error:'',muscles:C.muscles,feedback:null,maxTesting:false},
 onShow(){this.refresh();},
 refresh(){try{const d=getApp().store.load();const report=K.overview(d);report.schedule=report.schedule.map(p=>({...p,name:p.lift?C.lifts.find(l=>l.id===p.lift).name:p.label}));report.trends=report.trends.map(t=>({...t,weeks:t.weeks.map(w=>({...w,height:w.volume?Math.max(3,w.volume/Math.max(...t.weeks.map(x=>x.volume),1)*100):0}))}));this.setData({report,maxTesting:d.settings.maxTesting,error:''});}catch(e){this.setData({error:e.message});}},
 open(e){this.setData({detail:this.data.report.schedule.find(p=>p.date===e.currentTarget.dataset.date)});},
 close(){this.setData({detail:null});},noop(){},
 train(){if(this.data.detail?.lift)getApp().globalData.selectedLift=this.data.detail.lift;wx.switchTab({url:'/pages/today/today'});},
 skip(){this.adjust('skip');},
 defer(e){this.adjust('defer',e.detail.value);},
 adjust(kind,to){try{const p=this.data.detail;getApp().store.event({id:p.planId||p.date+':'+p.lift,date:p.date,lift:p.lift,kind,...to?{to}:{}});this.setData({detail:null});this.refresh();}catch(e){this.setData({error:e.message});}},
 feedback(){const d=getApp().store.load(),f=K.feedback(d,P.dateKey())||{date:P.dateKey(),fatigue:2,pain:false,soreness:{}};this.setData({feedback:f,sorenessRows:C.muscles.map(m=>({...m,value:f.soreness[m.id]||0}))});},
 fatigue(e){this.setData({'feedback.fatigue':Number(e.detail.value)});},
 pain(e){this.setData({'feedback.pain':e.detail.value});},
 soreness(e){this.setData({['feedback.soreness.'+e.currentTarget.dataset.id]:Number(e.detail.value)});},
 saveFeedback(){try{getApp().store.feedback(this.data.feedback);this.setData({feedback:null});this.refresh();}catch(e){this.setData({error:e.message});}},
 testing(e){try{const d=getApp().store.load();d.settings.maxTesting=e.detail.value;getApp().store.save(d);this.refresh();}catch(e){this.setData({error:e.message});}}
});
