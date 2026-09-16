const C=require('../../lib/catalog');
const P=require('../../lib/planner');
const S=require('../../lib/science');
const weekdays=['日','一','二','三','四','五','六'];
Page({
 data:{profile:{age:'',weight:'',experience:'beginner',goal:'strength',days:[1,3,5],increment:2.5,pb:{}},pbRows:[],days:[],increments:[0.5,1,1.25,2.5,5],incrementIndex:3,error:'',backup:'',showBackup:false,today:P.dateKey(),saved:false},
 onShow(){try{const d=getApp().store.load();const profile=d.profile||this.data.profile;this.setData({profile,pbRows:C.lifts.map(l=>({...l,weight:profile.pb[l.id]?.weight||'',reps:profile.pb[l.id]?.reps||1,date:profile.pb[l.id]?.date||P.dateKey()})),incrementIndex:this.data.increments.indexOf(Number(profile.increment)),error:''});this.days();}catch(e){this.setData({error:e.message});}},
 days(){this.setData({days:weekdays.map((name,id)=>({id,name,selected:this.data.profile.days.includes(id)}))});this.estimates();},
 estimates(){this.setData({pbRows:this.data.pbRows.map(r=>{const estimate=S.estimatePB(r.weight,r.reps,this.data.profile.weight);return {...r,estimate,trainingMax:S.trainingMax(this.data.profile,estimate)};})});},
 science(){wx.showModal({title:'计算依据',content:'1RM：Epley 与 Brzycki，适用 1–10 次接近极限记录。两公式差异不是置信区间。训练基准取低值的 90%，新手或 65 岁以上取 85%，是保守默认值，不是年龄回归模型。体重不对 PB 加成。辅助动作先试重，再用同动作记录校准。参考 ACSM 2009/2026、Schoenfeld 2017、Zourdos 2016。',showCancel:false});},
 input(e){this.setData({['profile.'+e.currentTarget.dataset.field]:e.detail.value,saved:false});this.estimates();},
 choice(e){this.setData({['profile.'+e.currentTarget.dataset.field]:e.currentTarget.dataset.value,saved:false});this.estimates();},
 day(e){const id=Number(e.currentTarget.dataset.id);const current=this.data.profile.days;this.setData({'profile.days':current.includes(id)?current.filter(d=>d!==id):[...current,id],saved:false});this.days();},
 increment(e){const index=Number(e.detail.value);this.setData({incrementIndex:index,'profile.increment':this.data.increments[index],saved:false});},
 pb(e){const {index,field}=e.currentTarget.dataset;this.setData({['pbRows['+index+'].'+field]:e.detail.value,saved:false});this.estimates();},
 save(){try{const pb={};for(const row of this.data.pbRows)if(String(row.weight).trim()!=='')pb[row.id]={weight:Number(row.weight),reps:Number(row.reps),date:row.date};const profile={...this.data.profile,age:Number(this.data.profile.age),weight:Number(this.data.profile.weight),pb};const error=P.validateProfile(profile);if(error)throw Error(error);const data=getApp().store.load();data.profile=profile;getApp().store.save(data);this.setData({profile,error:'',saved:true});wx.showToast({title:'资料已保存'});}catch(e){this.setData({error:e.message,saved:false});}},
 export(){try{this.setData({backup:getApp().store.exportRaw(),showBackup:true,error:''});}catch(e){this.setData({error:e.message});}},
 backupInput(e){this.setData({backup:e.detail.value});},
 copy(){wx.setClipboardData({data:this.data.backup,fail:()=>this.setData({error:'复制失败，请重试。'})});},
 import(){wx.showModal({title:'从备份恢复？',content:'将用此备份替换本机资料与历史，并清除进行中的训练。请先导出当前数据留存。',success:r=>{if(r.confirm){try{getApp().store.importRaw(this.data.backup);this.onShow();this.setData({showBackup:false});wx.showToast({title:'已恢复'});}catch(e){this.setData({error:'恢复失败：'+e.message});}}}});},
 backupPanel(){this.setData({showBackup:!this.data.showBackup});}
});
