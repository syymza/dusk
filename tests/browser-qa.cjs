const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const out=require('node:path').resolve('test-results/browser');
fs.mkdirSync(out,{recursive:true});
const url=process.env.DUSK_URL || 'http://127.0.0.1:43179';
const pixels=page=>page.locator('canvas').evaluate(el=>el.toDataURL());
async function openAbout(page) {
 await page.getByRole('button',{name:'About',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('dialog').open&&document.activeElement.id==='close-about');
}
async function closed(page) {
 await page.waitForFunction(()=>!document.querySelector('dialog').open&&document.activeElement.id==='open-about');
}
(async()=>{
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
 const browser=await engine.launch({headless:true});console.log(name,browser.version());
 for(const [layout,options] of [['phone',{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}],['desktop',{viewport:{width:1440,height:900},deviceScaleFactor:1}]]) {
  const context=await browser.newContext(options),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  assert.equal((await page.goto(url)).status(),200);await page.waitForTimeout(500);
  assert.equal(await page.getByRole('button',{name:/^(Pause|Play|Reset)$/}).count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
  await page.screenshot({path:`${out}/${name}-${layout}.png`});
  await openAbout(page);
  const frozen=await pixels(page);await page.waitForTimeout(180);assert.equal(await pixels(page),frozen,'reading holds simulation still');
  const modal=await page.locator('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,select:getComputedStyle(el).userSelect||getComputedStyle(el).webkitUserSelect}});
  assert.ok(modal.x>=0&&modal.y>=0&&modal.x+modal.w<=options.viewport.width+1&&modal.y+modal.h<=options.viewport.height+1);assert.equal(modal.select,'text');
  assert.equal(await page.locator('dialog a').getAttribute('href'),'https://www.red3d.com/cwr/boids/');
  assert.ok(await page.locator('dialog p').first().evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))),'modal text retains its context menu');
  for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));}
  await page.keyboard.press('Shift+Tab');assert.ok(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));
  await page.dispatchEvent('canvas','pointerdown',{pointerId:999,pointerType:'touch',clientX:150,clientY:300});
  assert.equal(await page.locator('#contact').evaluate(el=>el.classList.contains('is-active')),false,'modal prevents background input');
  await page.screenshot({path:`${out}/${name}-${layout}-about.png`});
  await page.getByRole('button',{name:'Close about'}).click();await closed(page);
  await page.waitForTimeout(180);assert.notEqual(await pixels(page),frozen,'motion resumes after reading');
  await openAbout(page);await page.keyboard.press('Escape');await closed(page);
  await openAbout(page);await page.mouse.click(5,5);await closed(page);
  if(layout==='phone') {
   await page.touchscreen.tap(195,580);await page.waitForTimeout(70);assert.ok(await page.locator('#contact').evaluate(el=>Number(getComputedStyle(el).opacity)>.1));await page.waitForTimeout(500);
   if(name==='chromium') {
    const cdp=await context.newCDPSession(page),primary={x:180,y:370,id:1};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[primary]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[primary,{x:250,y:450,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[primary]});
    for(let i=0;i<25;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:140+i*4,y:360+Math.sin(i/7)*40}]});await page.waitForTimeout(25);}
    await page.waitForTimeout(850);assert.ok(await page.locator('#contact').evaluate(el=>el.classList.contains('is-active')));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   } else {
    await page.evaluate(()=>{window.primaryId=null;document.querySelector('canvas').addEventListener('pointerdown',e=>{if(primaryId===null)primaryId=e.pointerId})});
    await page.mouse.move(180,370);await page.mouse.down();const primaryId=await page.evaluate(()=>primaryId);
    await page.dispatchEvent('canvas','pointerdown',{pointerId:999,pointerType:'touch',clientX:250,clientY:450});await page.dispatchEvent('canvas','pointerup',{pointerId:999,pointerType:'touch'});
    for(let i=0;i<25;i++){await page.dispatchEvent('canvas','pointermove',{pointerId:primaryId,pointerType:'touch',clientX:140+i*4,clientY:360+Math.sin(i/7)*40});await page.waitForTimeout(25);}
    assert.ok(await page.locator('#contact').evaluate(el=>el.classList.contains('is-active')));
    await page.dispatchEvent('canvas','pointercancel',{pointerId:primaryId,pointerType:'touch'});await page.mouse.up();
   }
   assert.equal(await page.locator('#contact').evaluate(el=>el.classList.contains('is-visible')),false);
  }
  assert.deepEqual(errors,[]);await context.close();console.log(`${name} ${layout}: About focus/close/pause/selectability, absent Pause/Reset, input regression PASS`);
 }
 const reduced=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const page=await reduced.newPage();await page.goto(url);const still=await pixels(page);
 await page.touchscreen.tap(195,500);await page.waitForTimeout(70);assert.ok(await page.locator('#contact').evaluate(el=>Number(getComputedStyle(el).opacity)>.1));assert.equal(await pixels(page),still);
 await openAbout(page);assert.equal(await page.locator('#motion-note').evaluate(el=>el.hidden),false);
 await page.getByRole('button',{name:'Close about'}).click();await closed(page);await page.waitForTimeout(180);assert.equal(await pixels(page),still,'Reduce Motion remains still after reading');
 await openAbout(page);await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(180);assert.equal(await pixels(page),still,'preference change cannot resume behind modal');
 await page.getByRole('button',{name:'Close about'}).click();await closed(page);await page.waitForTimeout(180);assert.notEqual(await pixels(page),still);
 await page.setViewportSize({width:844,height:390});await openAbout(page);await page.screenshot({path:`${out}/${name}-landscape-about.png`});
 assert.ok(await page.locator('dialog').evaluate(el=>el.getBoundingClientRect().height<=innerHeight-20));await reduced.close();console.log(`${name}: reduced-motion preservation, preference change and landscape modal PASS`);
 for(const dpr of [1,2,3])for(const [w,h] of [[390,844],[844,390]]) {
  const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});const page=await context.newPage();await page.goto(url);
  const x=Math.round(w*.35),y=Math.round(h*.55);await page.touchscreen.tap(x,y);await page.waitForTimeout(70);
  const c=await page.locator('#contact').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,opacity:Number(getComputedStyle(el).opacity)}});
  assert.ok(c.opacity>.1);assert.ok(Math.abs(c.x-x)<.6&&Math.abs(c.y-y)<.6);
  const guard=await page.locator('canvas').evaluate(el=>({select:getComputedStyle(el).userSelect||getComputedStyle(el).webkitUserSelect,menuPrevented:!el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))}));assert.equal(guard.select,'none');assert.ok(guard.menuPrevented);
  assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(await page.locator('meta[name=viewport]').getAttribute('content')));
  await context.close();console.log(`${name} ${w}x${h} DPR${dpr}: native tap coordinates and sky guards PASS`);
 }
 await browser.close();
}
})().catch(e=>{console.error(e);process.exit(1)});
