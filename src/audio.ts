import * as Tone from 'tone';
import { selected, type Score, type Settings } from './types';

export class PianoAudio {
  private buffers: Record<string, AudioBuffer> = {};
  private keyboard?: Tone.Sampler;
  private music?: Tone.Sampler;
  private gain = new Tone.Gain(0.65).toDestination();
  private loading?: Promise<void>;
  private scheduled = new Set<number>();
  ready = false;
  async unlock(): Promise<void> {
    Tone.getContext().lookAhead = 0.02;
    await Tone.start();
    if (this.ready) return;
    if (!this.loading) this.loading = this.load().catch(error => { this.loading = undefined; throw error; });
    await this.loading;
  }
  private async load(): Promise<void> {
    const names = ['A0', ...Array.from({ length: 7 }, (_, i) => ['C', 'Ds', 'Fs', 'A'].map(n => n + (i + 1))).flat(), 'C8'];
    const context = Tone.getContext().rawContext;
    await Promise.all(names.map(async name => {
      const response = await fetch(`/piano/${name}.mp3`);
      if (!response.ok) throw new Error('Klaviersamples fehlen. Bitte die lokale Installation prüfen.');
      this.buffers[name.replace('Ds', 'D#').replace('Fs', 'F#')] = await context.decodeAudioData(await response.arrayBuffer());
    }));
    this.keyboard = this.sampler(); this.ready = true;
  }
  private sampler(): Tone.Sampler { return new Tone.Sampler({ urls: this.buffers, release: 0.18 }).connect(this.gain); }
  volume(value: number): void { this.gain.gain.rampTo(value, 0.05); }
  press(midi: number, velocity = 0.7): void { this.keyboard?.triggerAttack(Tone.Frequency(midi, 'midi').toFrequency(), Tone.now(), velocity); }
  release(midi: number): void { this.keyboard?.triggerRelease(Tone.Frequency(midi, 'midi').toFrequency(), Tone.now()); }
  releaseKeyboard(): void { this.keyboard?.releaseAll(); }
  stop(): void { this.music?.dispose(); this.music = undefined; this.scheduled.clear(); }
  update(score: Score, settings: Settings, beat: number, loopEnd: number, fresh: boolean): void {
    if (!this.ready) return;
    if (fresh) this.stop();
    const beginning = !this.music;
    this.music ??= this.sampler();
    const now = Tone.now();
    const horizon = beat + 0.08 * settings.bpm / 60;
    for (const note of score.notes) {
      if (!selected(note, settings) || this.scheduled.has(note.id) || note.start >= loopEnd - 1e-7) continue;
      if (note.end <= beat || note.start > horizon) continue;
      const time = now + Math.max(0, note.start - beat) * 60 / settings.bpm;
      const duration = (Math.min(note.end, loopEnd) - Math.max(note.start, beat)) * 60 / settings.bpm;
      if (duration > 0) this.music.triggerAttackRelease(Tone.Frequency(note.midi, 'midi').toFrequency(), duration, time, 0.65);
      this.scheduled.add(note.id);
    }
  }
  get diagnostics(): { ready: boolean; buffers: number; context: string } { return { ready: this.ready, buffers: Object.keys(this.buffers).length, context: Tone.getContext().state }; }
}
