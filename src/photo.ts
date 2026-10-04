import Anthropic from '@anthropic-ai/sdk';
import { SCORE_SCHEMA, TRANSCRIPTION_PROMPT, toMusicXML, type RecognizedScore } from './transcription';

// Optional photo/PDF recognition with the user's own Anthropic API key. The request goes
// straight from the browser to Anthropic; the key is kept only in this browser's storage.
const MODEL = 'claude-opus-5-5';
const PRICE = { input: 4, output: 20 }; // US-$ per million tokens for Claude Opus 5.5
const KEY_STORAGE = 'klavierzeit.anthropic-key';
const MAX_FILES = 8;

export const isPicture = (file: File) => file.type.startsWith('image/') || file.type === 'application/pdf' || /\.(jpe?g|png|webp|gif|heic|heif|pdf)$/i.test(file.name);
const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

function readKey(): string { try { return localStorage.getItem(KEY_STORAGE) ?? ''; } catch { return ''; } }
function storeKey(key: string): boolean { try { if (key) localStorage.setItem(KEY_STORAGE, key); else localStorage.removeItem(KEY_STORAGE); return true; } catch { return false; } }

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
}
// Scales to the model's maximum image size (2576 px long edge, about 3.75 megapixels) and re-encodes as JPEG.
async function imageBlock(file: File): Promise<Anthropic.Beta.BetaContentBlockParam> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error(`„${file.name}“ lässt sich nicht öffnen. Bitte das Foto als JPG oder PNG speichern.`); }
  const scale = Math.min(1, 2576 / Math.max(bitmap.width, bitmap.height), Math.sqrt(3_750_000 / (bitmap.width * bitmap.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  for (const quality of [0.9, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) break;
    const data = await base64(blob);
    if (data.length <= 5 * 1024 * 1024) return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } };
  }
  throw new Error(`„${file.name}“ ist zu groß. Bitte ein kleineres Foto verwenden.`);
}
async function pdfBlock(file: File): Promise<Anthropic.Beta.BetaContentBlockParam> {
  if (file.size > 20 * 1024 * 1024) throw new Error(`„${file.name}“ ist zu groß (maximal 20 MB).`);
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await base64(file) } };
}

async function transcribe(files: File[], apiKey: string, signal: AbortSignal, progress: (measures: number) => void): Promise<{ score: RecognizedScore; cost: number }> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const file of files) content.push(isPdf(file) ? await pdfBlock(file) : await imageBlock(file));
  content.push({ type: 'text', text: files.length > 1 ? `Transkribiere diese Klaviernoten. Die ${files.length} Dateien sind aufeinanderfolgende Seiten eines Stücks, in dieser Reihenfolge.` : 'Transkribiere diese Klaviernoten.' });
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = client.beta.messages.stream({
    model: MODEL, max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCORE_SCHEMA } },
    system: TRANSCRIPTION_PROMPT,
    messages: [{ role: 'user', content }],
  }, { signal });
  stream.on('text', (_, snapshot) => progress(snapshot.match(/"upper"\s*:/g)?.length ?? 0));
  const response = await stream.finalMessage();
  if (response.stop_reason === 'refusal') throw new Error('Die KI hat die Erkennung dieses Bildes abgelehnt.');
  if (response.stop_reason === 'max_tokens') throw new Error('Das Stück ist zu lang für eine Erkennung. Bitte weniger Seiten auf einmal hochladen.');
  const text = response.content.map(block => block.type === 'text' ? block.text : '').join('');
  let score: RecognizedScore;
  try { score = JSON.parse(text); } catch { throw new Error('Die Antwort der KI war unvollständig. Bitte erneut versuchen.'); }
  return { score, cost: (response.usage.input_tokens * PRICE.input + response.usage.output_tokens * PRICE.output) / 1e6 };
}

function explain(error: unknown): string {
  if (error instanceof Anthropic.APIUserAbortError) return 'Erkennung abgebrochen.';
  if (error instanceof Anthropic.AuthenticationError) return 'Anthropic hat den API-Schlüssel abgelehnt. Bitte unter „Fotos erkennen (KI)“ prüfen.';
  if (error instanceof Anthropic.PermissionDeniedError) return 'Dieser API-Schlüssel darf das Modell nicht verwenden. Bitte die Einstellungen im Anthropic-Konto prüfen.';
  if (error instanceof Anthropic.RateLimitError) return 'Anthropic meldet zu viele Anfragen oder ein erreichtes Ausgabenlimit. Bitte kurz warten und erneut versuchen.';
  if (error instanceof Anthropic.BadRequestError) return `Anthropic hat die Anfrage abgelehnt. Häufigste Ursache: kein Guthaben im Anthropic-Konto. (${error.message.slice(0, 200)})`;
  if (error instanceof Anthropic.InternalServerError) return 'Anthropic ist gerade überlastet. Bitte in ein paar Minuten erneut versuchen.';
  if (error instanceof Anthropic.APIConnectionError) return 'Keine Verbindung zu Anthropic. Bitte die Internetverbindung prüfen.';
  if (error instanceof Anthropic.APIError) return `Anthropic-Fehler ${error.status ?? ''}: ${error.message.slice(0, 200)}`;
  return error instanceof Error ? error.message : 'Die Erkennung ist fehlgeschlagen.';
}
const euro = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCost = (dollars: number) => dollars < 1 ? `${Math.max(1, Math.round(dollars * 100))} US-Cent` : `${euro.format(dollars)} US-$`;
const clock = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function installPhotoRecognition(host: HTMLElement, load: (xml: string) => Promise<boolean>, message: (text: string, error?: boolean) => void): { start: (files: File[]) => void } {
  const job = document.createElement('div'); job.className = 'photo-job'; job.hidden = true;
  job.innerHTML = `<p id="photo-status" role="status" aria-live="polite"></p><div class="photo-actions"><button id="photo-cancel" class="secondary">Abbrechen</button><a id="photo-download" class="download-link" hidden>Als MusicXML speichern</a></div>`;
  const settings = document.createElement('details'); settings.id = 'photo-settings'; settings.className = 'photo-settings';
  settings.innerHTML = `<summary>Fotos erkennen (KI)</summary><div class="details-content"><p class="hint">Fotos und PDFs von Klaviernoten wandelt Claude von Anthropic in spielbare Noten um. Dafür brauchst du einen eigenen API-Schlüssel von <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> mit etwas Guthaben. Eine Notenseite kostet meist etwa 20–80 US-Cent; die tatsächlichen Kosten stehen nach jeder Erkennung hier.</p><label class="key-label">API-Schlüssel<input id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></label><div class="photo-actions"><button id="api-key-save" class="secondary">Speichern</button><button id="api-key-forget" class="text-button">Schlüssel entfernen</button></div><p id="api-key-state" class="hint"></p><p class="hint">Der Schlüssel bleibt in diesem Browser und geht nur an Anthropic. Fotos werden zur Erkennung an Anthropic übertragen. Erkannte Noten können Fehler enthalten – bitte mit der Vorlage vergleichen.</p></div>`;
  host.append(job, settings);
  const status = job.querySelector<HTMLParagraphElement>('#photo-status')!;
  const cancel = job.querySelector<HTMLButtonElement>('#photo-cancel')!;
  const download = job.querySelector<HTMLAnchorElement>('#photo-download')!;
  const keyInput = settings.querySelector<HTMLInputElement>('#api-key')!;
  const keyState = settings.querySelector<HTMLParagraphElement>('#api-key-state')!;
  let apiKey = readKey();
  let pending: File[] = [];
  let running: AbortController | undefined;
  const report = (text: string, error = false) => { job.hidden = false; status.textContent = text; status.classList.toggle('error', error); };
  const showKey = () => { keyInput.value = ''; keyInput.placeholder = apiKey ? `gespeichert: ${apiKey.slice(0, 10)}…${apiKey.slice(-4)}` : 'sk-ant-…'; keyState.textContent = apiKey ? 'Schlüssel ist eingetragen. Lege ein Foto oder PDF oben ab.' : 'Noch kein Schlüssel eingetragen.'; };
  showKey();

  settings.querySelector('#api-key-save')!.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key.startsWith('sk-ant-')) { keyState.textContent = key ? 'Das sieht nicht wie ein Anthropic-Schlüssel aus. Er beginnt mit „sk-ant-“.' : 'Bitte zuerst den Schlüssel einfügen.'; return; }
    apiKey = key; const saved = storeKey(key); showKey();
    if (!saved) keyState.textContent = 'Schlüssel gilt nur bis zum Schließen der Seite, weil dieser Browser nichts speichern darf.';
    if (pending.length) { const files = pending; pending = []; start(files); }
  });
  settings.querySelector('#api-key-forget')!.addEventListener('click', () => { apiKey = ''; storeKey(''); showKey(); });
  cancel.addEventListener('click', () => running?.abort());

  function offer(xml: string, title: string): void {
    if (download.href) URL.revokeObjectURL(download.href);
    download.href = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }));
    download.download = `${(title.trim() || 'Erkannte Noten').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80)}.musicxml`;
    download.hidden = false;
  }
  function start(files: File[]): void {
    const pictures = [...files].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true })).slice(0, MAX_FILES);
    if (!apiKey) {
      pending = pictures; settings.open = true; keyInput.focus();
      report('Für die Fotoerkennung bitte zuerst deinen API-Schlüssel eintragen. Danach geht es automatisch los.');
      return;
    }
    running?.abort();
    const controller = new AbortController(); running = controller;
    const started = performance.now(); let measures = 0;
    const tick = () => report(`Noten werden erkannt … ${clock(performance.now() - started)}${measures ? ` · Takt ${measures}` : ''}`);
    const timer = setInterval(tick, 1000); tick();
    cancel.hidden = false; download.hidden = true;
    message(`Foto wird erkannt${files.length > MAX_FILES ? ` (nur die ersten ${MAX_FILES} Dateien)` : ''}. Das dauert meist 1–3 Minuten; du kannst solange weiterüben.`);
    void (async () => {
      try {
        const { score, cost } = await transcribe(pictures, apiKey, controller.signal, count => { measures = count; tick(); });
        if (running !== controller) return;
        const result = toMusicXML(score);
        offer(result.xml, score.title);
        const notes = [score.problem.trim() && `Hinweis der KI: ${score.problem.trim()}`, result.irregular.length && `Rhythmus prüfen in Takt ${result.irregular.slice(0, 6).join(', ')}${result.irregular.length > 6 ? ' …' : ''}.`].filter(Boolean).join(' ');
        report(`Fertig: ${result.measures} ${result.measures === 1 ? 'Takt' : 'Takte'} erkannt in ${clock(performance.now() - started)}, Kosten ca. ${formatCost(cost)}. ${notes}`.trim());
        if (!await load(result.xml)) report('Die erkannten Noten ließen sich nicht darstellen. Bitte ein schärferes Foto versuchen.', true);
      } catch (error) {
        if (running !== controller) return;
        const failed = !(error instanceof Anthropic.APIUserAbortError);
        report(explain(error), failed); message(explain(error), failed);
        if (error instanceof Anthropic.AuthenticationError) settings.open = true;
      } finally {
        clearInterval(timer);
        if (running === controller) { running = undefined; cancel.hidden = true; }
      }
    })();
  }
  return { start };
}
