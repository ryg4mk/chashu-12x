(()=>{'use strict';
const BASE=6, RAMEN=950, SLICE=70, GRAMS=12, MM=7;
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
const el={score:$('score'),best:$('best'),total:$('total'),overlay:$('overlay'),label:$('panel-label'),title:$('panel-title'),info:$('panel-info'),details:$('result-detail'),start:$('start'),restart:$('restart')};
let W=360,H=510,dpr=1,stage='menu',bodies=[],score=BASE,best=BASE;
let now=0,prev=0,aim=0,dir=1,holding=false,holdStart=0,lastFire=-Infinity,heldPointer=null,ended=false;
let lastFrameError=false;
try{best=Math.max(BASE,Number(localStorage.getItem('chashu-best-v3'))||BASE)}catch{}
const min=(a,b)=>Math.min(a,b),max=(a,b)=>Math.max(a,b),clamp=(n,a,b)=>max(a,min(b,n));
const money=n=>Math.round(n).toLocaleString('ja-JP')+'円';
const rand=(a,b)=>a+Math.random()*(b-a);
const geom=()=>({cx:W*.5,rim:H*.685,rx:W*.34,ry:H*.105,floor:H*.672,r:W*.054});
function resize(){const oldW=W,oldH=H,r=canvas.getBoundingClientRect();W=max(1,r.width);H=max(1,r.height);dpr=min(2,window.devicePixelRatio||1);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
if(bodies.length&&oldW&&oldH){for(const p of bodies){p.x*=W/oldW;p.y*=H/oldH;p.r*=W/oldW;p.vx*=W/oldW;p.vy*=H/oldH;}}}
if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);resize();
function initial(){const g=geom(),r=g.r;
return [[-2.85,0],[-.95,0],[.95,0],[2.85,0],[-.9,1.67],[.98,1.67]].map(([x,z],i)=>newBody(g.cx+x*r,g.floor-r-z*r,{fixed:true,settled:true,seed:31+i*12}));}
function newBody(x,y,opt={}){return{x,y,vx:opt.vx||0,vy:opt.vy||0,r:geom().r,angle:rand(-.33,.33),omega:rand(-.4,.4),seed:opt.seed??rand(0,100),fixed:!!opt.fixed,settled:!!opt.settled,age:0,near:false,spilled:false};}
function hud(){el.score.innerHTML=score+'<span class="unit">枚</span>';el.best.innerHTML=best+'<span class="unit">枚</span>';el.total.textContent=money(RAMEN+score*SLICE);}
function cleanHold(){holding=false;heldPointer=null;}
function start(){cleanHold();stage='play';ended=false;bodies=initial();score=BASE;aim=0;dir=1;lastFire=-Infinity;el.overlay.classList.add('hidden');hud();}
function factor(n){return (Math.round(n/BASE*100)/100).toString();}
function payment(total){return Math.ceil(total/1000)*1000;}
function end(){if(ended||stage!=='play')return;ended=true;stage='over';cleanHold();const total=RAMEN+score*SLICE,pay=payment(total);
el.label.textContent='ゲームオーバー';el.title.classList.add('result-title');el.title.innerHTML=`チャーシューメン、<br>チャーシュー${factor(score)}倍`;
el.info.textContent=`${score}枚`;el.details.hidden=false;el.details.innerHTML=`<div><span>チャーシュー重量</span><b>${score*GRAMS}g</b></div><div><span>チャーシューの厚み</span><b>${score*MM}mm</b></div><div><span>お会計</span><b>${money(total)}</b></div><div><span>お預かり</span><b>${money(pay)}</b></div><div class="change"><span>お釣り</span><b>${money(pay-total)}</b></div>`;
el.start.textContent='もう一度';el.overlay.classList.remove('hidden');}
function fire(){if(stage!=='play'||now-lastFire<105)return;lastFire=now;const g=geom();
const highest=bodies.reduce((n,p)=>min(n,p.y),g.rim);let spawnY=min(H*.405,highest-g.r*4.6);
spawnY=max(-H*.45,spawnY);bodies.push(newBody(g.cx+aim*g.rx*.69,spawnY,{vx:dir*rand(4,11),vy:rand(0,15)}));}
function ptrDown(e){if(stage!=='play')return;e.preventDefault();if(holding)return;holding=true;heldPointer=e.pointerId;holdStart=now;lastFire=-Infinity;fire();try{canvas.setPointerCapture(e.pointerId)}catch{}}
function ptrUp(e){if(heldPointer===null||e.pointerId===heldPointer)cleanHold();}
canvas.addEventListener('pointerdown',ptrDown);canvas.addEventListener('pointerup',ptrUp);canvas.addEventListener('pointercancel',ptrUp);canvas.addEventListener('lostpointercapture',ptrUp);window.addEventListener('pointerup',ptrUp);
window.addEventListener('blur',cleanHold);document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanHold()});
window.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&!['BUTTON','INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();if(stage==='play'&&!e.repeat)fire();else if(stage!=='play')start();}});
el.start.addEventListener('click',start);el.restart.addEventListener('click',start);
function physics(dt){const g=geom();const step=dt/1000,gravity=780;
// Position integration, with low bounce and velocity damping to encourage stable stacks.
for(const p of bodies){if(p.fixed||p.spilled)continue;p.age+=dt;p.vy=clamp(p.vy+gravity*step,-180,470);p.x+=p.vx*step;p.y+=p.vy*step;p.angle+=p.omega*step;p.omega*=.975;p.vx*=.983;
// Wide soup surface holds pieces whose centres are inside the bowl.
if(p.y+p.r>g.floor && Math.abs(p.x-g.cx)<g.rx-p.r*.20){p.y=g.floor-p.r;if(p.vy>0)p.vy=-p.vy*.045;p.vx*=.82;p.near=true;markLanded(p);}
}
// Several iterations reduce penetration and make landing forgiving.
for(let iteration=0;iteration<4;iteration++){
for(let i=0;i<bodies.length;i++){const a=bodies[i];for(let j=i+1;j<bodies.length;j++){const b=bodies[j];if(a.fixed&&b.fixed)continue;
const dx=b.x-a.x,dy=b.y-a.y,dist2=dx*dx+dy*dy,rr=a.r+b.r;if(dist2>=rr*rr)continue;
const d=Math.sqrt(dist2)||.0001,nx=dx/d,ny=dy/d,overlap=rr-d;
let ma=a.fixed?0:1,mb=b.fixed?0:1,sum=ma+mb;if(!sum)continue;
a.x-=nx*overlap*ma/sum*.92;a.y-=ny*overlap*ma/sum*.92;b.x+=nx*overlap*mb/sum*.92;b.y+=ny*overlap*mb/sum*.92;
const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel<0){const impulse=(-rel*.52)/sum;a.vx-=impulse*nx*ma;a.vy-=impulse*ny*ma;b.vx+=impulse*nx*mb;b.vy+=impulse*ny*mb;}
if(ny>-.35&&ny<.35){/* mostly lateral collisions stay soft */}
if(!a.fixed){a.vx*=.90;a.vy*=.95;}if(!b.fixed){b.vx*=.90;b.vy*=.95;}
if(a.settled||a.fixed)markLanded(b);if(b.settled||b.fixed)markLanded(a);
}}
}
for(const p of bodies){if(p.fixed||p.spilled)continue;
// Low energy pile stabilizer: small drift back toward the bowl centre, not a hard snap.
if(p.settled){p.vx+=(g.cx-p.x)*.25*step;p.vx*=.93;}
p.vx=clamp(p.vx,-85,85);
// Spilled pieces must actually pass the bowl's rim before they trigger the result.
if(p.y>g.rim-g.ry*.2 && Math.abs(p.x-g.cx)>g.rx+p.r*.27){p.spilled=true;end();return;}
if(p.y>H+p.r){p.spilled=true;end();return;}
}
}
function markLanded(p){if(p.fixed||p.settled)return;p.settled=true;score++;if(score>best){best=score;try{localStorage.setItem('chashu-best-v3',String(best))}catch{}}hud();}
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
let hh=fs*.98,top=boardH*.54-n*hh*.5;for(let j=0;j<n;j++)ctx.fillText(words[i][j],0,top+j*hh);ctx.restore();}
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
function meat(p){const r=p.r,angle=p.angle;
ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.shadowColor='#35100880';ctx.shadowBlur=r*.36;ctx.shadowOffsetY=r*.16;
let g=ctx.createRadialGradient(-r*.2,-r*.25,r*.2,0,0,r*1.05);g.addColorStop(0,'#a84931');g.addColorStop(.68,'#9e3b29');g.addColorStop(1,'#5f241d');ellipse(0,0,r*1.03,r*.86,g);ctx.shadowColor='transparent';
ellipse(0,-r*.08,r*.92,r*.74,'#e8a177');ellipse(r*.05,-r*.07,r*.70,r*.56,'#be6146');ellipse(-r*.12,-r*.06,r*.46,r*.39,'#d88a65');
ctx.strokeStyle='#ffe0b9';ctx.lineWidth=max(2,r*.14);ctx.beginPath();ctx.ellipse(0,-r*.07,r*.85,r*.66,0,.03,Math.PI*1.98);ctx.stroke();
ctx.strokeStyle='#f2bd8b';ctx.lineWidth=max(.8,r*.06);ctx.beginPath();ctx.arc(r*.09,-r*.06,r*.40,.4,4.9);ctx.stroke();
for(let i=0;i<6;i++){let t=p.seed+i*2.24,rad=.2+(i%3)*.16;ellipse(Math.cos(t)*r*rad,Math.sin(t)*r*.45*rad,r*.077,r*.036,i%2?'#ffe9bf99':'#8b34286e')}
ctx.restore();}
function rimFront(){const g=geom(),c=g.cx,y=g.rim,rx=g.rx,ry=g.ry;
ctx.beginPath();ctx.ellipse(c,y,rx,ry,0,.015,Math.PI-.015);ctx.strokeStyle='#fff7e4';ctx.lineWidth=8;ctx.stroke();ctx.beginPath();ctx.ellipse(c,y+2,rx*.979,ry*.95,0,.018,Math.PI-.018);ctx.strokeStyle='#ac4636';ctx.lineWidth=2.1;ctx.stroke();}
function draw(){ctx.clearRect(0,0,W,H);woodWall();counter();bowlDrawing();
// Each slice has its own shadow and fat marbling. Back pieces first.
for(const p of [...bodies].sort((a,b)=>a.y-b.y))meat(p);rimFront();
if(stage==='play'){const g=geom(),x=g.cx+aim*g.rx*.69,y=min(H*.405,bodies.reduce((n,p)=>min(n,p.y),g.rim)-g.r*4.6);const fake={x,y:max(-H*.45,y),r:g.r,angle:Math.sin(now*.004)*.09,seed:17};meat(fake);
ctx.strokeStyle='#fce4b19c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,fake.y-g.r*.85);ctx.lineTo(x,fake.y-g.r*1.7);ctx.stroke();}
let shade=ctx.createRadialGradient(W/2,H/2,W*.20,W/2,H/2,W*.80);shade.addColorStop(0,'#0000');shade.addColorStop(1,'#1c080842');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);}
function frame(ts){const dt=clamp(ts-prev||16,0,34);prev=ts;now=ts;
if(stage==='play'){aim+=dir*dt*.00075;if(aim>.73){aim=.73;dir=-1}if(aim<-.73){aim=-.73;dir=1}
if(holding&&now-holdStart>=230&&now-lastFire>=160)fire();
// Two substeps to reduce tunnel-through and improve contact stability.
const steps=2;for(let i=0;i<steps&&stage==='play';i++)physics(dt/steps);
}
try{draw()}catch(e){if(!lastFrameError){lastFrameError=true;console.error('Render error',e)}}
requestAnimationFrame(frame)}
bodies=initial();hud();requestAnimationFrame(frame);
})();
