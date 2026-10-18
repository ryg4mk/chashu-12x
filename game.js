(()=>{'use strict';
// Chashu 12x — orbit-aimed, continuous 2.5D pork-slice physics.
const BASE=6, RAMEN=950, SLICE=70, GRAMS=12, MM=7;
const canvas=document.getElementById('game');let ctx=canvas.getContext('2d');const $=id=>document.getElementById(id);
const el={score:$('score'),best:$('best'),total:$('total'),overlay:$('overlay'),label:$('panel-label'),title:$('panel-title'),info:$('panel-info'),details:$('result-detail'),start:$('start'),restart:$('restart')};
const min=Math.min,max=Math.max,PI=Math.PI;
const clamp=(v,a,b)=>max(a,min(b,v));
const money=n=>Math.round(n).toLocaleString('ja-JP')+'円';
const rand=(a,b)=>a+Math.random()*(b-a);
let W=360,H=510,dpr=1,stage='menu',bodies=[],score=BASE,best=BASE;
let now=0,prev=0,orbitAngle=-PI*.55,orbitRadius=.57,holding=false,heldPointer=null,holdStart=0,lastFire=-1e6,shot=0;
let staticLayer=null,sprites=[],driftPointerY=null,failPiece=null,frameCount=0,settleTime=0,flash=null,slowFrame=0;
try{best=max(BASE,Number(localStorage.getItem('chashu-best-v3'))||BASE)}catch{}
function geom(){return{cx:W*.5,rim:H*.685,rx:W*.34,ry:H*.105,r:W*.054};}
// World-space: x/depth z are elliptical-bowl radii; height h is above the soup.
// Gravity and momentum operate on these positions; no scripted outward ejection.
// Each slice is a shallow 3D disc. Settled slices become kinematic supports.
// World units: one soup radius ~1, vertical thickness ~0.075.
const RECENT_MOVABLE=10;
// A disc needs substantial overlap to be supported, not just edge-to-edge
// contact. Shallow overhangs glide off instead of becoming solid staircases.
const PHY={gravity:5.9,planeDrag:.94,contact:.33,thickness:.078,escape:1.025,
 supportRadius:.185,stableRadius:.090,edgeSlide:.73,freezeAfter:.8,steadyFor:.34};
function aim(){return {x:Math.cos(orbitAngle)*orbitRadius,z:Math.sin(orbitAngle)*orbitRadius};}
function projection(p){const g=geom();const perspective=1+clamp(p.z,-1.3,1.3)*.055;
return{x:g.cx+p.x*g.rx*.86,y:g.rim+p.z*g.ry*.77-(p.h||0)*H*.18,r:g.r*perspective};}
function bowlDist(p){return Math.hypot(p.x,p.z);}
function resize(){const rect=canvas.getBoundingClientRect();const w=max(1,rect.width),h=max(1,rect.height);if(Math.abs(W-w)<.2&&Math.abs(H-h)<.2&&staticLayer)return;W=w;H=h;dpr=min(1.75,window.devicePixelRatio||1);
canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);buildArt();}
if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);resize();
function make(x,z,h=0,options={}){return{x,z,h,vx:options.vx||0,vz:options.vz||0,vh:options.vh||0,
 angle:options.angle??rand(-.2,.2),omega:options.omega??0,seed:options.seed??rand(0,100),
 resting:h<=0,escaped:false,fallingOut:false,credited:!!options.credited,age:0,
 fixed:!!options.fixed,stableFor:0,supported:!!options.fixed,supporter:null,prevH:h};}
function initial(){const a=[[-.49,-.36],[-.16,-.48],[.25,-.39],[.52,-.15],[-.32,.30],[.20,.27]];
return a.map(([x,z],i)=>make(x,z,0,{seed:11+i*17,credited:true,fixed:true}));}
function hud(){el.score.innerHTML=score+'<span class="unit">枚</span>';el.best.innerHTML=best+'<span class="unit">枚</span>';el.total.textContent=money(RAMEN+score*SLICE);}
function stopHold(){holding=false;heldPointer=null;driftPointerY=null;}
function start(){stopHold();stage='play';bodies=initial();score=BASE;orbitAngle=-PI*.55;orbitRadius=.57;shot=0;lastFire=-1e6;failPiece=null;settleTime=0;flash=null;
el.label.textContent='特製チャーシューメン';el.title.classList.remove('result-title');el.overlay.classList.add('hidden');hud();}
function factor(n){return (Math.round(n/BASE*100)/100).toString();}
function payment(n){return Math.ceil(n/1000)*1000;}
function finish(){if(stage==='over')return;stage='over';stopHold();const cost=RAMEN+score*SLICE,pay=payment(cost);
el.label.textContent='ゲームオーバー';el.title.classList.add('result-title');el.title.innerHTML=`チャーシューメン、<br>チャーシュー${factor(score)}倍`;
el.info.textContent=`${score}枚`;el.details.hidden=false;
el.details.innerHTML=`<div><span>チャーシュー重量</span><b>${score*GRAMS}g</b></div><div><span>チャーシューの厚み</span><b>${score*MM}mm</b></div><div><span>お会計</span><b>${money(cost)}</b></div><div><span>お預かり</span><b>${money(pay)}</b></div><div class="change"><span>お釣り</span><b>${money(pay-cost)}</b></div>`;
el.start.textContent='もう一度';el.overlay.classList.remove('hidden');}
function fire(){if(stage!=='play'||now-lastFire<140)return;lastFire=now;const a=aim();
// Use only genuinely supported, landed pork as the launching clearance.
// Including still-falling slices produced an endless vertical chain in the sky.
let spawnH=1.00;for(const p of bodies){if(p.escaped||!(p.fixed||p.supported)||p.age<.20)continue;
 if(Math.hypot(p.x-a.x,p.z-a.z)<PHY.supportRadius)spawnH=max(spawnH,p.h+.32);}
const next=make(a.x,a.z,spawnH,{
 vx:-Math.sin(orbitAngle)*.042,vz:Math.cos(orbitAngle)*.042,vh:0,angle:rand(-.20,.20)});
bodies.push(next);shot++;}
function credit(p){if(p.credited||p.escaped)return;p.credited=true;score++;if(score>best){best=score;try{localStorage.setItem('chashu-best-v3',String(best))}catch{}}hud();}
function pointerDown(e){if(stage!=='play'||holding)return;e.preventDefault();holding=true;heldPointer=e.pointerId;holdStart=now;driftPointerY=e.clientY;fire();try{canvas.setPointerCapture(e.pointerId)}catch{}}
function pointerMove(e){if(!holding||e.pointerId!==heldPointer)return;const dy=driftPointerY===null?0:e.clientY-driftPointerY;
// Vertical drags adjust the orbit size; angular movement never stops while held.
orbitRadius=clamp(orbitRadius-dy*.0018,.26,.77);driftPointerY=e.clientY;}
function pointerUp(e){if(heldPointer===null||e.pointerId===heldPointer)stopHold();}
canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);
canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
canvas.addEventListener('lostpointercapture',pointerUp);window.addEventListener('pointerup',pointerUp);
window.addEventListener('blur',stopHold);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopHold()});
window.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&!['BUTTON','INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
e.preventDefault();if(stage==='play'&&!e.repeat)fire();else if(stage!=='play')start();}});
el.start.addEventListener('click',start);el.restart.addEventListener('click',start);
// 2.5D disc physics: every body has horizontal position and height. A settled
// body becomes a static collider, NOT a decorative image. Falling pieces must
// physically land on soup or on discs underneath them. Unsupported overhangs
// remain subject to gravity and can fall completely out of the bowl.
function physics(dt){const step=dt/1000,th=PHY.thickness;
 // Move the unstabilized discs only. Static slices never receive an impulse.
 for(const p of bodies){p.age+=step;
  if(p.fixed)continue;
  if(p.escaped){p.vh-=PHY.gravity*step;p.h+=p.vh*step;
   p.x+=p.vx*step;p.z+=p.vz*step;
   p.angle+=p.omega*step;p.omega*=.996;continue;}
  p.prevH=p.h;p.vh-=PHY.gravity*step;p.h+=p.vh*step;
  p.x+=p.vx*step;p.z+=p.vz*step;
  const drag=Math.pow(PHY.planeDrag,dt/16.667);
  p.vx*=drag;p.vz*=drag;p.angle+=p.omega*step;p.omega*=.98;
 }
 // A spatial index avoids the full O(n²) contact scan for long games.
 const cell=.42,grid=new Map();
 for(let i=0;i<bodies.length;i++){const p=bodies[i];if(p.escaped)continue;
  const key=Math.floor(p.x/cell)+','+Math.floor(p.z/cell);
  let a=grid.get(key);if(!a){a=[];grid.set(key,a)}a.push(i);}
 function neighbors(p){const xx=Math.floor(p.x/cell),zz=Math.floor(p.z/cell),out=[];
  for(let x=xx-1;x<=xx+1;x++)for(let z=zz-1;z<=zz+1;z++){
   const bucket=grid.get(x+','+z);if(bucket)for(const j of bucket)out.push(j);
  }return out;}
 // Integrate lowest to highest so a new meat slice can land on an already
 // supported piece; the fixed colliders take no displacement themselves.
 const indices=bodies.map((_,i)=>i).sort((a,b)=>bodies[a].h-bodies[b].h);
 for(const i of indices){const p=bodies[i];if(p.fixed||p.escaped)continue;
  const inside=bowlDist(p)<PHY.escape;
  let floor=inside?0:-Infinity,support=null,supportQuality=0;
  for(const j of neighbors(p)){if(j===i)continue;
   const q=bodies[j];if(q.escaped)continue;
   const dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz);
   // An overlap across nearly the whole slice is required to hold weight.
   // A one-pixel edge overlap must NOT create a bridge in midair.
   if(d>=PHY.supportRadius)continue;
   if(!q.fixed&&!q.supported)continue;
   // Only a lower surface crossed while descending can support this body.
   if(q.h+th*.48>p.prevH)continue;
   const top=q.h+th;
   if(top>floor){floor=top;support=q;supportQuality=d;}
  }
  p.supported=false;p.supporter=null;
  if(floor!==-Infinity&&p.h<=floor&&p.vh<=0){
   p.h=floor;p.vh=0;p.supported=true;p.resting=true;p.supporter=support;
   // A slanted pile is not a stable shelf. Its slices slowly slide toward
   // the unsupported side, and gravity continues if they lose contact.
   if(support&&supportQuality>PHY.stableRadius){
    const dx=p.x-support.x,dz=p.z-support.z,d=supportQuality;
    const t=(d-PHY.stableRadius)/(PHY.supportRadius-PHY.stableRadius);
    const slide=PHY.edgeSlide*t*t;
    p.vx+=(dx/d)*slide*step;p.vz+=(dz/d)*slide*step;
   }
   credit(p);
  }else{p.resting=false;}
  if(!inside&&p.h<=-.025){p.escaped=true;p.fallingOut=true;
   p.resting=false;p.fixed=false;p.vh=min(p.vh,-.08);
   p.omega+=clamp(p.vx+p.vz,-.3,.3);continue;}
  const motion=Math.hypot(p.vx,p.vz);
  p.stableFor=(p.supported&&(!support||support.fixed)&&motion<.060&&Math.abs(p.vh)<.001)
   ?p.stableFor+step:0;
  // Keep the newest 10 pieces fully dynamic. Even older slices must have
  // settled on a real foundation; a drifting or suspended disc never locks.
  const olderThanLatestTen=i < bodies.length-RECENT_MOVABLE;
  const anchoredBelow=!support || support.fixed;
  const centrallySupported=!support || supportQuality<=PHY.stableRadius;
  if(olderThanLatestTen&&p.supported&&anchoredBelow&&centrallySupported
     &&p.age>=PHY.freezeAfter&&p.stableFor>=PHY.steadyFor){
   p.fixed=true;p.vx=p.vz=p.vh=p.omega=0;p.stableFor=0;
  }
 }
 // Same-level contacts (within a slice's thickness) resolve side collisions.
 // Anchored meat does NOT budge; new meat has to find free space or fall.
 for(let i=0;i<bodies.length;i++){
  const a=bodies[i];if(a.escaped)continue;
  for(const j of neighbors(a)){
   if(j<=i)continue;const b=bodies[j];if(b.escaped||a.fixed&&b.fixed)continue;
   if(Math.abs(a.h-b.h)>th*.56)continue;
   const dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;
   const minD=PHY.contact*.64;if(d2>=minD*minD)continue;
   const d=Math.sqrt(max(d2,.000001)),nx=d>.001?dx/d:Math.cos(i*2.4),nz=d>.001?dz/d:Math.sin(i*2.4);
   const push=(minD-d)*.32;
   const wa=a.fixed?0:b.fixed?1:.5,wb=b.fixed?0:a.fixed?1:.5;
   a.x-=nx*push*wa;a.z-=nz*push*wa;
   b.x+=nx*push*wb;b.z+=nz*push*wb;
   if(!a.fixed){a.vx-=nx*push*step*12;a.vz-=nz*push*step*12;a.stableFor=0;}
   if(!b.fixed){b.vx+=nx*push*step*12;b.vz+=nz*push*step*12;b.stableFor=0;}
  }
 }
 // There is no scripted eject animation. A real escaped body stays active,
 // falls with the same gravity, and is drawn in front of the bowl.
 if(stage==='play')for(const p of bodies){if(p.escaped){failPiece=p;stage='spill';stopHold();break;}}
 if(stage==='spill'&&failPiece&&failPiece.h<-1.25)finish();
}
// Only visual state (no invented forces or timed game-over transitions).
function buildArt(){const old=ctx;
 const art=document.createElement('canvas');art.width=Math.round(W*dpr);art.height=Math.round(H*dpr);ctx=art.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);woodWall();counter();bowlDrawing();staticLayer=art;
 sprites=[];const radius=geom().r,sz=Math.ceil(radius*3.3);
 for(let i=0;i<8;i++){const c=document.createElement('canvas');c.width=Math.round(sz*dpr);c.height=Math.round(sz*dpr);ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);meat({x:sz*.5,y:sz*.5,r:radius,angle:0,seed:i*17+7});sprites.push(c)}ctx=old;
}
function paintMeat(p){if(!sprites.length){meat(p);return}const sz=p.r*3.3,variant=(Math.floor(p.seed*7)%sprites.length+sprites.length)%sprites.length;
ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.drawImage(sprites[variant],-sz/2,-sz/2,sz,sz);ctx.restore();}
function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,max(.1,rx),max(.1,ry),0,0,Math.PI*2);if(color){ctx.fillStyle=color;ctx.fill()}}
function strokeEllipse(x,y,rx,ry,color,width){ellipse(x,y,rx,ry);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
function rr(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill()}
function woodWall(){let grad=ctx.createLinearGradient(0,0,W,H*.62);grad.addColorStop(0,'#956c48');grad.addColorStop(.53,'#bb8860');grad.addColorStop(1,'#785138');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H*.635);
for(let i=0;i<11;i++){let y=H*.07+i*H*.057;ctx.lineWidth=i%3===0?3:1;ctx.strokeStyle=i%3===0?'#43271d32':'#57362525';ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(W*.3,y+5,W*.66,y-7,W,y+2);ctx.stroke()}
ctx.fillStyle='#3a2116';ctx.fillRect(0,H*.614,W,12);ctx.fillStyle='#e2af78';ctx.fillRect(0,H*.628,W,5);
// Five individually hanging timber menu slats, all vertical.
const words=['餃子','ライス','野菜炒め','ラーメン','特製チャーシューメン'];
let boardH=H*.285,bw=min(47,W*.126),space=W*.017,total=words.length*bw+4*space,x=(W-total)/2;
for(let i=0;i<5;i++){ctx.save();const bx=x+i*(bw+space),by=H*.165+((i%2)*4);ctx.translate(bx+bw/2,by);ctx.rotate((i-2)*.012);
ctx.shadowColor='#3017107c';ctx.shadowBlur=8;ctx.shadowOffsetX=2;rr(-bw/2,0,bw,boardH,4,'#634025');ctx.shadowColor='transparent';let wg=ctx.createLinearGradient(-bw/2,0,bw/2,0);wg.addColorStop(0,'#a46b3c');wg.addColorStop(.25,'#dbab70');wg.addColorStop(.8,'#bd824e');wg.addColorStop(1,'#89522e');rr(-bw/2+2,2,bw-4,boardH-4,3,wg);
for(let k=0;k<3;k++){ctx.strokeStyle='#60341623';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-bw*.3+k*bw*.25,8);ctx.quadraticCurveTo(-bw*.20+k*bw*.22,boardH*.55,-bw*.3+k*bw*.25,boardH-7);ctx.stroke()}
ellipse(0,11,2.5,2.5,'#4e2b1a');ellipse(-.65,10.4,.7,.7,'#e7c196');
const n=words[i].length;const fs=min(bw*.45,boardH*.83/(n*.98));ctx.font=`900 ${fs}px "Yu Gothic",sans-serif`;ctx.fillStyle='#3a2118';ctx.textAlign='center';ctx.textBaseline='middle';
let hh=fs*.98,top=boardH*.54-n*hh*.5;for(let j=0;j<n;j++){
const ch=words[i][j];if(ch==='ー'){ctx.save();ctx.translate(0,top+j*hh);ctx.rotate(Math.PI/2);ctx.fillText(ch,0,0);ctx.restore();}
else ctx.fillText(ch,0,top+j*hh);}
ctx.restore();}
}
function counter(){const y=H*.635;let g=ctx.createLinearGradient(0,y,0,H);g.addColorStop(0,'#b37a47');g.addColorStop(.45,'#8b562f');g.addColorStop(1,'#52301d');ctx.fillStyle=g;ctx.fillRect(0,y,W,H-y);
for(let k=0;k<11;k++){let yy=y+k*H*.037;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(W,yy+W*.035);ctx.lineWidth=1;ctx.strokeStyle=k%2?'#dfae7650':'#4b2d1952';ctx.stroke()}
ctx.fillStyle='#34201285';ctx.fillRect(0,H*.84,W,H*.016);
// Small lacquered chopstick rest at left.
ctx.save();ctx.translate(W*.075,H*.78);ctx.rotate(-.23);rr(0,0,W*.20,4,2,'#f3d299');rr(0,10,W*.20,4,2,'#d9a35b');ctx.restore();
}
function bowlDrawing(){const g=geom(),c=g.cx,y=g.rim,rx=g.rx,ry=g.ry;
ctx.save();ctx.shadowColor='#20100995';ctx.shadowBlur=24;ctx.shadowOffsetY=18;ellipse(c+6,H*.926,rx*.94,ry*.49,'#170c0a77');ctx.restore();
// Ceramic sides, with a visible elliptical mouth and deep curved front.
let body=ctx.createLinearGradient(0,y-ry,0,H*.955);body.addColorStop(0,'#fcf1da');body.addColorStop(.22,'#f6d7ae');body.addColorStop(.54,'#c94732');body.addColorStop(.82,'#8c2c29');body.addColorStop(1,'#44191e');
ctx.beginPath();ctx.moveTo(c-rx,y);ctx.bezierCurveTo(c-rx*.99,H*.84,c-rx*.69,H*.96,c,H*.958);ctx.bezierCurveTo(c+rx*.69,H*.96,c+rx*.99,H*.84,c+rx,y);ctx.closePath();ctx.fillStyle=body;ctx.fill();
ctx.strokeStyle='#fbdbab';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(c-rx*.78,H*.839);ctx.quadraticCurveTo(c,H*.94,c+rx*.78,H*.839);ctx.stroke();
ctx.strokeStyle='#69211e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(c-rx*.77,H*.852);ctx.quadraticCurveTo(c,H*.957,c+rx*.77,H*.852);ctx.stroke();
// Ramen soup with ivory rim.
ellipse(c,y,rx,ry,'#fff3d7');ellipse(c,y,rx*.933,ry*.85,'#713b24');let broth=ctx.createRadialGradient(c-rx*.3,y-ry*.25,4,c,y,rx*.96);broth.addColorStop(0,'#ffd38a');broth.addColorStop(.64,'#e99b38');broth.addColorStop(1,'#a65a2a');
ellipse(c,y,rx*.875,ry*.78,broth);
ctx.save();ctx.beginPath();ctx.ellipse(c,y,rx*.85,ry*.74,0,0,7);ctx.clip();
for(let i=0;i<30;i++){const xx=c+Math.sin(i*2.26)*rx*.70,yy=y+Math.cos(i*1.49)*ry*.55;ctx.strokeStyle=i%3?'#ffe5a4b8':'#fff6cbd4';ctx.lineWidth=2.8;ctx.beginPath();ctx.moveTo(xx-18,yy);ctx.bezierCurveTo(xx,yy-9,xx+12,yy+10,xx+25,yy-3);ctx.stroke()}
for(let i=0;i<22;i++){const t=i*2.4,rad=Math.sqrt((i+.4)/22);ellipse(c+Math.cos(t)*rx*.67*rad,y+Math.sin(t)*ry*.55*rad,rand(2,4),rand(1.1,2.4),i%4===0?'#bddf7d':'#619a43')}
ctx.restore();
// Egg, soft yolk and nori add depth, but stay behind pork.
ctx.save();ctx.translate(c+rx*.55,y-ry*.31);ctx.rotate(-.34);ellipse(0,0,rx*.18,ry*.37,'#fff6e2');ellipse(0,0,rx*.12,ry*.24,'#f9ae34');ellipse(-rx*.02,-ry*.06,rx*.043,ry*.085,'#ffe69a');ctx.restore();
ctx.save();ctx.translate(c-rx*.66,y-ry*.47);ctx.rotate(-.19);rr(-rx*.16,-ry*.22,rx*.28,ry*.68,2,'#24312c');rr(-rx*.13,-ry*.20,rx*.20,ry*.58,1,'#304337');ctx.restore();
// Gold ornament on ceramic face.
ctx.strokeStyle='#f8c879';ctx.lineWidth=3;ctx.beginPath();ctx.arc(c,H*.858,rx*.13,Math.PI*.15,Math.PI*1.85);ctx.stroke();ellipse(c,H*.858,rx*.027,rx*.027,'#f8c879');
}
function meat(p){const r=p.r;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
const shadow=ctx.createRadialGradient(2,r*.13,r*.1,0,0,r*1.1);shadow.addColorStop(0,'#41140a86');shadow.addColorStop(1,'#41140a00');ellipse(1,r*.17,r*1.18,r*.78,shadow);
// Charred, glazed outer edge.
let crust=ctx.createLinearGradient(0,-r*.79,0,r*.84);crust.addColorStop(0,'#97412c');crust.addColorStop(.55,'#a34930');crust.addColorStop(1,'#612c22');ellipse(0,0,r*1.10,r*.80,crust);
// Irregular-looking ring of creamy fat and tender pink pork.
ellipse(-r*.01,-r*.08,r*.99,r*.71,'#f3c49c');ellipse(r*.07,-r*.065,r*.85,r*.58,'#c77451');
ellipse(-r*.10,-r*.08,r*.61,r*.47,'#db9671');
ellipse(r*.10,-r*.04,r*.41,r*.34,'#bc6247');
ctx.lineWidth=max(1.7,r*.105);ctx.strokeStyle='#ffe0b9';ctx.beginPath();ctx.ellipse(-r*.01,-r*.09,r*.94,r*.67,-.04,.22,Math.PI*1.85);ctx.stroke();
ctx.lineWidth=max(.8,r*.035);ctx.strokeStyle='#a9503a85';ctx.beginPath();ctx.ellipse(-r*.08,-r*.08,r*.57,r*.42,.13,.2,5.7);ctx.stroke();
for(let i=0;i<5;i++){const a=p.seed+i*2.2,rr=.22+(i%3)*.16;ellipse(Math.cos(a)*r*rr,Math.sin(a)*r*.36*rr,r*.075,r*.027,i%2?'#ffe1b277':'#a04c3a70')}
ctx.restore();}

function rimFront(){const g=geom(),c=g.cx,y=g.rim,rx=g.rx,ry=g.ry;
ctx.beginPath();ctx.ellipse(c,y,rx,ry,0,.015,Math.PI-.015);ctx.strokeStyle='#fff7e4';ctx.lineWidth=8;ctx.stroke();ctx.beginPath();ctx.ellipse(c,y+2,rx*.979,ry*.95,0,.018,Math.PI-.018);ctx.strokeStyle='#ac4636';ctx.lineWidth=2.1;ctx.stroke();}

function drawAim(){const g=geom();const a=aim(),at=projection({...a,h:0});ctx.save();
 ctx.strokeStyle='#fbe7ae5e';ctx.lineWidth=1.6;ctx.setLineDash([4,7]);ctx.beginPath();
 ctx.ellipse(g.cx,g.rim,g.rx*.86*orbitRadius,g.ry*.77*orbitRadius,0,0,PI*2);ctx.stroke();ctx.setLineDash([]);
 ctx.lineWidth=2.4;ctx.strokeStyle='#fff1bf';ctx.beginPath();ctx.ellipse(at.x,at.y,g.r*.9,g.r*.52,0,0,PI*2);ctx.stroke();
 ctx.fillStyle='#fff2be';ctx.beginPath();ctx.arc(at.x,at.y,2.7,0,PI*2);ctx.fill();ctx.restore();}
function draw(){ctx.clearRect(0,0,W,H);if(staticLayer)ctx.drawImage(staticLayer,0,0,W,H);else{woodWall();counter();bowlDrawing();}
 if(stage==='play')drawAim();
 // Draw farther pieces first; projected height places airborne meat above the soup.
 const ordered=[...bodies].sort((a,b)=>(a.z-a.h*.2)-(b.z-b.h*.2));
 for(const p of ordered){if(p.fallingOut)continue;const q=projection(p);paintMeat({x:q.x,y:q.y,r:q.r,angle:p.angle,seed:p.seed});}
 rimFront();
 // Falling-out meat goes in front of the bowl, physically below the rim.
 for(const p of bodies){if(!p.fallingOut)continue;const q=projection(p);paintMeat({x:q.x,y:q.y,r:q.r,angle:p.angle,seed:p.seed});}
 if(stage==='play'){const a=aim(),p=projection({...a,h:1.00});paintMeat({x:p.x,y:p.y,r:p.r,angle:now*.00019,seed:17});}
 if(stage==='spill'){
 ctx.save();ctx.font=`900 ${max(18,W*.057)}px sans-serif`;ctx.textAlign='center';ctx.lineWidth=4;
 ctx.strokeStyle='#632018';ctx.fillStyle='#ffedc7';ctx.strokeText('こぼれた！',W*.5,H*.37);ctx.fillText('こぼれた！',W*.5,H*.37);ctx.restore();}
}
function frame(ts){const dt=clamp(ts-prev||16,0,34);prev=ts;now=ts;
 if(stage==='play'){
 // Rotate automatically regardless of whether the pointer moves.
 orbitAngle+=(dt/1000)*(.96+min(.40,max(0,score-BASE)*.004));
 if(holding&&now-holdStart>=220&&now-lastFire>=290)fire();
 }
 if(stage==='play'||stage==='spill'){
 // Physics integration at bounded substeps to prevent jumps on slow devices.
 const steps=max(1,Math.ceil(dt/16));for(let i=0;i<steps;i++)physics(dt/steps);
 }
 draw();requestAnimationFrame(frame);
}
bodies=initial();hud();requestAnimationFrame(frame);
})();
