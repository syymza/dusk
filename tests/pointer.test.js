import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { Flock, FixedClock, random } from '../simulation.js';
const app = (await readFile(new URL('../app.js', import.meta.url),'utf8')).replace(/^import .*;\n/,'');
function harness() {
  const events = new Map(), windowEvents = new Map();
  const gradient = {addColorStop(){}};
  const context = new Proxy({}, {get:(_,key)=>key==='getImageData'?()=>({data:new Uint8ClampedArray(0)}):key.startsWith('create')?()=>gradient:()=>{}});
  const element = () => ({addEventListener(){},setAttribute(){},getContext:()=>context});
  const canvas = {...element(),setPointerCapture(){},addEventListener:(name,fn)=>events.set(name,fn)};
  const sandbox = {Flock,FixedClock,random,innerWidth:390,innerHeight:844,devicePixelRatio:1,requestAnimationFrame:()=>1,cancelAnimationFrame(){},matchMedia:()=>({matches:false,addEventListener(){}}),window:{addEventListener:(name,fn)=>windowEvents.set(name,fn)},document:{hidden:false,querySelector:selector=>selector==='#sky'?canvas:element(),createElement:element,addEventListener(){}}};
  runInNewContext(app+'\nglobalThis.state=()=>({pointer,pointerId});',sandbox);
  const send = (name,id,x=100) => events.get(name)({pointerId:id,pointerType:'touch',clientX:x,clientY:300});
  return {send,state:sandbox.state,blur:()=>windowEvents.get('blur')()};
}
for(const ending of ['pointerup','pointercancel','lostpointercapture','pointerleave']) {
  test(`a second finger's ${ending} preserves the active drag`,()=>{
    const h=harness();h.send('pointerdown',1);h.send('pointerdown',2);h.send(ending,2);h.send('pointermove',1,200);
    assert.equal(h.state().pointerId,1);assert.ok(h.state().pointer?.active);assert.ok(h.state().pointer.x>300);
    h.send(ending,1);assert.equal(h.state().pointerId,null);assert.equal(h.state().pointer,null);
    h.send('pointermove',1);assert.equal(h.state().pointer,null);
  });
}
test('window blur releases the active pointer and outside movement stops avoidance',()=>{
  const h=harness();h.send('pointerdown',1);h.send('pointermove',1,-5);assert.equal(h.state().pointer,null);
  h.send('pointermove',1,120);assert.ok(h.state().pointer?.active);h.blur();assert.equal(h.state().pointerId,null);assert.equal(h.state().pointer,null);
});
