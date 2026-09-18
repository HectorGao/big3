const K=require('../../lib/coach'),P=require('../../lib/planner'),C=require('../../lib/catalog');
Page({
 data:{viewDate:P.dateKey(),today:P.dateKey(),report:null,detail:null,error:'',muscles:C.muscles,feedback:null,maxTesting:false},
 onShow(){this.refresh();},
 refresh(){try{const d=getApp().store.load();const report=K.overview(d,this.data.viewDate);report.schedule=report.schedule.map(p=>({...p,today:p.date===P.dateKey(),selected:p.date===this.data.viewDate,name:p.lift?C.lifts.find(l=>l.id===p.lift).name:p.label}));report.trends=report.trends.map(t=>({...t,weeks:t.weeks.map(w=>({...w,height:w.volume?Math.max(3,w.volume/Math.max(...t.weeks.map(x=>x.volume),1)*100):0}))}));this.setData({report,maxTesting:d.settings.maxTesting,error:''});}catch(e){this.setData({error:e.message});}},
 open(e){this.setData({detail:this.data.report.schedule.find(p=>p.date===e.currentTarget.dataset.date)});},
 chooseDate(e){this.setData({viewDate:e.detail.value});this.refresh();},
 preview(){getApp().globalData.selectedDate=this.data.detail.date;getApp().globalData.selectedLift=this.data.detail.lift;wx.switchTab({url:'/pages/today/today'});},
 close(){this.setData({detail:null});},noop(){},
 train(){getApp().globalData.selectedDate=P.dateKey();if(this.data.detail?.lift)getApp().globalData.selectedLift=this.data.detail.lift;wx.switchTab({url:'/pages/today/today'});},
 skip(){this.adjust('skip');},
 defer(e){this.adjust('defer',e.detail.value);},
 adjust(kind,to){try{const p=this.data.detail;getApp().store.event({id:p.planId||p.date+':'+p.lift,date:p.date,lift:p.lift,kind,...to?{to}:{}});this.setData({detail:null});this.refresh();}catch(e){this.setData({error:e.message});}},
 feedback(){if(this.data.viewDate>P.dateKey()){this.setData({error:'未来状态尚未发生，请在实际训练当天填写'});return;}const d=getApp().store.load(),f=K.feedback(d,this.data.viewDate)||{date:this.data.viewDate,fatigue:2,pain:false,soreness:{}};this.setData({feedback:f,sorenessRows:C.muscles.map(m=>({...m,value:f.soreness[m.id]||0}))});},
 fatigue(e){this.setData({'feedback.fatigue':Number(e.detail.value)});},
 pain(e){this.setData({'feedback.pain':e.detail.value});},
 soreness(e){this.setData({['feedback.soreness.'+e.currentTarget.dataset.id]:Number(e.detail.value)});},
 saveFeedback(){try{getApp().store.feedback(this.data.feedback);this.setData({feedback:null});this.refresh();}catch(e){this.setData({error:e.message});}},
 testing(e){try{const d=getApp().store.load();d.settings.maxTesting=e.detail.value;getApp().store.save(d);this.refresh();}catch(e){this.setData({error:e.message});}}
});
