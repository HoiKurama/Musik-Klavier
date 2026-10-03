import './style.css';
import { ScoreView } from './score';
import { decodeMusicXML } from './import';
import { PracticeEngine } from './engine';
import { PianoAudio } from './audio';
import { KEY_BINDINGS, NoteInput } from './input';
import { noteName, type Settings } from './types';
import { installHandControls } from './hands';
import { installMidiControls } from './midi';
import { LocalProgress } from './storage';
import { exampleScore } from 'virtual:offline-assets';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="topbar"><a class="brand" href="index.html" aria-label="Klavierzeit Startseite"><span class="brand-icon" aria-hidden="true">♫</span> Klavierzeit</a><div class="header-actions"><span class="local-badge"><span></span> Lokal · ohne Konto</span><button id="example" class="secondary">↺ Beispiel laden</button></div></header>
  <main>
    <div class="workspace">
      <section class="practice-panel" aria-label="Noten und Übung">
        <div class="score-heading"><div><p class="eyebrow">DEIN NOTENPULT</p><h1 id="title">Beispiel wird geladen …</h1></div><label class="zoom-label">Zoom<select id="zoom"><option value="0.75">75 %</option><option value="1" selected>100 %</option><option value="1.25">125 %</option><option value="1.5">150 %</option></select></label></div>
        <div class="practice-settings">
          <section class="mode-control"><h2>Übemodus</h2><div class="segmented" role="group" aria-label="Übemodus"><button id="listen" aria-pressed="true" aria-describedby="mode-hint">♫ Zuhören</button><button id="step" aria-pressed="false" aria-describedby="mode-hint">♪ Schrittmodus</button></div></section>
          <div id="hand-controls"></div>
          <section class="tempo-control"><label class="range-label" for="tempo"><span>Tempo</span><output id="bpm">90 BPM</output></label><input id="tempo" type="range" min="30" max="240" value="90" aria-describedby="tempo-help"><span id="tempo-help" class="sr-only">30 bis 240 Schläge pro Minute</span></section>
          <p id="mode-hint" class="hint">Noten, Klang und Tastatur laufen gemeinsam.</p>
        </div>
        <div id="message" role="status" aria-live="polite" class="message">Deine Noten werden vorbereitet.</div>
        <div id="score" class="score-viewport" aria-label="Notenpartitur"></div>
        <div id="warnings" class="warnings" hidden></div>
        <div class="transport"><div class="transport-buttons"><button id="play" class="primary" disabled>▶ Abspielen</button><button id="reset" class="icon-button" aria-label="Zurück zum Anfang" title="Zurück zum Anfang" disabled>↺</button></div><div class="position"><strong id="position">Takt 1 / 8</strong><span id="target">Bereit zum Zuhören</span></div><label class="jump-label">Gehe zu<select id="jump" aria-label="Zu Takt springen"></select></label></div>
        <div class="progress-track"><div id="progress-bar"></div></div>
        <section class="keyboard-section"><div class="keyboard-heading"><h2>Deine Klaviertastatur</h2><div class="octave-control"><button id="octave-down" aria-label="Computerbelegung eine Oktave tiefer">−</button><span id="octave-label">C4 – C5</span><button id="octave-up" aria-label="Computerbelegung eine Oktave höher">＋</button></div></div><div class="legend"><span><i class="expected"></i>Gesucht</span><span><i class="sounding"></i>Klingt</span><span><i class="pressed"></i>Gespielt</span></div><div id="keyboard-scroll" class="keyboard-scroll"><div id="keyboard" class="keyboard" aria-label="Virtuelle Klaviertastatur"></div></div><p class="keyboard-help">Klicke oder tippe auf die Tasten. Am Computer: <strong>A W S E D F T G Z H U J K</strong>. Mit − / ＋ wechselst du die Oktave.</p></section>
      </section>
      <aside class="controls" aria-label="Noten und Einstellungen">
        <section class="control-section"><h2>Deine Noten</h2><label id="dropzone" class="dropzone"><span class="upload-icon" aria-hidden="true">＋</span><strong>MusicXML öffnen</strong><span>Datei wählen oder hier ablegen</span><small>.musicxml · .xml · .mxl</small><input id="file" type="file" accept=".musicxml,.xml,.mxl" aria-label="MusicXML-Datei öffnen"></label><p class="hint">Foto oder PDF? Mit einem Notenscanner als MusicXML exportieren.</p></section>
        <section class="control-section"><h2>Taktbereich</h2><label class="switch-label"><input id="loop" type="checkbox">Takte wiederholen</label><div class="measure-select"><label>Von<select id="from" aria-label="Erster Takt"></select></label><span aria-hidden="true">–</span><label>Bis<select id="to" aria-label="Letzter Takt"></select></label></div><p class="hint">Start- und Endtakt gehören dazu.</p></section>
        <section class="control-section"><label class="range-label" for="volume"><span>Lautstärke</span><output id="volume-value">65 %</output></label><input id="volume" type="range" min="0" max="100" value="65"></section>
        <div id="extensions"></div>
      </aside>
    </div>
    <footer>Alles bleibt auf diesem Computer. <a href="THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener">Klang &amp; Bibliotheken</a></footer>
  </main>`;

export const element = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const audio = new PianoAudio();
const input = new NoteInput();
let view: ScoreView | undefined;
let engine: PracticeEngine | undefined;
let busy = false;
let audioPending = false;
let playRequest = 0;
let importGeneration = 0;
let lastTime = performance.now();
let lastRevision = -1;
let lastVisual = '';
let wrongMidi = -1;
let wrongUntil = 0;
let extensionChange: () => void = () => {};
let extensionLoaded: () => Promise<void> = async () => {};
let localProgress: LocalProgress | undefined;

export function message(text: string, error = false): void { element('message').textContent = text; element('message').classList.toggle('error', error); }
async function unlock(): Promise<void> {
  if (audio.ready) return;
  if (audioPending) return audio.unlock();
  audioPending = true; message('Klavierklang wird vorbereitet …');
  try { await audio.unlock(); message('Klavierklang bereit. Viel Freude beim Üben.'); }
  catch (error) { message(error instanceof Error ? error.message : 'Der Klang konnte nicht geladen werden.', true); throw error; }
  finally { audioPending = false; }
}

const pianoKeys = new Map<number, HTMLButtonElement>();
let white = 0;
for (let midi = 21; midi <= 108; midi++) {
  const black = [1, 3, 6, 8, 10].includes(midi % 12);
  const key = document.createElement('button');
  key.className = `piano-key ${black ? 'black-key' : 'white-key'}`;
  key.dataset.midi = String(midi); key.setAttribute('aria-label', noteName(midi));
  key.style.left = `${black ? white * 32 - 10 : white * 32}px`;
  key.innerHTML = `<span class="key-binding"></span><span class="key-name">${midi % 12 === 0 || midi === 21 ? noteName(midi) : ''}</span>`;
  if (!black) white++;
  key.addEventListener('pointerdown', event => {
    if (event.button > 0 || busy || !engine) return;
    event.preventDefault(); key.setPointerCapture(event.pointerId);
    input.press(`pointer:${event.pointerId}`, midi);
  });
  const release = (event: PointerEvent) => input.release(`pointer:${event.pointerId}`);
  key.addEventListener('pointerup', release); key.addEventListener('pointercancel', release); key.addEventListener('lostpointercapture', release);
  element('keyboard').append(key); pianoKeys.set(midi, key);
}
element('keyboard').style.width = `${white * 32}px`;
function bindings(): void {
  for (const [midi, key] of pianoKeys) key.querySelector('.key-binding')!.textContent = KEY_BINDINGS[midi - input.base]?.toUpperCase() ?? '';
  element('octave-label').textContent = `${noteName(input.base)} – ${noteName(input.base + 12)}`;
  element<HTMLButtonElement>('octave-down').disabled = input.base <= 24;
  element<HTMLButtonElement>('octave-up').disabled = input.base >= 96;
}
function reveal(midi: number): void {
  const key = pianoKeys.get(midi); if (!key) return;
  const scroll = element('keyboard-scroll'); const left = parseFloat(key.style.left);
  if (left < scroll.scrollLeft + 20 || left > scroll.scrollLeft + scroll.clientWidth - 60) scroll.scrollLeft = Math.max(0, left - scroll.clientWidth / 3);
}
function focusRange(midis: number[]): void {
  const positions = midis.map(m => parseFloat(pianoKeys.get(m)?.style.left ?? '0'));
  const scroll = element('keyboard-scroll');
  const low = Math.min(...positions), high = Math.max(...positions) + 32;
  scroll.scrollLeft = Math.max(0, high - low < scroll.clientWidth ? (low + high - scroll.clientWidth) / 2 : low - 24);
}
for (const [id, delta] of [['octave-down', -12], ['octave-up', 12]] as const) element(id).addEventListener('click', () => { input.clear(); input.base = Math.max(24, Math.min(96, input.base + delta)); bindings(); reveal(input.base); });
bindings(); input.bindKeyboard();
input.onPress = (midi, velocity) => {
  if (busy || !engine) return;
  const result = engine.press(midi);
  if (result === 'wrong') { wrongMidi = midi; wrongUntil = performance.now() + 900; message(`${noteName(midi)} ist hier nicht gesucht. Die richtigen Teilnoten bleiben erhalten.`); }
  else if (result === 'correct') message(engine.finished ? 'Geschafft! Du hast die ausgewählten Takte geübt.' : 'Richtig. Weiter zum nächsten Einsatz.');
  if (audio.ready) audio.press(midi, velocity);
  else void unlock().then(() => { if (input.pressed.includes(midi)) audio.press(midi, velocity); }).catch(() => {});
  extensionChange(); render();
};
input.onRelease = midi => { audio.release(midi); render(); };

function stopSound(): void { playRequest++; if(engine?.playing){engine.playing=false;engine.revision++;} audio.stop(); input.clear(); audio.releaseKeyboard(); }
export function configure(next: Partial<Settings>): void { if (!engine) return; stopSound(); engine.configure(next); extensionChange(); render(); }
function fillMeasures(): void {
  if (!engine) return;
  for (const id of ['from', 'to', 'jump']) {
    const select = element<HTMLSelectElement>(id); select.replaceChildren();
    for (const m of engine.score.measures) { const option = document.createElement('option'); option.value = String(m.index); option.textContent = `Takt ${m.label}`; select.append(option); }
  }
  element<HTMLSelectElement>('to').value = String(engine.settings.to);
}
export async function loadXML(xml: string, generation = ++importGeneration): Promise<void> {
  if (generation !== importGeneration) return;
  busy = true; stopSound(); render(); message('Noten werden geladen …');
  try {
    const nextView = await ScoreView.load(xml, element('score'));
    if (generation !== importGeneration) { nextView.dispose(); return; }
    stopSound(); view?.dispose(); view = nextView; view.mount(element('score'));
    engine = new PracticeEngine(view.score, { bpm: view.score.bpm, hand: 'both', rightStaff: 0, leftStaff: Math.min(1, view.score.staves.length - 1), loop: false, from: 0, to: view.score.measures.length - 1 });
    element('title').textContent = view.score.title;
    element<HTMLInputElement>('tempo').value = String(engine.settings.bpm); element<HTMLInputElement>('loop').checked = false;
    element<HTMLSelectElement>('zoom').value = '1'; fillMeasures();
    const warnings = element('warnings'); warnings.replaceChildren(); warnings.hidden = !view.score.warnings.length;
    for (const warning of view.score.warnings) { const p = document.createElement('p'); p.textContent = warning; warnings.append(p); }
    input.base = Math.max(24, Math.min(96, Math.floor(Math.max(...view.score.notes.filter(n => n.staff === 0).map(n => n.midi), 60) / 12) * 12 - 12));
    bindings(); lastRevision = -1; lastVisual = ''; await extensionLoaded();
    message(`${view.score.measures.length} Takte bereit. Wähle „Zuhören“ oder „Schrittmodus“.`);
    focusRange(engine.mode === 'step' ? engine.expected : [input.base, input.base + 12]);
  } catch (error) { if (generation === importGeneration) message(error instanceof Error ? error.message : 'Die Noten konnten nicht geladen werden.', true); }
  finally { if (generation === importGeneration) { busy = false; render(); } }
}
async function openFile(file?: File): Promise<void> {
  if (!file) return;
  const generation = ++importGeneration;
  busy = true; stopSound(); render(); message('Datei wird gelesen …');
  try { const bytes = new Uint8Array(await file.arrayBuffer()); if (generation === importGeneration) await loadXML(decodeMusicXML(bytes), generation); }
  catch (error) { if (generation === importGeneration) message(error instanceof Error ? error.message : 'Datei konnte nicht gelesen werden.', true); }
  finally { if (generation === importGeneration) { busy = false; render(); } }
}
element<HTMLInputElement>('file').addEventListener('change', event => { const field = event.target as HTMLInputElement; void openFile(field.files?.[0]); field.value = ''; });
async function example(): Promise<void> { const generation = ++importGeneration; busy = true; render(); try { await loadXML(exampleScore, generation); } catch (error) { if (generation === importGeneration) message(String(error), true); } finally { if (generation === importGeneration) { busy = false; render(); } } }
element('example').addEventListener('click', () => { stopSound(); void example(); });
const dropzone = element('dropzone');
dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('dragging'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', event => { event.preventDefault(); dropzone.classList.remove('dragging'); void openFile(event.dataTransfer?.files[0]); });
document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
document.addEventListener('drop', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
element('listen').addEventListener('click', () => { if (!engine || busy) return; stopSound(); engine.setMode('listen'); extensionChange(); render(); });
element('step').addEventListener('click', () => { if (!engine || busy) return; stopSound(); engine.setMode('step'); extensionChange(); message('Spiele die markierten Töne. Akkorde kannst du auch Ton für Ton eingeben.'); render(); });
element('play').addEventListener('click', () => {
  if (!engine || busy) return;
  if (engine.mode === 'step') { stopSound(); engine.reset(); render(); return; }
  if (engine.playing) { engine.toggle(); audio.stop(); render(); return; }
  const currentEngine = engine;
  const request=++playRequest;
  void unlock().then(() => { if (request===playRequest && engine === currentEngine && !busy && engine.mode === 'listen' && !engine.playing) { engine.toggle(); lastTime = performance.now(); render(); } }).catch(() => {});
});
element('reset').addEventListener('click', () => { if (engine) { stopSound(); engine.reset(); render(); } });
element<HTMLInputElement>('tempo').addEventListener('input', event => { if (!engine) return; engine.settings.bpm = Number((event.target as HTMLInputElement).value); engine.revision++; extensionChange(); render(); });
element<HTMLInputElement>('volume').addEventListener('input', event => { const value = Number((event.target as HTMLInputElement).value); audio.volume(value / 100); element('volume-value').textContent = `${value} %`; });
element<HTMLInputElement>('loop').addEventListener('change', event => configure({ loop: (event.target as HTMLInputElement).checked }));
element<HTMLSelectElement>('from').addEventListener('change', event => { const from = Number((event.target as HTMLSelectElement).value); const to = Math.max(from, engine!.settings.to); element<HTMLSelectElement>('to').value = String(to); configure({ from, to }); });
element<HTMLSelectElement>('to').addEventListener('change', event => { const to = Number((event.target as HTMLSelectElement).value); const from = Math.min(to, engine!.settings.from); element<HTMLSelectElement>('from').value = String(from); configure({ from, to }); });
element<HTMLSelectElement>('jump').addEventListener('change', event => { if (engine) { stopSound(); engine.seek(Number((event.target as HTMLSelectElement).value)); render(); } });
element<HTMLSelectElement>('zoom').addEventListener('change', event => { view?.resize(Number((event.target as HTMLSelectElement).value)); lastVisual = ''; render(); });
let resizeTimer: ReturnType<typeof setTimeout>;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { view?.resize(Number(element<HTMLSelectElement>('zoom').value)); lastVisual = ''; focusRange(engine?.mode === 'step' ? engine.expected : [input.base, input.base + 12]); render(); }, 150); });
document.addEventListener('visibilitychange', () => { if (document.hidden && engine?.playing) { engine.playing = false; engine.revision++; audio.stop(); render(); } lastTime = performance.now(); });

export function render(): void {
  const disabled = busy || !engine;
  for (const id of ['play','reset','from','to','jump','listen','step','loop','tempo','zoom']) (element(id) as HTMLButtonElement).disabled = disabled;
  if (!engine || !view) return;
  const isStep = engine.mode === 'step';
  element('listen').setAttribute('aria-pressed', String(!isStep)); element('step').setAttribute('aria-pressed', String(isStep));
  element('mode-hint').textContent = isStep ? 'Die Noten warten auf dich. Akkorde gehen auch nacheinander.' : 'Noten, Klang und Tastatur laufen gemeinsam.';
  element('play').textContent = isStep ? '↺ Neu üben' : engine.playing ? 'Ⅱ Pause' : engine.finished ? '▶ Noch einmal' : engine.beat > engine.bounds[0] ? '▶ Fortsetzen' : '▶ Abspielen';
  element('bpm').textContent = `${engine.settings.bpm} BPM`;
  element<HTMLInputElement>('tempo').value = String(engine.settings.bpm);
  element<HTMLInputElement>('loop').checked = engine.settings.loop;
  element<HTMLSelectElement>('from').value = String(engine.settings.from);
  element<HTMLSelectElement>('to').value = String(engine.settings.to);
  for (const control of document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('[data-hand], #right-staff, #left-staff')) control.disabled=disabled;
  const measure = Math.max(0, engine.measureIndex);
  element('position').textContent = `Takt ${engine.score.measures[measure].label} / ${engine.score.measures.at(-1)!.label}`;
  element('target').textContent = isStep ? engine.finished ? 'Geschafft! Alle Schritte abgeschlossen.' : engine.expected.length ? `Gesucht: ${engine.expected.filter(n => !engine!.collected.has(n)).map(noteName).join(' · ')} · Schritt ${engine.stepIndex + 1}/${engine.steps.length}` : 'Für diese Auswahl gibt es keine Übeschritte.' : engine.finished ? 'Stück beendet' : engine.playing ? 'Hör zu und folge den Tönen' : 'Bereit zum Zuhören';
  element<HTMLSelectElement>('jump').value = String(measure);
  const [from,to] = engine.bounds;
  element('progress-bar').style.width = `${engine.finished ? 100 : isStep ? engine.stepIndex / Math.max(1, engine.steps.length) * 100 : (engine.beat - from) / (to - from) * 100}%`;
  const expected = isStep && !engine.finished ? engine.expected : [];
  const sounding = engine.playing ? engine.active : [];
  const pressed = input.pressed;
  const incorrect = performance.now() < wrongUntil ? wrongMidi : -1;
  for (const [midi,key] of pianoKeys) {
    key.classList.toggle('expected', expected.includes(midi)); key.classList.toggle('sounding', sounding.includes(midi));
    key.classList.toggle('pressed', pressed.includes(midi) || engine.collected.has(midi)); key.classList.toggle('wrong', midi === incorrect);
    key.setAttribute('aria-pressed', String(pressed.includes(midi)));
  }
  const visual = `${measure}:${engine.score.steps.findLastIndex(s => s.beat <= engine!.beat + 1e-7)}:${element<HTMLSelectElement>('zoom').value}`;
  if (visual !== lastVisual) { view.move(engine.beat); lastVisual = visual; }
  if (isStep && engine.revision !== lastRevision && expected.length) focusRange(expected);
}
function frame(now: number): void {
  const seconds = Math.min(0.25, (now - lastTime) / 1000); lastTime = now;
  if (engine) {
    engine.advance(seconds);
    if (engine.playing) audio.update(engine.score, engine.settings, engine.beat, engine.bounds[1], engine.revision !== lastRevision);
    else if (engine.revision !== lastRevision) audio.stop();
    render(); lastRevision = engine.revision;
  }
  requestAnimationFrame(frame);
}
export const app = { get engine() { return engine; }, get view() { return view; }, input, audio, get busy() { return busy; }, get progress() { return localProgress; }, configure, render, message };
const handControls = installHandControls(element('hand-controls'), element('extensions'), () => engine, configure);
installMidiControls(element('extensions'), input);
localProgress = new LocalProgress(element('extensions'),()=>engine,()=>busy,settings=>configure(settings));
extensionLoaded = async () => { handControls.loaded(); void localProgress!.loaded(); };
extensionChange = () => { handControls.sync(); localProgress?.change(); };
// Expose diagnostics only on the local development server, for integration checks.
if (import.meta.env.DEV) (window as unknown as { __practice: typeof app }).__practice = app;
void example(); requestAnimationFrame(frame);
