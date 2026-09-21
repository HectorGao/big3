(function(){
  // Original reference-inspired surface illustration. Deep muscles are named as regions, not exposed anatomy.
  const front=[
    ['shoulders','M 122 113 Q 102 116 91 141 L 111 151 Q 128 139 140 127 Z',true],
    ['chest','M 158 127 Q 142 113 128 128 L 113 155 Q 132 172 158 155 Z',true],
    ['biceps','M 105 151 Q 88 148 83 168 L 79 191 Q 94 201 105 174 L 112 160 Z',true],
    ['core','M 157 160 Q 148 159 145 170 L 144 188 L 157 188 Z',true],
    ['core','M 144 193 L 157 193 L 157 211 L 143 210 Z',true],
    ['core','M 143 215 L 157 216 L 157 235 L 144 232 Z',true],
    ['core','M 144 237 L 157 239 L 157 263 Q 145 255 144 237 Z',true],
    ['core','M 113 169 Q 122 181 132 181 L 136 235 L 122 239 Q 128 210 113 169 Z',true],
    ['quads','M 122 249 Q 101 277 110 337 L 117 376 Q 127 385 132 367 Q 139 386 145 362 L 156 291 L 143 265 Z',true]
  ];
  const back=[
    ['shoulders','M 123 112 Q 103 117 93 140 Q 109 145 131 129 L 140 122 Z',true],
    ['upperback','M 143 105 L 125 114 L 141 132 L 157 181 L 159 185 L 159 109 Z',true],
    ['back','M 135 137 L 117 148 L 121 189 Q 126 209 119 239 L 136 232 L 146 204 L 152 183 Z',true],
    ['lowerback','M 154 187 Q 143 212 141 234 L 145 248 L 158 249 L 158 202 Z',true],
    ['triceps','M 106 150 Q 90 149 82 177 L 79 194 L 86 192 L 89 203 Q 106 187 112 159 Z',true],
    ['glutes','M 138 246 Q 113 246 112 272 Q 112 292 136 294 Q 152 295 158 281 L 157 255 Z',true],
    ['hamstrings','M 111 294 Q 107 333 116 371 Q 124 385 130 368 Q 132 387 141 369 L 155 302 Z',true],
    ['calves','M 116 400 Q 103 419 112 448 Q 118 454 124 442 Q 132 460 138 441 L 140 402 Q 129 410 116 400 Z',true]
  ];
  const contours={
    front:[
      'M 143 88 L 142 107 Q 132 111 117 115 Q 99 119 90 140 L 75 174 L 58 206 L 43 242 L 39 263 L 33 283 L 34 297 L 38 295 L 40 281 L 44 276 L 42 297 L 47 293 L 51 273 L 50 259 L 57 248 L 78 223 L 95 199 L 109 174 L 122 210 L 121 240 Q 105 268 106 309 Q 107 348 116 382 L 111 408 Q 105 427 111 458 L 116 505 L 111 535 L 99 548 Q 95 555 102 559 L 113 562 L 122 558 L 128 548 L 132 545 L 133 523 L 131 500 L 139 465 L 142 435 L 138 406 L 144 383 L 154 327 L 160 301',
      'M 139 49 Q 136 24 157 22 Q 182 22 183 45 L 183 60 Q 190 57 184 74 L 179 78 Q 173 94 160 97 Q 146 95 140 79 L 136 75 Q 131 60 138 62 Z'
    ],
    back:[
      'M 142 87 L 141 108 Q 125 111 114 117 Q 100 123 92 141 L 77 175 L 62 207 L 46 243 L 43 260 L 36 284 L 39 298 L 44 302 L 42 285 L 47 282 L 49 297 L 53 292 L 55 271 L 51 256 L 61 246 L 81 222 L 98 199 L 110 173 L 121 207 L 119 240 Q 109 251 108 280 Q 101 327 113 377 L 114 392 L 111 407 Q 101 427 112 461 L 117 503 L 116 536 L 105 542 Q 99 544 98 549 L 115 553 Q 127 562 135 553 L 137 540 L 134 514 L 135 482 L 141 447 L 140 414 L 137 394 L 142 377 L 155 317 L 160 294',
      'M 138 48 Q 136 22 158 21 Q 184 21 185 48 L 182 70 L 176 82 L 176 92 Q 164 83 158 85 L 143 94 L 143 82 Q 136 74 136 62 Z'
    ]
  };
  function path(ctx,s,mirror=false){
    const t=s.split(/\s+/);let i=0;const x=n=>mirror?320-Number(n):Number(n);
    ctx.beginPath();while(i<t.length){const c=t[i++];if(c==='M'||c==='L')ctx[c==='M'?'moveTo':'lineTo'](x(t[i++]),Number(t[i++]));else if(c==='Q')ctx.quadraticCurveTo(x(t[i++]),Number(t[i++]),x(t[i++]),Number(t[i++]));else if(c==='Z')ctx.closePath();}
  }
  function draw(ctx,width,height,side='front',selected=[],heat={}){
    ctx.clearRect(0,0,width,height);ctx.save();const scale=Math.min(width/320,height/620);ctx.translate((width-320*scale)/2,(height-620*scale)/2);ctx.scale(scale,scale);
    ctx.lineWidth=1.35;ctx.lineJoin='round';ctx.strokeStyle='#51506f';ctx.fillStyle='#f8f8fa';
    contours[side].forEach((s,i)=>{path(ctx,s);if(i===1)ctx.fill();ctx.stroke();if(i===0){path(ctx,s,true);ctx.stroke();}});
    for(const [id,s,mirror] of side==='back'?back:front)for(const m of mirror?[false,true]:[false]){path(ctx,s,m);ctx.fillStyle=heat[id]>0?['#fbdde7','#f6b3ca','#ee7aa7','#d9407b'][Math.min(3,Math.floor((heat[id]-1)/3))]:selected.includes(id)?'#f64f86':'#ebebed';ctx.fill();ctx.stroke();}
    ctx.strokeStyle='#51506f';ctx.lineWidth=1.2;
    if(side==='front'){
      path(ctx,'M 140 53 L 141 40 Q 159 47 178 38 L 181 54 M 142 108 Q 152 110 160 119 Q 168 110 178 108 M 160 165 L 160 262 M 123 241 Q 144 260 160 283 Q 176 260 197 241');ctx.stroke();
      for(const m of [false,true]){path(ctx,'M 116 386 Q 130 403 143 385 M 119 405 Q 128 418 138 406 M 76 195 Q 69 214 57 239 M 111 452 L 123 496 L 125 533',m);ctx.stroke();}
    }else{
      path(ctx,'M 144 108 L 176 108 M 140 127 Q 160 123 180 127 M 160 184 L 160 248 M 160 259 L 160 292');ctx.stroke();
      for(const m of [false,true]){path(ctx,'M 114 383 Q 127 398 140 383 M 117 460 Q 128 477 129 515 M 118 533 Q 126 539 135 534',m);ctx.stroke();}
    }
    ctx.fillStyle='#69677b';ctx.textAlign='center';ctx.font='13px sans-serif';ctx.fillText(side==='front'?'正面 · ANTERIOR':'背面 · POSTERIOR',160,598);
    ctx.restore();
  }
  function hit(ctx,x,y,width,height,side='front'){
    const scale=Math.min(width/320,height/620),px=(x-(width-320*scale)/2)/scale,py=(y-(height-620*scale)/2)/scale;
    for(const [id,s,mirror] of side==='back'?back:front)for(const m of mirror?[false,true]:[false]){path(ctx,s,m);if(ctx.isPointInPath(px,py))return id;}return null;
  }
  const api={draw,hit,regions:{front,back},contours};if(typeof module!=='undefined')module.exports=api;else globalThis.MuscleAnatomy=api;
})();
