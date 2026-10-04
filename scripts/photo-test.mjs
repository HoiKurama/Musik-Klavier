// Fotoerkennung im Browser mit simulierter Anthropic-API (keine echten Anfragen, keine Kosten).
// Vorher `npm.cmd run dev` starten.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const BASE = process.env.KLAVIER_URL ?? 'http://127.0.0.1:5173';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const KEY = 'sk-ant-test-0000000000000000';
const note = (pitches, duration = 'quarter', extra = {}) => ({ pitches, duration, dots: 0, triplet: false, tie: false, ...extra });
const recognized = { readable: true, problem: 'Takt 2 ist leicht unscharf.', title: 'Testlied', composer: 'Test', tempo: 100, upperClef: 'G', lowerClef: 'F', measures: [
  { fifths: 1, beats: 4, beatType: 4, upper: [[note(['C4', 'E4', 'G4']), note(['F#4']), note(['G4'], 'half', { tie: true })]], lower: [[note(['C3'], 'whole')]] },
  { fifths: 1, beats: 4, beatType: 4, upper: [[note(['G4'], 'half'), note(['A4'], 'eighth'), note(['B4'], 'eighth'), note([], 'quarter')]], lower: [[note(['G2'], 'half'), note(['D3'], 'half')]] },
] };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const sse = text => { const chunks = text.match(/.{1,80}/gs); const events = [
  ['message_start', { type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 6000, output_tokens: 1 } } }],
  ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
  ...chunks.map(chunk => ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: chunk } }]),
  ['content_block_stop', { type: 'content_block_stop', index: 0 }],
  ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 9000 } }],
  ['message_stop', { type: 'message_stop' }],
]; return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''); };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
const requests = [];
let mode = 'ok';
await context.route('https://api.anthropic.com/**', async route => {
  const request = route.request();
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  requests.push({ headers: request.headers(), body: request.postDataJSON() });
  if (mode === 'auth') return route.fulfill({ status: 401, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
  if (mode === 'slow') { await new Promise(done => setTimeout(done, 3000)); return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sse(JSON.stringify(recognized)) }).catch(() => {}); }
  return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sse(JSON.stringify(recognized)) });
});
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
const ready = () => page.waitForFunction(() => window.__practice?.engine && !window.__practice.busy, null, { timeout: 60000 });
const status = () => page.locator('#photo-status').textContent();
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await ready();
  assert.equal(await page.locator('#photo-settings').getAttribute('open'), null, 'Fotoerkennung beginnt eingeklappt');
  await page.locator('#file').setInputFiles({ name: 'seite.png', mimeType: 'image/png', buffer: PNG });
  assert.match(await status(), /API-Schlüssel eintragen/); assert.notEqual(await page.locator('#photo-settings').getAttribute('open'), null, 'Ohne Schlüssel öffnen sich die Einstellungen');
  assert.equal(requests.length, 0);
  await page.locator('#api-key').fill('falsch'); await page.locator('#api-key-save').click();
  assert.match(await page.locator('#api-key-state').textContent(), /sk-ant-/); assert.equal(requests.length, 0);
  await page.locator('#api-key').fill(KEY); await page.locator('#api-key-save').click();
  await page.waitForFunction(() => document.querySelector('#photo-status').textContent.startsWith('Fertig'), null, { timeout: 30000 }); await ready();
  const [request] = requests;
  assert.equal(request.headers['x-api-key'], KEY); assert.equal(request.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.match(request.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(request.body.model, 'claude-opus-5-5'); assert.equal(request.body.fallbacks, 'default'); assert.equal(request.body.stream, true);
  assert.equal(request.body.output_config.format.type, 'json_schema'); assert.equal(request.body.output_config.effort, 'high');
  assert.equal(request.body.messages[0].content[0].type, 'image'); assert.equal(request.body.messages[0].content[0].source.media_type, 'image/jpeg');
  const text = await status();
  assert.match(text, /2 Takte erkannt/); assert.match(text, /20 US-Cent/); assert.match(text, /Takt 2 ist leicht unscharf/);
  const s = await page.evaluate(() => { const e = window.__practice.engine; return { title: e.score.title, measures: e.score.measures.length, bpm: e.settings.bpm, notes: e.score.notes.map(n => [n.midi, n.start, n.end, n.staff]) }; });
  assert.equal(s.title, 'Testlied'); assert.equal(s.measures, 2); assert.equal(s.bpm, 100);
  assert.deepEqual(s.notes.filter(n => n[1] === 0).map(n => n[0]).sort(), [48, 60, 64, 67], 'Akkord und Bass auf Schlag 1');
  assert.deepEqual(s.notes.find(n => n[0] === 66), [66, 1, 2, 0], 'Fis aus der Erkennung');
  assert.deepEqual(s.notes.find(n => n[0] === 67 && n[1] === 2), [67, 2, 6, 0], 'Haltebogen über den Taktstrich');
  assert.equal(await page.locator('#score svg').count() > 0, true); assert.match(await page.locator('#warnings').textContent(), /per KI aus einem Foto erkannt/);
  assert.equal(await page.locator('#photo-download').getAttribute('download'), 'Testlied.musicxml'); assert.equal(await page.locator('#photo-download').isVisible(), true);
  const download = await Promise.all([page.waitForEvent('download'), page.locator('#photo-download').click()]).then(([d]) => d.path()).then(path => import('node:fs/promises').then(fs => fs.readFile(path, 'utf8')));
  assert.match(download, /<score-partwise/); assert.equal(await page.locator('#photo-cancel').isVisible(), false);
  await page.screenshot({ path: 'test-results/photo-desktop.png', fullPage: true });

  await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
  assert.match(await page.locator('#api-key').getAttribute('placeholder'), /^gespeichert: sk-ant-tes/, 'Schlüssel bleibt im Browser gespeichert');
  mode = 'auth'; await page.locator('#file').setInputFiles({ name: 'seite.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 Test') });
  await page.waitForFunction(() => document.querySelector('#photo-status').classList.contains('error'), null, { timeout: 30000 });
  assert.match(await status(), /API-Schlüssel abgelehnt/); assert.equal(requests.at(-1).body.messages[0].content[0].type, 'document');
  assert.notEqual(await page.locator('#photo-settings').getAttribute('open'), null); assert.equal((await page.evaluate(() => window.__practice.engine.score.title)), 'Kleine Klavierzeit', 'Fehler behält die bisherige Partitur');
  mode = 'slow'; await page.locator('#file').setInputFiles({ name: 'seite.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => document.querySelector('#photo-status').textContent.startsWith('Noten werden erkannt'));
  await page.locator('#photo-cancel').click();
  await page.waitForFunction(() => document.querySelector('#photo-status').textContent.includes('abgebrochen'));
  await page.locator('#api-key-forget').click(); assert.equal(await page.evaluate(() => localStorage.getItem('klavierzeit.anthropic-key')), null);
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobil ohne horizontales Scrollen');
  await page.locator('#photo-settings').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'test-results/photo-mobile.png', fullPage: true });
  assert.deepEqual(errors, [], 'Keine Laufzeitfehler');
  console.log('Fotoerkennung bestanden: Schlüsselabfrage, automatische Erkennung nach Eingabe, Anfrage an claude-opus-5-5 (Bild/PDF, JSON-Schema, Fallback), Partitur mit Akkord/Vorzeichen/Haltebogen, Kostenanzeige, MusicXML-Download, gespeicherter Schlüssel, Fehler 401, Abbrechen, Mobilansicht.');
} finally { await browser.close(); }
