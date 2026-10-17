(()=>{'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');const $=id=>document.getElementById(id);
const ui={score:$('score'),remaining:$('remaining'),best:$('best'),misses:$('misses'),toast:$('toast'),overlay:$('overlay'),title:$('panel-title'),eyebrow:$('panel-eyebrow'),text:$('panel-text'),start:$('start-btn')};
let W=390,H=520,dpr=1,lastTime=0,now=0,state='menu',score=0,misses=0,best=0,pieces=[],flying=null,aimX=0,aimDir=1,speed=0.95,toastUntil=0,won=false,particles=[],shake=0;
try{best=Math.max(0,Number(localStorage.getItem('chashu12x-best'))||0)}catch(e){};
function resize(){const rect=canvas.getBoundingClientRect();W=Math.max(rect.width,1);H=Math.max(rect.height,1);dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
if(window.ResizeObserver){new ResizeObserver(resize).observe(canvas)}else window.addEventListener('resize',resize);resize();
const cx=()=>W/2,cy=()=>H*.665,rx=()=>Math.min(W*.378,H*.285),ry=()=>rx()*.405;
function ellipse(x,y,a,b,color){ctx.beginPath();ctx.ellipse(x,y,Math.max(a,.1),Math.max(b,.1),0,0,Math.PI*2);if(color){ctx.fillStyle=color;ctx.fill()}}
function line(x1,y1,x2,y2,color,width){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function ring(x,y,a,b,color,width){ellipse(x,y,a,b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function rand(a,b){return a+Math.random()*(b-a)}
function roundRect(x,y,w,h,r,color){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill()}
function bg(){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#643922');g.addColorStop(.6,'#965a30');g.addColorStop(1,'#532a1c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
// wooden counter
for(let i=0;i<10;i++){let yy=H*(.06+i*.12);line(0,yy,W,yy+W*.08,'#4b22152a',2);line(0,yy+3,W,yy+3+W*.08,'#e9aa5a1c',1)}
const v=ctx.createRadialGradient(cx(),cy(),W*.1,cx(),cy(),W*.8);v.addColorStop(0,'#fff1a409');v.addColorStop(1,'#1808069c');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
// chopsticks resting on table
ctx.save();ctx.translate(W*.10,H*.53);ctx.rotate(-.29);roundRect(0,0,W*.37,6,3,'#f2c782');roundRect(0,11,W*.37,6,3,'#d89848');ctx.restore();
// hand written poster corner
ctx.save();ctx.translate(W*.83,H*.36);ctx.rotate(.11);roundRect(-W*.065,-28,W*.13,63,3,'#261312');ctx.fillStyle='#ffcf81';ctx.textAlign='center';ctx.font=`bold ${Math.max(11,W*.037)}px serif`;ctx.fillText('特',0,-9);ctx.fillText('盛',0,11);ctx.fillText('！',0,30);ctx.restore();}
function bowl(){const x=cx(),y=cy(),a=rx(),b=ry();ctx.save();ctx.fillStyle='#1a08075e';ellipse(x+8,y+b*.95,a*1.09,b*.67,'#1b070b80');
// bowl body
const grad=ctx.createLinearGradient(0,y-b*.1,0,y+b*1.45);grad.addColorStop(0,'#fff4df');grad.addColorStop(.28,'#eebc88');grad.addColorStop(.8,'#c15238');grad.addColorStop(1,'#57201b');ellipse(x,y+b*.48,a*.98,b*1.08,grad);
// scalloped decorative band
ring(x,y+b*.22,a*.92,b*.86,'#802d28',5);ellipse(x,y,a,b,'#fff0d1');ellipse(x,y,a*.9,b*.85,'#732d22');ellipse(x,y,a*.85,b*.78,'#c16d24');ellipse(x,y,a*.805,b*.71,'#e5a13e');
// soup marbling
for(let i=0;i<16;i++){const ang=i*2.39996, r=Math.sqrt((i+.5)/16);ellipse(x+Math.cos(ang)*a*.69*r,y+Math.sin(ang)*b*.59*r,a*.12,b*.052,i%3===0?'#edbb5d93':'#b65d2780')}
// noodles
ctx.save();ctx.beginPath();ctx.ellipse(x,y,a*.79,b*.68,0,0,Math.PI*2);ctx.clip();for(let i=0;i<19;i++){const px=x+Math.sin(i*2.6)*a*.55, py=y+Math.cos(i*1.8)*b*.39;ctx.beginPath();ctx.moveTo(px-12,py);ctx.bezierCurveTo(px+3,py-13,px+12,py+14,px+26,py-1);ctx.strokeStyle=i%3?'#f8cf76ba':'#fff4b8bc';ctx.lineWidth=rand(2,3.4);ctx.stroke()}
// scallions
for(let i=0;i<18;i++){let ang=i*2.4,rad=Math.sqrt((i+.5)/18);ellipse(x+Math.cos(ang)*a*.66*rad,y+Math.sin(ang)*b*.53*rad,rand(2,5),rand(1,2.8),i%3===0?'#c4dc5d':'#548c3d')}
ctx.restore();ring(x,y,a*.94,b*.895,'#fff0d9',Math.max(5,W*.016));ring(x,y,a*1.013,b*1.018,'#a85840',2);ctx.restore()}
function point(p){const a=rx(),b=ry();return {x:cx()+p.x*a*.79,y:cy()+p.z*b*.73-p.level*4.15}}
function meat(x,y,scale,seed,alpha=1){const a=rx()*.325*scale,b=ry()*.57*scale;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(Math.sin(seed*11)*.095);
ctx.shadowColor='#29100b7d';ctx.shadowBlur=8*scale;ctx.shadowOffsetY=4*scale;ellipse(0,0,a,b,'#6b2d21');ctx.shadowColor='transparent';ellipse(0,-2*scale,a*.94,b*.92,'#a3472d');ellipse(0,-3*scale,a*.82,b*.8,'#e8af84');ellipse(0,-3*scale,a*.63,b*.65,'#b65136');ellipse(-a*.05,-b*.04,a*.47,b*.47,'#cc7951');
ctx.beginPath();ctx.ellipse(0,-3*scale,a*.76,b*.74,0,.12,5.85);ctx.strokeStyle='#ffe1ae';ctx.lineWidth=3*scale;ctx.stroke();
for(let i=0;i<8;i++){let t=seed*1.23+i*2.399,rr=(.2+(i%4)*.16);ellipse(Math.cos(t)*a*rr,Math.sin(t)*b*rr-2*scale,Math.max(1,3*scale),Math.max(.7,1.45*scale),i%2?'#8c362766':'#ffe2ac77')}
ctx.restore()}
function drawPieces(){const sorted=[...pieces].sort((a,b)=>a.level-b.level||a.z-b.z);for(const p of sorted){let q=point(p);meat(q.x,q.y,1,p.seed)}}
function shadow(){if(state!=='play'||flying)return;const p={x:aimX,z:-.08,level:Math.max(0,score*.37)};const q=point(p);ctx.save();ctx.setLineDash([5,6]);ring(q.x,q.y,rx()*.32,ry()*.56,'#fff4cfbd',2);ctx.setLineDash([]);ellipse(q.x,q.y,rx()*.29,ry()*.50,'#fffcba24');ctx.restore()}
function drawCurrent(){if(state!=='play')return;const p={x:aimX,z:-.08,level:0};let target=point(p);let y=flying?flying.y:H*.23+Math.sin(now*.004)*3;let x=flying?flying.x:target.x;ctx.save();line(x,y-34,x,y-62,'#ffe4a363',2);meat(x,y,1.05,score+17);ctx.restore()}
function renderParticles(dt){for(const p of particles){p.life-=dt;p.y+=p.vy*dt;p.x+=p.vx*dt;p.vy+=.00045*dt;ctx.globalAlpha=Math.max(0,p.life/650);ellipse(p.x,p.y,p.r,p.r,p.c)}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0)}
function boom(x,y){for(let i=0;i<13;i++)particles.push({x,y,vx:rand(-.20,.20),vy:rand(-.27,-.06),r:rand(2,4),c:i%2?'#ffcc67':'#fff2c1',life:rand(300,700)})}
function announce(txt,duration=1000){ui.toast.textContent=txt;ui.toast.classList.add('show');toastUntil=now+duration}
function hud(){ui.score.innerHTML=`${score}<span class="unit"> 枚</span>`;ui.remaining.innerHTML=`${Math.max(0,12-score)}<span class="unit"> 枚</span>`;ui.best.innerHTML=`${best}<span class="unit"> 枚</span>`;[...ui.misses.children].forEach((el,i)=>el.classList.toggle('lost',i<misses))}
function reset(){score=0;misses=0;pieces=[];flying=null;aimX=-.65;aimDir=1;speed=.92;won=false;particles=[];state='play';ui.overlay.classList.add('hidden');ui.toast.classList.remove('show');hud()}
function finish(){state='over';flying=null;ui.eyebrow.textContent=score>=12?'伝説のチャーシュー12倍！':'ラーメン完成！';ui.title.innerHTML=score>=12?`大盛り達成！<br>${score}枚のせた！`:`${score}枚のせた！`;ui.text.innerHTML=`${score>=best&&score>0?'最高記録！<br>':''}チャーシュー12倍まで${Math.max(0,12-score)}枚<br>もう一度、山盛りに挑戦しよう！`;ui.start.innerHTML='もう一度プレイ <span>▶</span>';ui.overlay.classList.remove('hidden')}
function drop(){if(state!=='play'||flying)return;const target=point({x:aimX,z:-.08,level:score*.37});flying={x:target.x,y:H*.23,targetX:aimX,vy:0,rotation:0}}
function land(){if(!flying)return;const x=flying.targetX+rand(-.032,.032)*(1+score*.025);flying=null;
// a drop has to be over the bowl and partly supported by the previous stack
const radius= Math.abs(x);const previous=pieces[pieces.length-1];const overlap=previous?Math.abs(x-previous.x):0;
const supported=radius<1.0&&(!previous||overlap<(.85+Math.min(score*.01,.18)));
if(!supported){misses++;shake=10;announce('あっ！ はみ出した！');hud();if(misses>=3)setTimeout(()=>{if(state==='play')finish()},520);return}
const level=score*.37;const p={x,z:-.08,level,seed:Math.random()*100};pieces.push(p);score++;let q=point(p);boom(q.x,q.y);if(score>best){best=score;try{localStorage.setItem('chashu12x-best',String(best))}catch(e){}}
if(score===12){won=true;announce('祝！ チャーシュー12倍達成！',1900)}else if(score%5===0){announce(`${score}枚！ まだまだ盛れる！`)}else if(score===1){announce('いい感じ！')}hud();speed=Math.min(2.1,.92+score*.052)}
function tick(t){let dt=Math.min(45,Math.max(0,t-lastTime||16));lastTime=t;now=t;
if(state==='play'){if(!flying){aimX+=aimDir*speed*dt/950;if(aimX>.91){aimX=.91;aimDir=-1}else if(aimX<-.91){aimX=-.91;aimDir=1}}else{flying.vy+=.00165*dt;flying.y+=flying.vy*dt;let target=point({x:flying.targetX,z:-.08,level:score*.37});if(flying.y>=target.y){land()}}}
ctx.save();if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake/2,shake/2));shake=Math.max(0,shake-dt*.045)}bg();bowl();shadow();drawPieces();drawCurrent();renderParticles(dt);ctx.restore();if(now>toastUntil)ui.toast.classList.remove('show');requestAnimationFrame(tick)}
ui.start.addEventListener('click',e=>{e.stopPropagation();reset()});$('restart').addEventListener('click',e=>{e.stopPropagation();reset()});canvas.addEventListener('pointerdown',e=>{e.preventDefault();drop()});window.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){if(['BUTTON','INPUT'].includes(document.activeElement?.tagName))return;e.preventDefault();if(state==='play')drop();else reset()}});
window.addEventListener('blur',()=>{lastTime=0});hud();requestAnimationFrame(tick);
})();
