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
  const before=await page.locator('canvas').screenshot();await page.waitForTimeout(150);
  assert.deepEqual(before,await page.locator('canvas').screenshot());
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.getByRole('button',{name:'Begin again',exact:true}).click();
  if(layout==='phone') {
   await page.touchscreen.tap(195,340);
   if(name==='chromium') {
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:330}]});
    for(let i=0;i<30;i++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:80+i*8,y:320+Math.sin(i/6)*90}]});await page.waitForTimeout(20);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   }
  } else {await page.mouse.move(720,430);await page.mouse.move(1040,500,{steps:40});await page.mouse.move(-10,-10);}
  await page.waitForTimeout(1200);
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`${name} ${layout}: load, bounds, no-scroll, pause/resume/reset, ${layout==='phone'?(name==='chromium'?'touch drag/cancel':'touch tap'):'pointer/leave'}, no page errors PASS`);
 }
 const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await reduced.newPage();await page.goto(process.env.DUSK_URL || 'http://127.0.0.1:43179');
 assert.equal(await page.getByRole('button',{name:'Play',exact:true}).count(),1);
 const before=await page.locator('canvas').screenshot();await page.waitForTimeout(200);assert.deepEqual(before,await page.locator('canvas').screenshot());
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);
 await reduced.close();await browser.close();console.log(`${name} reduced motion and landscape resize PASS`);
}
})().catch(e=>{console.error(e);process.exit(1)});
