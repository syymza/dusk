const {chromium,webkit,devices}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const out=require('node:path').resolve('test-results/browser');
fs.mkdirSync(out,{recursive:true});
(async()=>{
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
 const browser=await engine.launch({headless:true});
 console.log(name,browser.version());
 for(const [layout,options] of [['phone',{...devices['iPhone 13'],defaultBrowserType:undefined}],['desktop',{viewport:{width:1440,height:900},deviceScaleFactor:1}]]) {
  const context=await browser.newContext(options);
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(process.env.DUSK_URL || 'http://127.0.0.1:43179');assert.equal(response.status(),200);
  await page.waitForTimeout(2200);
  await page.screenshot({path:`${out}/${name}-${layout}.png`});
  const bounds=await page.locator('canvas').boundingBox();assert.equal(bounds.width,options.viewport.width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight));
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const before=await page.locator('canvas').evaluate(el=>el.toDataURL());await page.waitForTimeout(150);
  assert.deepEqual(before,await page.locator('canvas').evaluate(el=>el.toDataURL()));
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  if(layout==='phone') {
   await page.touchscreen.tap(195,340);
   await page.waitForTimeout(70);
   assert.ok(await page.locator('#contact').evaluate(el=>getComputedStyle(el).opacity>0),'native tap is visibly acknowledged');
   await page.waitForTimeout(500);
   if(name==='chromium') {
    const cdp=await context.newCDPSession(page);
    const primary={x:100,y:330,id:1};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[primary]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[primary,{x:250,y:420,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[primary]});
    for(let i=0;i<30;i++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:80+i*8,y:320+Math.sin(i/6)*90,id:1}]});await page.waitForTimeout(20);}
    await page.waitForTimeout(850);
    assert.ok(await page.locator('#contact').evaluate(el=>el.classList.contains('is-active')),'primary touch stays active after second finger lifts and sustained hold');
    assert.equal(await page.evaluate(()=>getSelection().toString()),'');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   } else {
    // WebKit exposes native tap only; back synthetic touch lifecycle with a captured native mouse pointer.
    await page.evaluate(()=>{window.primaryId=null;document.querySelector('canvas').addEventListener('pointerdown',e=>{if(window.primaryId===null)window.primaryId=e.pointerId})});
    await page.mouse.move(100,330);await page.mouse.down();
    const primaryId=await page.evaluate(()=>window.primaryId);
    await page.dispatchEvent('canvas','pointerdown',{pointerId:999,pointerType:'touch',clientX:250,clientY:420});
    await page.dispatchEvent('canvas','pointerup',{pointerId:999,pointerType:'touch',clientX:250,clientY:420});
    for(let i=0;i<30;i++){await page.dispatchEvent('canvas','pointermove',{pointerId:primaryId,pointerType:'touch',clientX:80+i*8,clientY:320+Math.sin(i/6)*90});await page.waitForTimeout(20);}
    await page.waitForTimeout(850);
    assert.ok(await page.locator('#contact').evaluate(el=>el.classList.contains('is-active')),'synthetic touch hold remains active');
    await page.dispatchEvent('canvas','pointercancel',{pointerId:primaryId,pointerType:'touch'});
    await page.mouse.up();
   }
   assert.equal(await page.locator('#contact').evaluate(el=>el.classList.contains('is-visible')),false,'cancellation clears contact feedback');
  } else {await page.mouse.move(720,430);await page.mouse.move(1040,500,{steps:40});await page.mouse.move(-10,-10);}
  await page.waitForTimeout(1200);
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`${name} ${layout}: load, bounds, no-scroll, pause/resume/reset, ${layout==='phone'?(name==='chromium'?'native two-finger drag/cancel':'native tap + synthetic two-finger drag/cancel'):'pointer/leave'}, no page errors PASS`);
 }
 const reduced=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const page=await reduced.newPage();await page.goto(process.env.DUSK_URL || 'http://127.0.0.1:43179');
 assert.equal(await page.getByRole('button',{name:'Play',exact:true}).count(),1);
 const before=await page.locator('canvas').evaluate(el=>el.toDataURL());await page.touchscreen.tap(195,500);await page.waitForTimeout(70);
 assert.ok(await page.locator('#contact').evaluate(el=>getComputedStyle(el).opacity>0),'paused scene still acknowledges native taps');
 assert.equal(await page.getByRole('button',{name:'Play',exact:true}).count(),1);
 assert.deepEqual(before,await page.locator('canvas').evaluate(el=>el.toDataURL()));
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);
 await reduced.close();console.log(`${name} reduced motion feedback and landscape resize PASS`);
 for(const dpr of [1,2,3])for(const [w,h] of [[390,844],[844,390]]) {
  const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto(process.env.DUSK_URL || 'http://127.0.0.1:43179');
  const x=Math.round(w*.35),y=Math.round(h*.55);
  await page.touchscreen.tap(x,y);await page.waitForTimeout(70);
  const contact=await page.locator('#contact').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,opacity:Number(getComputedStyle(el).opacity)}});
  assert.ok(contact.opacity>.1);assert.ok(Math.abs(contact.x-x)<.6&&Math.abs(contact.y-y)<.6);
  const guard=await page.locator('canvas').evaluate(el=>({select:getComputedStyle(el).userSelect||getComputedStyle(el).webkitUserSelect,callout:getComputedStyle(el).getPropertyValue('-webkit-touch-callout'),calloutSupported:CSS.supports('-webkit-touch-callout','none'),menuPrevented:!el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})),selectionPrevented:!el.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true}))}));
  assert.equal(guard.select,'none');if(guard.calloutSupported)assert.equal(guard.callout,'none');else if(name==='webkit'&&dpr===1&&w===390)console.log('WebKit macOS does not expose iOS touch-callout CSS; device callout behavior is unverified');assert.ok(guard.menuPrevented&&guard.selectionPrevented);
  assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(await page.locator('meta[name=viewport]').getAttribute('content')));
  await context.close();console.log(`${name} ${w}x${h} DPR${dpr}: native tap feedback, coordinates and selection guards PASS`);
 }
 await browser.close();
}
})().catch(e=>{console.error(e);process.exit(1)});
