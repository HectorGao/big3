const anatomy=require('../../lib/anatomy');
Component({
  properties:{side:{type:String,value:'front'},selected:{type:Array,value:[]},height:{type:Number,value:640}},
  observers:{'side, selected':function(){this.renderMap();}},
  lifetimes:{ready(){this.createSelectorQuery().select('#anatomy').fields({node:true,size:true}).exec(res=>{if(!res[0])return;const {node,width,height}=res[0];this.canvas=node;this.ctx=node.getContext('2d');this.width=width;this.height=height;const ratio=wx.getWindowInfo().pixelRatio;node.width=width*ratio;node.height=height*ratio;this.ctx.scale(ratio,ratio);this.renderMap();});}},
  methods:{renderMap(){if(this.ctx)anatomy.draw(this.ctx,this.width,this.height,this.data.side,this.data.selected);},select(e){if(!this.ctx||!e.changedTouches[0])return;const t=e.changedTouches[0];const ratio=this.canvas.width/this.width;this.ctx.save();this.ctx.setTransform(1,0,0,1,0,0);const id=anatomy.hit(this.ctx,t.x,t.y,this.width,this.height,this.data.side);this.ctx.restore();if(id)this.triggerEvent('pick',{id});}}
});
