import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { importWarnings, validateXML } from './import';
import type { Score, ScoreNote, Step } from './types';

export function buildScore(osmd: OpenSheetMusicDisplay, doc: Document, hash: string): Score {
  const sheet = osmd.Sheet;
  const notes: ScoreNote[] = [];
  const steps: Step[] = [];
  const measures = sheet.SourceMeasures.map((m, index) => ({ index, label: String(m.MeasureNumberXML ?? index + 1), start: m.AbsoluteTimestamp.RealValue * 4, end: (m.AbsoluteTimestamp.RealValue + m.Duration.RealValue) * 4 }));
  for (const [measureIndex, measure] of sheet.SourceMeasures.entries()) {
    for (const container of measure.VerticalSourceStaffEntryContainers) {
      const beat = (measure.AbsoluteTimestamp.RealValue + container.Timestamp.RealValue) * 4;
      const attacks: ScoreNote[] = [];
      for (const entry of container.StaffEntries) {
        if (!entry) continue;
        for (const voice of entry.VoiceEntries) for (const note of voice.Notes) {
          if (!note.Pitch || note.isRest() || voice.IsGrace) continue;
          if (note.NoteTie && note.NoteTie.StartNote !== note) continue;
          const midi = Math.round(note.Pitch.getHalfTone() + 12);
          if (midi < 21 || midi > 108) continue;
          const duration = (note.NoteTie ? note.NoteTie.Duration : note.Length).RealValue * 4;
          if (!(duration > 0)) continue;
          const normalized: ScoreNote = { id: notes.length, midi, start: beat, end: beat + duration, staff: sheet.Staves.indexOf(entry.ParentStaff), voice: String(voice.ParentVoice.VoiceId) };
          notes.push(normalized); attacks.push(normalized);
        }
      }
      steps.push({ beat, measure: measureIndex, notes: attacks, cursorIndex: steps.length });
    }
  }
  if (!notes.length) throw new Error('Keine spielbaren Klaviertöne gefunden (Tonumfang A0 bis C8).');
  const sound = doc.querySelector('sound[tempo]');
  let bpm = Number(sound?.getAttribute('tempo'));
  if (!bpm) {
    const metro = doc.querySelector('metronome');
    const unit = metro?.querySelector('beat-unit')?.textContent ?? 'quarter';
    const factor: Record<string, number> = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 };
    bpm = Number(metro?.querySelector('per-minute')?.textContent) * (factor[unit] ?? 1) * (metro?.querySelector('beat-unit-dot') ? 1.5 : 1);
  }
  return { title: doc.querySelector('work-title, movement-title')?.textContent?.trim() || 'Meine Klaviernoten', hash, bpm: Math.max(30, Math.min(240, bpm || 90)), notes, measures, steps, staves: sheet.Staves.map((_, i) => `Notensystem ${i + 1}`), warnings: importWarnings(doc) };
}

export class ScoreView {
  private cursorIndex = 0;
  private cursorPositions: number[] = [];
  constructor(public osmd: OpenSheetMusicDisplay, public element: HTMLDivElement, public score: Score) {}
  static async load(xml: string, host: HTMLElement): Promise<ScoreView> {
    const doc = validateXML(xml);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(xml)))).map(b => b.toString(16).padStart(2, '0')).join('');
    const element = document.createElement('div');
    element.className = 'score-render';
    element.style.cssText = `position:absolute;left:-20000px;width:${Math.max(320, host.clientWidth - 32)}px;visibility:hidden;`;
    host.append(element);
    const osmd = new OpenSheetMusicDisplay(element, { backend: 'svg', autoResize: false, drawTitle: false, drawComposer: false, drawPartNames: false, drawMetronomeMarks: true, cursorsOptions: [{ type: 0, color: '#3b9b78', alpha: 0.32, follow: false }] });
    try {
      await osmd.load(doc); osmd.render();
      const score = buildScore(osmd, doc, hash);
      return new ScoreView(osmd, element, score);
    } catch (error) { osmd.clear(); element.remove(); throw error; }
  }
  mount(host: HTMLElement): void {
    this.element.style.cssText = ''; host.replaceChildren(this.element);
    const cursor = this.osmd.cursor; cursor.reset();
    let guard = 0;
    while (!cursor.Iterator.EndReached && guard++ < 20000) { this.cursorPositions.push(cursor.Iterator.CurrentSourceTimestamp.RealValue * 4); cursor.next(); }
    cursor.reset(); this.cursorIndex = 0; cursor.show();
  }
  resize(zoom = 1): void { this.osmd.Zoom = zoom; this.osmd.render(); this.osmd.cursor.reset(); this.cursorIndex = 0; this.osmd.cursor.show(); }
  move(beat: number): void {
    const cursor = this.osmd.cursor;
    const target = Math.max(0, this.cursorPositions.findLastIndex(position => position <= beat + 1e-7));
    if (target < this.cursorIndex) { cursor.reset(); this.cursorIndex = 0; }
    while (this.cursorIndex < target) { cursor.next(); this.cursorIndex++; }
    cursor.update();
    const parent = this.element.parentElement!;
    const area = parent.getBoundingClientRect(); const position = cursor.cursorElement.getBoundingClientRect();
    if (position.bottom > area.bottom - 20) parent.scrollTop += position.bottom - area.bottom + 40;
    else if (position.top < area.top + 10) parent.scrollTop += position.top - area.top - 20;
  }
  dispose(): void { this.osmd.cursor.Dispose(); this.osmd.clear(); this.element.remove(); }
}
