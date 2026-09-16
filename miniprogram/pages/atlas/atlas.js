const C=require('../../lib/catalog');
Page({
 data:{side:'front',selected:['quads'],muscle:'quads',muscleName:'股四头肌',muscles:C.muscles,equipment:C.equipment,equipmentIndex:0,query:'',exercises:[],detail:null},
 onLoad(){this.filter();},
 onShow(){const id=getApp().globalData.selectedMuscle;if(id){getApp().globalData.selectedMuscle=null;this.pick({detail:{id}});}},
 filter(){const selectedEquipment=C.equipment[this.data.equipmentIndex];const query=this.data.query.trim().toLowerCase();this.setData({exercises:C.exercises.filter(e=>e.muscles.includes(this.data.muscle)&&(this.data.equipmentIndex===0||e.equipment===selectedEquipment)&&(!query||(e.name+' '+e.en).toLowerCase().includes(query)))});},
 pick(e){const id=e.detail.id||e.currentTarget.dataset.id;const muscle=C.muscles.find(m=>m.id===id);if(!muscle)return;this.setData({muscle:id,muscleName:muscle.name,selected:[id],side:muscle.side});this.filter();},
 side(e){const side=e.currentTarget.dataset.side;const selected=C.muscles.find(m=>m.id===this.data.muscle);if(selected.side!==side)this.pick({detail:{id:side==='back'?'upperback':'chest'}});else this.setData({side});},
 equipment(e){this.setData({equipmentIndex:Number(e.detail.value)});this.filter();},
 search(e){this.setData({query:e.detail.value});this.filter();},
 showDetail(e){this.setData({detail:C.byId(e.currentTarget.dataset.id)});},closeDetail(){this.setData({detail:null});},noop(){},
 train(){const muscle=C.muscles.find(m=>m.id===this.data.muscle);getApp().globalData.selectedLift=muscle.lift;wx.switchTab({url:'/pages/today/today'});}
});
