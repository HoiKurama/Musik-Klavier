import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.mp3':'audio/mpeg','.musicxml':'application/xml','.md':'text/markdown'};
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'}).end(content);}catch{res.writeHead(404).end();}
});
await new Promise((done,reject)=>{server.on('error',reject);server.listen(5174,'127.0.0.1',done);});
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const external=[];const missing=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin==='http://127.0.0.1:5174')return route.continue();external.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))missing.push(response.url());});
  await page.goto('http://127.0.0.1:5174',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('#play').disabled);
  assert.equal(await page.locator('#title').textContent(),'Kleine Klavierzeit');assert.equal(await page.locator('#score svg').count()>0,true);
  await page.locator('#step').click();await page.locator('[data-midi="48"]').click();await page.locator('[data-midi="60"]').click();assert.match(await page.locator('#target').textContent(),/Gesucht: D4/);
  await page.locator('#listen').click();await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#play').textContent.includes('Pause'));await page.waitForFunction(()=>document.querySelectorAll('.piano-key.sounding').length>0);await page.locator('#play').click();assert.match(await page.locator('#play').textContent(),/Fortsetzen/);
  assert.equal((await context.request.get('http://127.0.0.1:5174/THIRD_PARTY_NOTICES.md')).status(),200);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#extensions>.control-section').last().evaluate(el=>getComputedStyle(el).display),'block','Fortschrittsbereich bleibt auf Mobilgeräten lesbar');
  await page.screenshot({path:'test-results/production-mobile.png',fullPage:true});
  assert.deepEqual(external,[],'Normale Nutzung benötigt keine externe Netzwerkverbindung');assert.deepEqual(missing,[],'Alle App-Assets vorhanden');
  console.log('Produktionsbuild: Beispiel, Noten, Schrittmodus, lokale Klangwiedergabe, Pause und Lizenzdatei bestanden. Externes Netzwerk gesperrt; keine externen Anfragen.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
