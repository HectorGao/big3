(function(){
 const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const easing='cubic-bezier(.2,.8,.2,1)',animations=new Map();
 let drag=null;
 const rows=()=>[...app.querySelectorAll('[data-exercise-id]')];
 function announce(message){let el=document.querySelector('#sort-status');if(!el){el=document.createElement('span');el.id='sort-status';el.className='sr-only';el.setAttribute('role','status');document.body.append(el);}el.textContent=message;}
 function stopAnimations(){for(const animation of animations.values())animation.cancel();animations.clear();}
 function layoutRect(el){const r=el.getBoundingClientRect(),t=getComputedStyle(el).transform;return {top:r.top-(t==='none'?0:new DOMMatrixReadOnly(t).m42),height:r.height};}
 // FLIP keeps each neighbour at its current visual position, then settles into its new slot.
 function rearrange(change){const before=new Map(rows().map(el=>[el,el.getBoundingClientRect().top]));stopAnimations();change();if(reduce())return;for(const el of rows()){if(el===drag?.row)continue;const dy=before.get(el)-el.getBoundingClientRect().top;if(!dy)continue;const a=el.animate([{transform:`translate3d(0,${dy}px,0)`},{transform:'translate3d(0,0,0)'}],{duration:280,easing});animations.set(el,a);a.onfinish=()=>{if(animations.get(el)===a)animations.delete(el);};}}
 function lift(d){
  d.active=true;d.rect=d.row.getBoundingClientRect();d.ghost=d.row.cloneNode(true);
  d.ghost.classList.add('drag-preview');d.ghost.removeAttribute('data-exercise-id');d.ghost.setAttribute('aria-hidden','true');d.ghost.inert=true;
  d.ghost.querySelectorAll('*').forEach(el=>{for(const a of [...el.attributes])if(a.name==='id'||a.name.startsWith('data-'))el.removeAttribute(a.name);if('disabled' in el)el.disabled=true;});
  Object.assign(d.ghost.style,{left:d.rect.left+'px',top:d.rect.top+'px',width:d.rect.width+'px',height:d.rect.height+'px'});
  document.body.append(d.ghost);d.row.classList.add('drag-source');d.handle.setAttribute('aria-pressed','true');document.body.classList.add('sorting-plan');
  announce('已提起'+C.byId(d.id).name);d.frame=requestAnimationFrame(frame);
 }
 function frame(now){
  const d=drag;if(!d?.active||d.ending)return;
  const dt=Math.min(32,now-(d.lastFrame||now));d.lastFrame=now;
  const bottom=innerHeight-(innerWidth<=700?68:0),edge=80;
  const scroll=d.y<edge?-Math.min(1,(edge-d.y)/edge):d.y>bottom-edge?Math.min(1,(d.y-bottom+edge)/edge):0;
  if(scroll)window.scrollBy(0,scroll*650*dt/1000);
  const dx=Math.max(Math.max(-24,8-d.rect.left),Math.min(Math.min(24,innerWidth-d.rect.right-8),d.x-d.startX)),dy=d.y-d.startY;
  d.ghost.style.transform=`translate3d(${dx}px,${dy}px,0) scale(${reduce()?1:1.012}) rotate(${reduce()?0:dx*.025}deg)`;
  const siblings=rows().filter(el=>el!==d.row),index=siblings.findIndex(el=>{const r=layoutRect(el);return d.y<r.top+Math.min(85,r.height*.4);}),next=index<0?null:siblings[index];
  const current=rows(),currentIndex=current.indexOf(d.row),desired=index<0?siblings.length:index;
  if(currentIndex!==desired){rearrange(()=>{if(next)next.before(d.row);else siblings.at(-1)?.after(d.row);});announce(C.byId(d.id).name+'，第 '+(desired+1)+' 个动作');}
  d.frame=requestAnimationFrame(frame);
 }
 function cleanup(d){cancelAnimationFrame(d.frame);d.ghost?.remove();d.row.classList.remove('drag-source');d.handle.removeAttribute('aria-pressed');document.body.classList.remove('sorting-plan');stopAnimations();if(d.capture.hasPointerCapture(d.pointer))d.capture.releasePointerCapture(d.pointer);}
 function cancel(){const d=drag;if(!d)return;drag=null;d.landing?.cancel();if(d.active&&d.row.isConnected){stopAnimations();for(const el of d.original)d.anchor.before(el);}cleanup(d);d.anchor?.remove();}
 async function drop(event){
  const d=drag;if(!d||event.pointerId!==d.pointer||d.ending)return;
  if(!d.active){cancel();return;}cancelAnimationFrame(d.frame);d.x=event.clientX;d.y=event.clientY;frame(performance.now());d.ending=true;cancelAnimationFrame(d.frame);
  const target=d.row.getBoundingClientRect();
  if(!reduce()){
   d.landing=d.ghost.animate([{transform:d.ghost.style.transform},{transform:`translate3d(${target.left-d.rect.left}px,${target.top-d.rect.top}px,0) scale(1) rotate(0deg)`}],{duration:230,easing,fill:'forwards'});
   try{await d.landing.finished;}catch{return;}
  }
  if(drag!==d)return;const order=rows().map(el=>el.dataset.exerciseId);drag=null;cleanup(d);d.anchor.remove();routineState.order=order;
  const scroll=scrollY;render();window.scrollTo(0,scroll);app.querySelector(`[data-drag="${d.id}"]`)?.focus({preventScroll:true});announce(C.byId(d.id).name+'已移至第 '+(order.indexOf(d.id)+1)+' 位');
 }
 document.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-drag]');if(!handle||event.button!==0||!event.isPrimary||drag)return;
  event.preventDefault();app.querySelectorAll('[data-fold-key]').forEach(row=>row.getAnimations().forEach(a=>a.finish()));handle.focus({preventScroll:true});document.body.setPointerCapture(event.pointerId);
  const original=rows(),anchor=document.createComment('sort-end');original.at(-1).after(anchor);
  drag={id:handle.dataset.drag,pointer:event.pointerId,capture:document.body,handle,row:handle.closest('[data-exercise-id]'),original,anchor,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY};
 });
 document.addEventListener('pointermove',event=>{const d=drag;if(!d||d.pointer!==event.pointerId||d.ending)return;event.preventDefault();d.x=event.clientX;d.y=event.clientY;if(!d.active&&Math.hypot(d.x-d.startX,d.y-d.startY)>5)lift(d);},{passive:false});
 document.addEventListener('pointerup',drop);
 document.addEventListener('pointercancel',event=>{if(drag?.pointer===event.pointerId)cancel();});
 document.addEventListener('lostpointercapture',event=>{if(drag?.pointer===event.pointerId&&event.target===drag.capture&&!drag.ending&&!drag.capture.hasPointerCapture(event.pointerId))cancel();});
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&drag){event.preventDefault();cancel();announce('已取消排序');return;}
  const handle=event.target.closest('[data-drag]');if(!handle||!['ArrowUp','ArrowDown'].includes(event.key)||drag)return;event.preventDefault();
  const ids=currentPlan.exercises.map(e=>e.id),i=ids.indexOf(handle.dataset.drag),j=i+(event.key==='ArrowUp'?-1:1);if(j<0||j>=ids.length)return;
  const old=new Map(rows().map(el=>[el.dataset.exerciseId,el.getBoundingClientRect().top]));[ids[i],ids[j]]=[ids[j],ids[i]];routineState.order=ids;render();
  if(!reduce())for(const row of rows()){const dy=old.get(row.dataset.exerciseId)-row.getBoundingClientRect().top;if(dy)row.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:280,easing});}
  app.querySelector(`[data-drag="${ids[j]}"]`)?.focus({preventScroll:true});announce(C.byId(ids[j]).name+'已移至第 '+(j+1)+' 位');
 });
 window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 globalThis.MuscleDragSort={cancel,get active(){return !!drag;}};
})();
