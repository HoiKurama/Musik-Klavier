import { selected, type Score, type Settings, type Step } from './types';

export class PracticeEngine {
  mode: 'listen' | 'step' = 'listen';
  playing = false;
  finished = false;
  beat = 0;
  stepIndex = 0;
  collected = new Set<number>();
  revision = 0;
  onResult: (correct: boolean) => void = () => {};
  constructor(public score: Score, public settings: Settings) { this.reset(); }
  get bounds(): [number, number] {
    if (!this.settings.loop) return [0, this.score.measures.at(-1)!.end];
    return [this.score.measures[this.settings.from].start, this.score.measures[this.settings.to].end];
  }
  get steps(): Step[] {
    const [from, to] = this.bounds;
    return this.score.steps.filter(step => step.beat >= from - 1e-7 && step.beat < to - 1e-7 && step.notes.some(n => selected(n, this.settings)));
  }
  get current(): Step | undefined { return this.steps[this.stepIndex]; }
  get expected(): number[] { return [...new Set(this.current?.notes.filter(n => selected(n, this.settings)).map(n => n.midi) ?? [])]; }
  get measureIndex(): number { return this.score.measures.findLastIndex(m => m.start <= this.beat + 1e-7); }
  get active(): number[] { return this.score.notes.filter(n => selected(n, this.settings) && n.start <= this.beat + 1e-7 && n.end > this.beat + 1e-7).map(n => n.midi); }
  reset(): void { this.playing = false; this.finished = false; this.beat = this.bounds[0]; this.stepIndex = 0; this.collected.clear(); if (this.mode === 'step' && this.current) this.beat = this.current.beat; this.revision++; }
  configure(next: Partial<Settings>): void { this.settings = { ...this.settings, ...next }; this.reset(); }
  setMode(mode: 'listen' | 'step'): void { this.mode = mode; this.reset(); }
  seek(measure: number): void {
    this.playing = false; this.finished = false; this.collected.clear();
    this.beat = Math.max(this.bounds[0], Math.min(this.bounds[1], this.score.measures[measure].start));
    this.stepIndex = this.steps.findIndex(s => s.beat >= this.beat - 1e-7);
    if (this.stepIndex < 0) { this.stepIndex = this.steps.length; this.finished = true; }
    else if (this.mode === 'step') this.beat = this.current!.beat;
    this.revision++;
  }
  toggle(): void { if (this.finished) this.reset(); this.playing = !this.playing; this.revision++; }
  advance(seconds: number): void {
    if (!this.playing || this.mode !== 'listen') return;
    this.beat += seconds * this.settings.bpm / 60;
    const [from, to] = this.bounds;
    if (this.beat >= to - 1e-7) {
      if (this.settings.loop) { this.beat = from + (this.beat - from) % (to - from); this.revision++; }
      else { this.beat = to; this.playing = false; this.finished = true; this.revision++; }
    }
  }
  press(midi: number): 'correct' | 'wrong' | 'ignored' {
    if (this.mode !== 'step' || this.finished || !this.current) return 'ignored';
    if (!this.expected.includes(midi)) { this.onResult(false); return 'wrong'; }
    if (this.collected.has(midi)) return 'ignored';
    this.collected.add(midi);
    if (this.expected.every(n => this.collected.has(n))) {
      this.onResult(true); this.collected.clear(); this.stepIndex++;
      if (!this.current) {
        if (this.settings.loop && this.steps.length) this.stepIndex = 0;
        else { this.finished = true; this.revision++; return 'correct'; }
      }
      this.beat = this.current!.beat; this.revision++;
    }
    return 'correct';
  }
}
