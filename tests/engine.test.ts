import { describe, expect, it } from 'vitest';
import { PracticeEngine } from '../src/engine';
import { NoteInput } from '../src/input';
import { decodeMusicXML } from '../src/import';
import type { Score, ScoreNote, Settings } from '../src/types';
const notes: ScoreNote[] = [
  { id: 0, midi: 60, start: 0, end: 8, staff: 0, voice: '1' },
  { id: 1, midi: 48, start: 0, end: 2, staff: 1, voice: '2' },
  { id: 2, midi: 64, start: 1, end: 2, staff: 0, voice: '1' },
  { id: 3, midi: 64, start: 2, end: 3, staff: 0, voice: '1' },
  { id: 4, midi: 55, start: 4, end: 8, staff: 1, voice: '2' }
];
const score: Score = { title: 'Test', hash: 'test', bpm: 60, warnings: [], staves: ['1','2'], notes, measures: [{index:0,label:'1',start:0,end:4},{index:1,label:'2',start:4,end:8}], steps: [0,1,2,3,4].map((beat,i) => ({beat,measure:beat<4?0:1,notes:notes.filter(n=>n.start===beat),cursorIndex:i})) };
const settings: Settings = { bpm:60, hand:'both', rightStaff:0, leftStaff:1, loop:false, from:0, to:1 };
const create = () => new PracticeEngine(score, { ...settings });
describe('Übeablauf', () => {
  it('sammelt einen Akkord und behält richtige Teilnoten bei falscher Eingabe', () => {
    const engine=create(); engine.setMode('step'); const results:boolean[]=[]; engine.onResult = correct=>results.push(correct);
    expect(engine.expected).toEqual([60,48]); engine.press(60); engine.press(61);
    expect(engine.stepIndex).toBe(0); expect([...engine.collected]).toEqual([60]); engine.press(48);
    expect(engine.beat).toBe(1); expect(results).toEqual([false,true]);
  });
  it('überspringt Pausen und fordert Haltebogenfortsetzungen nicht an', () => {
    const engine=create(); engine.setMode('step'); engine.press(60); engine.press(48); engine.press(64); engine.press(64);
    expect(engine.beat).toBe(4); expect(engine.expected).toEqual([55]); engine.press(55); expect(engine.finished).toBe(true);
  });
  it('fordert für wiederholte Töne einen frischen Anschlag, auch bei mehreren Eingabequellen', () => {
    const engine=create(); engine.setMode('step'); engine.press(60); engine.press(48);
    const input=new NoteInput(); input.onPress=midi=>engine.press(midi);
    input.press('key:1',64); input.press('key:1',64); input.press('midi:1',64);
    expect(engine.beat).toBe(2); input.release('key:1'); input.release('midi:1'); input.press('key:1',64); expect(engine.beat).toBe(4);
  });
  it('pausiert und setzt fort; Tempoänderung verändert die Zeit, nicht die Position', () => {
    const engine=create(); engine.toggle(); engine.advance(1); expect(engine.beat).toBe(1); engine.toggle(); engine.advance(2); expect(engine.beat).toBe(1);
    engine.settings.bpm=120; engine.toggle(); engine.advance(.5); expect(engine.beat).toBe(2);
  });
  it('wiederholt beide Taktgrenzen einschließlich und bereinigt den Schrittzustand', () => {
    const engine=create(); engine.configure({loop:true,from:1,to:1}); engine.toggle(); engine.advance(4.25); expect(engine.beat).toBeCloseTo(4.25);
    engine.setMode('step'); engine.press(55); expect(engine.beat).toBe(4); expect(engine.stepIndex).toBe(0); expect(engine.collected.size).toBe(0);
  });
  it('filtert Hände und erlaubt eine andere Zuordnung', () => {
    const engine=create(); engine.configure({hand:'left'}); engine.setMode('step'); expect(engine.expected).toEqual([48]); engine.press(48); expect(engine.expected).toEqual([55]);
    engine.configure({leftStaff:0}); expect(engine.expected).toEqual([60]);
  });
  it('endet am Stückende und startet erneut', () => { const engine=create(); engine.toggle(); engine.advance(20); expect(engine.finished).toBe(true); expect(engine.playing).toBe(false); engine.toggle(); expect(engine.beat).toBe(0); });
});
describe('Dateidekodierung', () => {
  it('weist leere und kaputte Archive zurück', () => { expect(()=>decodeMusicXML(new Uint8Array())).toThrow('leer'); expect(()=>decodeMusicXML(new Uint8Array([80,75,1,2]))).toThrow('beschädigt'); });
  it('dekodiert UTF-8 und eine deklarierte Legacy-Kodierung', () => {
    expect(decodeMusicXML(new TextEncoder().encode('<xml>Übung</xml>'))).toContain('Übung');
    const text='<?xml version="1.0" encoding="ISO-8859-1"?><xml>\xdc</xml>';
    expect(decodeMusicXML(Uint8Array.from(text,c=>c.charCodeAt(0)))).toContain('Ü');
  });
});
