(function(){
 const defaults=Object.freeze({topStyle:'ribbon',topSpeed:14,allowPersonalStyle:true,backgroundStyle:'glass',backgroundMotion:'diagonal',backgroundSpeed:8,backgroundColor:'#667085',backgroundOpacity:0.16,backgroundAngle:12,backgroundBlur:14});
 const enums={topStyle:['ribbon','diagonal','vertical','quiet'],backgroundStyle:['off','text','glass'],backgroundMotion:['diagonal','columns','horizontal']};
 const ranges={topSpeed:[0,40],backgroundSpeed:[0,24],backgroundOpacity:[0.04,0.35],backgroundAngle:[0,25],backgroundBlur:[0,24]};
 function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==Object.keys(defaults).length||Object.keys(input).some(k=>!Object.hasOwn(defaults,k)))throw Error('回声配置字段不完整或含未知字段');
  const result={};for(const key of Object.keys(defaults)){
   const value=input[key];if(enums[key]&&!enums[key].includes(value))throw Error(key+' 选项无效');
   if(ranges[key]&&(typeof value!=='number'||!Number.isFinite(value)||value<ranges[key][0]||value>ranges[key][1]))throw Error(key+' 超出允许范围');
   if(key==='allowPersonalStyle'&&typeof value!=='boolean')throw Error('用户样式权限无效');
   if(key==='backgroundColor'&&(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value)))throw Error('背景颜色需要六位十六进制色值');
   result[key]=key==='backgroundColor'?value.toLowerCase():value;
  }return result;
 }
 const api={defaults,enums,ranges,validate};if(typeof module!=='undefined')module.exports=api;else globalThis.MuscleEchoSettings=api;
})();
