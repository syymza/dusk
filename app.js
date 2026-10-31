import { Flock, FixedClock, random } from './simulation.js';
const canvas = document.querySelector('#sky');
const ctx = canvas.getContext('2d', { alpha: false });
const background = document.createElement('canvas');
const bg = background.getContext('2d');
const contact = document.querySelector('#contact');
const about = document.querySelector('#about-dialog');
const openAbout = document.querySelector('#open-about');
let contactTimer = null;
const motionNote = document.querySelector('#motion-note');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let width = 0, height = 0, scale = 1, pixelRatio = 1;
const flock = new Flock();
const clock = new FixedClock(flock);
let pointer = null, pointerId = null, paused = reduced.matches, last = null, request = 0;

function paintBackground() {
  background.width = canvas.width; background.height = canvas.height;
  bg.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const sky = bg.createLinearGradient(0, 0, 0, height);
  for (const [stop, color] of [[0,'#727b99'],[.3,'#9c98b2'],[.59,'#c6afbb'],[.82,'#e8c6bd'],[1,'#edc9ad']]) sky.addColorStop(stop, color);
  bg.fillStyle = sky; bg.fillRect(0,0,width,height);
  const glow = bg.createRadialGradient(width*.68,height*.78,0,width*.68,height*.78,height*.68);
  glow.addColorStop(0,'#f9d5b42b'); glow.addColorStop(1,'#e8c6bd00');
  bg.fillStyle = glow; bg.fillRect(0,0,width,height);
  const rng = random(31);
  for (let i=0;i<32;i++) {
    const x=rng()*width,y=rng()*height*.5,r=.3+rng()*.4;
    bg.fillStyle = `rgba(255,240,223,${.12+rng()*.32})`; bg.beginPath(); bg.arc(x,y,r,0,Math.PI*2); bg.fill();
  }
  const mx=width*.8,my=height*.19,mr=Math.min(width,height)*.014;
  const halo=bg.createRadialGradient(mx,my,mr,mx,my,mr*5);
  halo.addColorStop(0,'#f9e1cb18'); halo.addColorStop(1,'#f9e1cb00');
  bg.fillStyle=halo; bg.beginPath(); bg.arc(mx,my,mr*5,0,Math.PI*2); bg.fill();
  bg.fillStyle='#f0dfd0'; bg.beginPath(); bg.arc(mx,my,mr,0,Math.PI*2); bg.fill();
  for(let layer=0;layer<3;layer++) {
    bg.fillStyle=['#aa9eac25','#8d8b9d30','#777b9138'][layer];
    bg.beginPath(); bg.moveTo(0,height);
    for(let x=0;x<=width+8;x+=8) {
      const y=height*(.875+layer*.036) + Math.sin(x/width*5+layer*2)*height*.013 + Math.sin(x/width*15+layer)*height*.004;
      bg.lineTo(x,y);
    }
    bg.lineTo(width,height); bg.closePath(); bg.fill();
  }
  const grain = bg.getImageData(0,0,background.width,background.height);
  for(let i=0;i<grain.data.length;i+=4) {
    const noise=(rng()-.5)*3;
    grain.data[i]+=noise; grain.data[i+1]+=noise; grain.data[i+2]+=noise;
  }
  bg.putImageData(grain,0,0);
}
function resize() {
  const bounds=canvas.getBoundingClientRect();
  width=bounds.width; height=bounds.height; pixelRatio=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*pixelRatio); canvas.height=Math.round(height*pixelRatio);
  scale=Math.min(width/650,height/850);
  flock.resize(width/scale,height/scale);
  clearPointer();
  paintBackground(); draw(1);
}
function bird(b, old, alpha) {
  const x=(old.x+(b.x-old.x)*alpha)*scale,y=(old.y+(b.y-old.y)*alpha)*scale;
  const heading=Math.atan2(b.vy,b.vx), time=(flock.tick+alpha)/120;
  const flap=Math.sin(time*(7+b.depth*2)+b.phase);
  const size=(1.5+b.depth*1.3)*scale;
  ctx.save(); ctx.translate(x,y);
  ctx.rotate(heading + Math.PI / 2);
  const bank=b.bank, wing=.35+flap*1.25;
  ctx.strokeStyle=`rgba(37,42,59,${.48+b.depth*.42})`;
  ctx.lineWidth=Math.max(.65,size*.45); ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(-size*2.1,-size*wing*(1+bank));
  ctx.quadraticCurveTo(-size*.95,-size*(.1+flap*.35),0,0);
  ctx.quadraticCurveTo(size*.95,-size*(.1+flap*.35),size*2.1,-size*wing*(1-bank));
  ctx.stroke();
  ctx.lineWidth=Math.max(.6,size*.52); ctx.beginPath(); ctx.moveTo(0,-size*.5);ctx.lineTo(-size*.12,size*.65);ctx.stroke();
  ctx.restore();
}
function draw(alpha) {
  ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(background,0,0);
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  for(let i=0;i<flock.birds.length;i++) bird(flock.birds[i],flock.previous[i],alpha);

}
function frame(now) {
  request=0;
  if(paused||about.open||document.hidden) { last=null; return; }
  const elapsed=last===null?0:(now-last)/1000; last=now;
  const alpha=clock.advance(elapsed,()=>pointer);
  draw(alpha); request=requestAnimationFrame(frame);
}
function sync() {
  cancelAnimationFrame(request); request=0; last=null; clock.clear();
  motionNote.hidden=!paused;
  if(!paused&&!about.open&&!document.hidden) request=requestAnimationFrame(frame);
  else draw(1);
}
function hideContact() {
  clearTimeout(contactTimer);
  contactTimer=null;
  contact.classList.remove('is-visible','is-active');
}
function clearPointer() { pointer=null; pointerId=null; hideContact(); }
function endPointer(event) {
  if(pointerId!==null) {
    if(event.pointerId!==pointerId) return;
    pointer=null; pointerId=null;
    contact.classList.remove('is-active');
    if(event.type==='pointerup') contactTimer=setTimeout(hideContact,260);
    else hideContact();
  } else if(event.type==='pointerleave'&&event.pointerType==='mouse') clearPointer();
}
function move(event) {
  if(about.open) return;
  if(pointerId!==null&&event.pointerId!==pointerId) return;
  if(event.pointerType==='touch'&&pointerId===null) return;
  const bounds=canvas.getBoundingClientRect();
  const x=event.clientX-bounds.left,y=event.clientY-bounds.top;
  if(x<0||x>bounds.width||y<0||y>bounds.height) {pointer=null;hideContact();return;}
  pointer={x:x*width/bounds.width/scale,y:y*height/bounds.height/scale,active:true};
  if(pointerId!==null) {
    clearTimeout(contactTimer);contactTimer=null;
    contact.style.left=x+'px';contact.style.top=y+'px';
    contact.classList.add('is-visible','is-active');
  }
}
canvas.addEventListener('pointerdown',event=>{
  if(about.open) return;
  if(pointerId!==null) return;
  event.preventDefault();
  pointerId=event.pointerId;
  move(event);
  try { canvas.setPointerCapture(event.pointerId); } catch {}
});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('selectstart',event=>event.preventDefault());
canvas.addEventListener('pointermove',move);
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('lostpointercapture',endPointer);
canvas.addEventListener('pointerleave',endPointer);
window.addEventListener('pointerup',endPointer);
window.addEventListener('pointercancel',endPointer);
window.addEventListener('blur',clearPointer);
reduced.addEventListener('change',()=>{paused=reduced.matches;clearPointer();sync();});
document.addEventListener('visibilitychange',()=>{clearPointer();sync();});
openAbout.addEventListener('click',()=>{clearPointer();about.showModal();sync();});
document.querySelector('#close-about').addEventListener('click',()=>about.close());
about.addEventListener('close',()=>{sync();openAbout.focus();});
about.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey) return;
  const items=[...about.querySelectorAll('button,a[href]')];
  const index=items.indexOf(document.activeElement);
  const next=event.shiftKey?(index<=0?items.length-1:index-1):(index+1)%items.length;
  event.preventDefault();items[next].focus();
});
about.addEventListener('click',event=>{
  if(event.target!==about) return;
  const bounds=about.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom) about.close();
});
window.addEventListener('resize',resize);
resize(); sync();
