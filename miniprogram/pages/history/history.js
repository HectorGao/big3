const C=require('../../lib/catalog');const P=require('../../lib/planner');
Page({data:{history:[],lifts:C.lifts,filter:'all',total:0,tonnage:0,error:'',detail:null},onShow(){this.refresh();},
 refresh(){try{const data=getApp().store.load();const history=data.history.filter(r=>this.data.filter==='all'||r.lift===this.data.filter).map(r=>({...r,name:C.lifts.find(l=>l.id===r.lift).name,label:P.modes[r.mode],count:r.sets.filter(s=>s.done).length,volume:Math.round(r.sets.filter(s=>s.done&&C.byId(s.exercise).unit!=='秒').reduce((sum,s)=>sum+Number(s.weight)*Number(s.reps),0))}));this.setData({history,total:data.history.length,tonnage:history.reduce((sum,r)=>sum+r.volume,0),error:''});}catch(e){this.setData({error:e.message});}},
 filter(e){this.setData({filter:e.currentTarget.dataset.id});this.refresh();},
 detail(e){this.setData({detail:this.data.history.find(r=>r.id===e.currentTarget.dataset.id)});},close(){this.setData({detail:null});},noop(){},
 remove(e){const id=e.currentTarget.dataset.id;wx.showModal({title:'删除这次记录？',content:'仅删除选中的这一次训练，此操作会影响后续训练阶段判断。',success:r=>{if(r.confirm){try{const d=getApp().store.load();d.history=d.history.filter(r=>r.id!==id);getApp().store.save(d);this.setData({detail:null});this.refresh();}catch(e){this.setData({error:e.message});}}}});},
 train(){wx.switchTab({url:'/pages/today/today'});}
});
