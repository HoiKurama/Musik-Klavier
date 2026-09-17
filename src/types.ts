export type Hand = 'both' | 'right' | 'left';
export interface ScoreNote { id: number; midi: number; start: number; end: number; staff: number; voice: string }
export interface Measure { index: number; label: string; start: number; end: number }
export interface Step { beat: number; measure: number; notes: ScoreNote[]; cursorIndex: number }
export interface Score { title: string; hash: string; bpm: number; notes: ScoreNote[]; measures: Measure[]; steps: Step[]; staves: string[]; warnings: string[] }
export interface Settings { bpm: number; hand: Hand; rightStaff: number; leftStaff: number; loop: boolean; from: number; to: number }
export function selected(note: ScoreNote, settings: Settings): boolean {
  return settings.hand === 'both' || note.staff === (settings.hand === 'right' ? settings.rightStaff : settings.leftStaff);
}
export function noteName(midi: number): string {
  return ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'B', 'H'][midi % 12] + (Math.floor(midi / 12) - 1);
}
