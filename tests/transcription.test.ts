import { expect, it } from 'vitest';
import { eventTicks, parsePitch, toMusicXML, type NoteEvent, type RecognizedMeasure, type RecognizedScore } from '../src/transcription';
const n = (pitches: string[], duration: NoteEvent['duration'] = 'quarter', extra: Partial<NoteEvent> = {}): NoteEvent => ({ pitches, duration, dots: 0, triplet: false, tie: false, ...extra });
const measure = (upper: NoteEvent[][], lower: NoteEvent[][] = [], extra: Partial<RecognizedMeasure> = {}): RecognizedMeasure => ({ fifths: 0, beats: 4, beatType: 4, upper, lower, ...extra });
const score = (measures: RecognizedMeasure[], extra: Partial<RecognizedScore> = {}): RecognizedScore => ({ readable: true, problem: '', title: '', composer: '', tempo: 0, upperClef: 'G', lowerClef: 'F', measures, ...extra });
const count = (xml: string, text: string) => xml.split(text).length - 1;

it('liest Tonnamen mit Vorzeichen und Oktave', () => {
  expect(parsePitch('C4')).toMatchObject({ step: 'C', alter: 0, octave: 4 });
  expect(parsePitch('F#3')).toMatchObject({ step: 'F', alter: 1, octave: 3 });
  expect(parsePitch('Bb5')).toMatchObject({ step: 'B', alter: -1, octave: 5 });
  expect(parsePitch('H4')).toBeUndefined(); expect(parsePitch('C')).toBeUndefined();
});
it('berechnet Dauern mit Punktierung und Triolen', () => {
  expect(eventTicks(n(['C4']))).toBe(48); expect(eventTicks(n(['C4'], 'quarter', { dots: 1 }))).toBe(72);
  expect(eventTicks(n(['C4'], 'eighth', { triplet: true }))).toBe(16); expect(eventTicks(n(['C4'], '32nd', { dots: 1 }))).toBe(9);
});
it('baut Akkorde, Stimmen beider Systeme und Rücksprünge', () => {
  const { xml, measures, irregular } = toMusicXML(score([measure([[n(['C4', 'E4', 'G4'], 'whole')]], [[n(['C3'], 'half'), n(['G2'], 'half')], [n(['C2'], 'whole')]])], { title: 'Für <Elise> & Co', tempo: 100 }));
  expect(measures).toBe(1); expect(irregular).toEqual([]);
  expect(count(xml, '<chord/>')).toBe(2); expect(xml).toContain('<staves>2</staves>');
  expect(count(xml, '<backup><duration>192</duration></backup>')).toBe(2);
  expect(xml).toContain('<voice>5</voice>'); expect(xml).toContain('<voice>6</voice>');
  expect(xml).toContain('<work-title>Für &lt;Elise&gt; &amp; Co</work-title>'); expect(xml).toContain('<sound tempo="100"/>');
  expect(xml).toContain('<miscellaneous-field name="klavierzeit-erkannt">');
});
it('verbindet Haltebögen über den Taktstrich', () => {
  const { xml } = toMusicXML(score([measure([[n([], 'half', { dots: 1 }), n(['C4'], 'quarter', { tie: true })]]), measure([[n(['C4'], 'whole')]])]));
  expect(count(xml, '<tie type="start"/>')).toBe(1); expect(count(xml, '<tie type="stop"/>')).toBe(1);
  expect(xml.indexOf('<tie type="start"/>')).toBeLessThan(xml.indexOf('<tie type="stop"/>'));
});
it('erkennt Auftakt, einzelnes Notensystem und unstimmige Takte', () => {
  const { xml, irregular } = toMusicXML(score([measure([[n(['G4'])]]), measure([[n(['C5'], 'half')]]), measure([[n(['D5'], 'whole')]])]));
  expect(xml).toContain('<measure number="0" implicit="yes">'); expect(xml).toContain('<measure number="1">');
  expect(xml).not.toContain('<staves>'); expect(count(xml, '<clef')).toBe(1);
  expect(irregular).toEqual([1]);
});
it('füllt leere Systeme mit Pausen und überspringt ungültige Töne', () => {
  const { xml } = toMusicXML(score([measure([[n(['C4', 'X9'], 'whole')]], []), measure([[n(['D4'], 'whole')]], [[n(['C3'], 'whole')]])]));
  expect(xml).toContain('<rest measure="yes"/><duration>192</duration><voice>5</voice><staff>2</staff>');
  expect(count(xml, '<pitch>')).toBe(3);
});
it('meldet unlesbare Bilder mit dem Hinweis der KI', () => {
  expect(() => toMusicXML(score([], { readable: false, problem: 'Auf dem Foto sind keine Noten zu sehen.' }))).toThrow('keine Noten zu sehen');
  expect(() => toMusicXML(score([measure([], [])]))).toThrow('keine Klaviernoten');
});
