import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { Flock, FixedClock, random } from '../simulation.js';
const app = (await readFile(new URL('../app.js', import.meta.url),'utf8')).replace(/^import .*;\n/,'');
function harness({reduced=false,captureError=false,left=0,top=0}={}) {
  const events = new Map(), windowEvents = new Map(), timers = new Map(), classes = new Set();
  let time=0, timerId=0;
  const gradient = {addColorStop(){}};
  const context = new Proxy({}, {get:(_,key)=>key==='getImageData'?()=>({data:new Uint8ClampedArray(0)}):key.startsWith('create')?()=>gradient:()=>{}});
  const element = () => ({style:{},classList:{add(){},remove(){}},addEventListener(){},setAttribute(){},getContext:()=>context});
  const contact={...element(),classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n))}};
  const canvas = {...element(),getBoundingClientRect:()=>({left,top,width:390,height:844}),setPointerCapture(){if(captureError)throw new Error('capture unavailable')},addEventListener:(name,fn)=>events.set(name,fn)};
  const sandbox = {Flock,FixedClock,random,devicePixelRatio:3,setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,due:time+delay});return id},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>1,cancelAnimationFrame(){},matchMedia:()=>({matches:reduced,addEventListener(){}}),window:{addEventListener:(name,fn)=>windowEvents.set(name,fn)},document:{hidden:false,querySelector:selector=>selector==='#sky'?canvas:selector==='#contact'?contact:element(),createElement:element,addEventListener(){}}};
  runInNewContext(app+'\nglobalThis.state=()=>({pointer,pointerId,paused});',sandbox);
  const send = (type,id,x=100,y=300) => events.get(type)({type,pointerId:id,pointerType:'touch',clientX:x,clientY:y,preventDefault(){}});
  const advance=ms=>{time+=ms;for(const [id,t] of timers)if(t.due<=time){timers.delete(id);t.fn()}};
  return {send,advance,classes,contact,events,state:sandbox.state,windowEvents,blur:()=>windowEvents.get('blur')()};
}
for(const ending of ['pointerup','pointercancel','lostpointercapture','pointerleave']) {
  test(`a second finger's ${ending} preserves the active drag`,()=>{
    const h=harness();h.send('pointerdown',1);h.send('pointerdown',2);h.send(ending,2);h.send('pointermove',1,200);
    assert.equal(h.state().pointerId,1);assert.ok(h.state().pointer?.active);assert.ok(h.state().pointer.x>300);assert.ok(h.classes.has('is-active'));
    h.send(ending,1);assert.equal(h.state().pointerId,null);assert.equal(h.state().pointer,null);
    h.send('pointermove',1);assert.equal(h.state().pointer,null);
  });
}
test('a complete tap without any animation frame remains visible after release and lost capture',()=>{
  const h=harness();h.send('pointerdown',1);h.send('pointerup',1);h.send('lostpointercapture',1);
  assert.ok(h.classes.has('is-visible'));assert.ok(!h.classes.has('is-active'));assert.equal(h.state().pointer,null);
  h.advance(200);assert.ok(h.classes.has('is-visible'));h.advance(100);assert.ok(!h.classes.has('is-visible'));
});
test('reduced motion keeps birds paused while showing touch feedback',()=>{
  const h=harness({reduced:true});h.send('pointerdown',1);assert.ok(h.classes.has('is-visible'));assert.equal(h.state().paused,true);
  h.send('pointerup',1);assert.ok(h.classes.has('is-visible'));assert.equal(h.state().paused,true);
});
test('capture failure still acknowledges input; window release terminates avoidance',()=>{
  const h=harness({captureError:true});h.send('pointerdown',1);assert.ok(h.classes.has('is-visible'));assert.ok(h.state().pointer.active);
  h.windowEvents.get('pointerup')({type:'pointerup',pointerId:1});assert.equal(h.state().pointer,null);
});
test('canvas offset is removed before converting CSS coordinates to simulation coordinates',()=>{
  const h=harness({left:30,top:50});h.send('pointerdown',1,150,350);
  assert.equal(h.contact.style.left,'120px');assert.equal(h.contact.style.top,'300px');assert.equal(h.state().pointer.x,200);assert.equal(h.state().pointer.y,500);
});
test('context menu and selection are prevented only on the canvas',()=>{
  const h=harness();let prevented=0;
  for(const type of ['contextmenu','selectstart'])h.events.get(type)({preventDefault:()=>prevented++});
  assert.equal(prevented,2);assert.ok(!h.windowEvents.has('contextmenu'));assert.ok(!h.windowEvents.has('selectstart'));
});
test('window blur releases the active pointer and outside movement stops avoidance',()=>{
  const h=harness();h.send('pointerdown',1);h.send('pointermove',1,-5);assert.equal(h.state().pointer,null);assert.ok(!h.classes.has('is-visible'));
  h.send('pointermove',1,120);assert.ok(h.state().pointer?.active);h.blur();assert.equal(h.state().pointerId,null);assert.equal(h.state().pointer,null);assert.ok(!h.classes.has('is-visible'));
});
