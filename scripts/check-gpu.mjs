import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--enable-unsafe-webgpu','--hide-scrollbars','--force-color-profile=srgb','--disable-background-timer-throttling','--disable-renderer-backgrounding'],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.setContent(`<html><body style="margin:0;background:#000"><canvas id=c width=1920 height=1080></canvas></body></html>`);
const info = await page.evaluate(() => {
  const c = document.getElementById('c'); const gl = c.getContext('webgl2', {preserveDrawingBuffer:true, antialias:true});
  if (!gl) return {webgl2:false};
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {webgl2:true, renderer: ext? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL): gl.getParameter(gl.RENDERER), vendor: ext? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):'', floatRT: !!gl.getExtension('EXT_color_buffer_float'), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE)};
});
console.log(info);
// screenshot timing
await page.evaluate(() => { const c=document.getElementById('c'); const gl=c.getContext('webgl2'); gl.clearColor(0.1,0.5,0.4,1); gl.clear(gl.COLOR_BUFFER_BIT); });
const cdp = await page.createCDPSession();
let t0 = Date.now();
for (let i=0;i<10;i++){ await page.screenshot({type:'png', clip:{x:0,y:0,width:1920,height:1080}}); }
console.log('puppeteer png avg ms', (Date.now()-t0)/10);
t0 = Date.now();
for (let i=0;i<10;i++){ await cdp.send('Page.captureScreenshot',{format:'png', optimizeForSpeed:true, clip:{x:0,y:0,width:1920,height:1080,scale:1}}); }
console.log('cdp png optimizeForSpeed avg ms', (Date.now()-t0)/10);
t0 = Date.now();
for (let i=0;i<10;i++){ await cdp.send('Page.captureScreenshot',{format:'jpeg', quality:95, optimizeForSpeed:true}); }
console.log('cdp jpeg95 avg ms', (Date.now()-t0)/10);
await browser.close();
