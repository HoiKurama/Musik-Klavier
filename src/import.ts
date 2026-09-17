import { unzipSync, strFromU8 } from 'fflate';

export function decodeMusicXML(bytes: Uint8Array): string {
  if (!bytes.length) throw new Error('Die Datei ist leer.');
  if (bytes.length > 15 * 1024 * 1024) throw new Error('Die Datei ist zu groß (maximal 15 MB).');
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    let files: Record<string, Uint8Array>;
    let total = 0;
    try { files = unzipSync(bytes, { filter: entry => {
      total += entry.originalSize;
      if (total > 40 * 1024 * 1024) throw new Error('Archiv zu groß.');
      return /\.(xml|musicxml)$/i.test(entry.name);
    } }); } catch { throw new Error('Das MXL-Archiv ist beschädigt oder zu groß.'); }
    const container = files['META-INF/container.xml'];
    let path: string | undefined;
    if (container) {
      const doc = new DOMParser().parseFromString(strFromU8(container), 'application/xml');
      path = Array.from(doc.getElementsByTagName('rootfile')).find(el => el.getAttribute('media-type') === 'application/vnd.recordare.musicxml+xml')?.getAttribute('full-path') ?? doc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path') ?? undefined;
    }
    if (!path) path = Object.keys(files).find(p => !p.startsWith('META-INF/'));
    if (!path || !files[path]) throw new Error('Im MXL-Archiv fehlt die MusicXML-Partitur.');
    return decodeXMLText(files[path]);
  }
  return decodeXMLText(bytes);
}
function decodeXMLText(bytes: Uint8Array): string {
  const prefix = new TextDecoder().decode(bytes.slice(0, 200));
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : /encoding=["']([^"']+)/i.exec(prefix)?.[1] ?? 'utf-8';
  try { return new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { throw new Error('Die Zeichenkodierung der XML-Datei kann nicht gelesen werden.'); }
}
export function validateXML(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Die XML-Datei ist beschädigt. Bitte erneut aus dem Notenscanner exportieren.');
  if (doc.documentElement.localName !== 'score-partwise') throw new Error('Benötigt wird MusicXML im Format „score-partwise“. Bitte entsprechend exportieren.');
  if (!doc.querySelector('part > measure')) throw new Error('Die Datei enthält keine Takte.');
  return doc;
}
export function importWarnings(doc: Document): string[] {
  const warnings: string[] = [];
  if (doc.querySelector('repeat, ending, segno, coda, sound[dacapo], sound[dalsegno], sound[tocoda], sound[fine]')) warnings.push('Wiederholungszeichen und Sprünge: Die App spielt die Takte in notierter Reihenfolge. Nutze die Taktwiederholung.');
  if (doc.querySelector('grace, ornament, ornaments, tremolo, arpeggiate')) warnings.push('Verzierungen, Vorschläge, Tremolo und Arpeggien werden angezeigt; abgespielt werden die Haupttöne als normale Einsätze.');
  if (doc.querySelector('pedal, sound[damper-pedal]')) warnings.push('Pedalzeichen werden angezeigt, beim Abspielen aber nicht interpretiert.');
  const tempoEvents = new Set(Array.from(doc.querySelectorAll('sound[tempo], metronome')).map(el => el.closest('direction') ?? el));
  if (tempoEvents.size > 1) warnings.push('Die App verwendet ein konstantes Tempo. Weitere Tempoangaben und Rubato werden nicht automatisch ausgeführt.');
  if (doc.querySelector('transpose, unpitched')) warnings.push('Transponierende Instrumente und Schlagzeug werden nicht unterstützt. Bitte eine Klavierpartitur exportieren.');
  return warnings;
}
