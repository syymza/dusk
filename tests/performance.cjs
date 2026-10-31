const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');const fs=require('node:fs');
const out=require('node:path').resolve('test-results/performance');fs.mkdirSync(out,{recursive:true});
const percentile=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*p))]||0};
const summary=a=>({n:a.length,p50:percentile(a,.5),p95:percentile(a,.95),p99:percentile(a,.99),max:Math.max(0,...a)});
(async()=>{
const results=[];
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const rate of name==='chromium'?[1,4]:[1])for(const count of [200,500]){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});const page=await context.newPage();
  await page.route('**/simulation.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('count = 500','count = '+count)});});
  await page.route('**/app.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text())+`\n{
   globalThis.metrics={active:false,steps:[],draws:[],frames:[],input:[]};
   const step=flock.step.bind(flock);flock.step=(...args)=>{const t=performance.now();step(...args);if(metrics.active)metrics.steps.push(performance.now()-t)};
   const originalDraw=draw;draw=(...args)=>{const t=performance.now();originalDraw(...args);if(metrics.active)metrics.draws.push(performance.now()-t)};
   let lastFrame=null;function measure(t){if(metrics.active&&lastFrame!==null)metrics.frames.push(t-lastFrame);lastFrame=metrics.active?t:null;requestAnimationFrame(measure)}requestAnimationFrame(measure);
   canvas.addEventListener('pointerdown',()=>{const t=performance.now();function visible(){if(Number(getComputedStyle(contact).opacity)>.05){metrics.input.push(performance.now()-t);return;}requestAnimationFrame(visible)}requestAnimationFrame(visible)});
   globalThis.benchmarkState=()=>({tick:flock.tick,count:flock.birds.length});
  }`});});
  const cdp=name==='chromium'?await context.newCDPSession(page):null;if(cdp&&rate!==1)await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  await page.goto('http://127.0.0.1:43179');await page.waitForTimeout(1200);await page.evaluate(()=>metrics.active=true);
  for(let i=0;i<3;i++){await page.touchscreen.tap(195+i*15,350);await page.waitForTimeout(200);}
  if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:170,y:370}]});for(let i=0;i<45;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:130+i*3.2,y:370+Math.sin(i/12)*35}]});await page.waitForTimeout(55)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else {await page.mouse.move(150,370);await page.mouse.down();for(let i=0;i<45;i++){await page.mouse.move(130+i*3.2,370+Math.sin(i/12)*35);await page.waitForTimeout(55)}await page.mouse.up();}
  await page.waitForTimeout(1800);const m=await page.evaluate(()=>{metrics.active=false;return {metrics,state:benchmarkState()}});
  const gaps=m.metrics.frames;const row={engine:name,version:browser.version(),count,throttle:rate,frames:summary(gaps),fps:gaps.length*1000/gaps.reduce((a,b)=>a+b,0),over25ms:gaps.filter(x=>x>25).length/gaps.length*100,stepMs:summary(m.metrics.steps),drawMs:summary(m.metrics.draws),inputMs:summary(m.metrics.input),state:m.state};
  results.push(row);console.log(JSON.stringify(row));await context.close();
 }
 await browser.close();
}
fs.writeFileSync(out+'/performance.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
