const C=require('./catalog'),M=require('./media-manifest');
module.exports=function(group){return {
 data:{exercise:null,phase:0,phases:[],src:'',error:''},
 onLoad(options){
  const exercise=C.byId(options.id);
  if(!exercise||exercise.group!==group){this.setData({error:'动作不属于当前分包'});return;}
  const media=M[exercise.id];
  this.setData({exercise,phases:exercise.media.phases,src:media?.status==='reviewed'?'assets/'+exercise.id+'.jpg':'',error:media?.status==='reviewed'?'':'教学图尚待姿势审核，不展示旧简图。'});
 },
 previous(){this.setData({phase:(this.data.phase-1+this.data.phases.length)%this.data.phases.length});},
 next(){this.setData({phase:(this.data.phase+1)%this.data.phases.length});},
 zoom(){if(this.data.src)wx.previewImage({urls:['/media-'+group+'/'+this.data.src]});},
 imageError(){this.setData({error:'教学图加载失败，请重新打开',src:''});}
};};
