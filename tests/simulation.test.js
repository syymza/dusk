import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Flock, FixedClock } from '../simulation.js';
const gesture = t => t >= 2 && t < 6 ? { active:true,x:250+(t-2)*100,y:340+Math.sin(t*2)*90 } : null;
function replay(fps) {
  const flock=new Flock(1000,700); const clock=new FixedClock(flock); const trajectory=[];
  for(let frame=0;frame<fps*12;frame++) {
    clock.advance(1/fps,gesture);
    if((frame+1)%fps===0) trajectory.push(flock.birds.map(({x,y,vx,vy})=>[x,y,vx,vy]));
  }
  return {flock,trajectory};
}
test('default flock contains 500 birds after reset',()=>{const flock=new Flock();assert.equal(flock.birds.length,500);flock.step();flock.reset();assert.equal(flock.birds.length,500);});
test('scripted continuous gesture has identical 30 and 120 fps trajectories at every second',()=>{
  const slow=replay(30), fast=replay(120);
  assert.equal(slow.flock.tick,1440); assert.equal(fast.flock.tick,1440);
  assert.deepEqual(slow.trajectory,fast.trajectory);
});
test('reset restores seeded initial state; resize remains finite and within bounds',()=>{
  const flock=new Flock();const initial=structuredClone(flock.birds);
  for(let i=0;i<300;i++)flock.step(gesture(i/120));
  flock.reset();assert.deepEqual(flock.birds,initial);
  flock.resize(650,1400);
  for(const b of flock.birds)assert.ok(b.x>=0&&b.x<=650&&b.y>=0&&b.y<=1400);
});
test('two simulated minutes with repeated perturbations stay bounded and regroup',()=>{
  const flock=new Flock(650,1400);let maxSpeed=0,maxRadius=0;
  for(let i=0;i<14400;i++) {
    const t=i/120;
    flock.step(t<40?{active:true,x:325+Math.sin(t)*250,y:550+Math.cos(t*.7)*220}:null);
    for(const b of flock.birds) {
      assert.ok([b.x,b.y,b.vx,b.vy].every(Number.isFinite));
      assert.ok(b.x>0&&b.x<650&&b.y>0&&b.y<1400);
      maxSpeed=Math.max(maxSpeed,Math.hypot(b.vx,b.vy));
    }
  }
  const n=flock.birds.length;
  const cx=flock.birds.reduce((s,b)=>s+b.x,0)/n,cy=flock.birds.reduce((s,b)=>s+b.y,0)/n;
  for(const b of flock.birds)maxRadius=Math.max(maxRadius,Math.hypot(b.x-cx,b.y-cy));
  assert.ok(maxSpeed<=78.000001); assert.ok(maxRadius<300,`regrouped radius ${maxRadius}`);
});
test('pointer avoidance changes trajectories without exceeding speed limits',()=>{
  const base=new Flock(), touched=new Flock();
  for(let i=0;i<240;i++){base.step();touched.step({active:true,x:500,y:300});}
  assert.notDeepEqual(base.birds,touched.birds);
  assert.ok(touched.birds.every(b=>Math.hypot(b.vx,b.vy)<=78.000001));
});
test('clock drops long hidden-tab gaps and can discard residual time',()=>{
  const f=new Flock(),c=new FixedClock(f);
  c.advance(30);assert.equal(f.tick,12);
  c.advance(.004);c.clear();c.advance(1/120);assert.equal(f.tick,13);
});
