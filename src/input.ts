export const KEY_BINDINGS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'z', 'h', 'u', 'j', 'k'];
export class NoteInput {
  private held = new Map<string, number>();
  base = 60;
  onPress: (midi: number, velocity?: number) => void = () => {};
  onRelease: (midi: number) => void = () => {};
  press(source: string, midi: number, velocity = 0.7): void {
    if (this.held.has(source)) return;
    const alreadyHeld = [...this.held.values()].includes(midi);
    this.held.set(source, midi);
    if (!alreadyHeld) this.onPress(midi, velocity);
  }
  release(source: string): void {
    const midi = this.held.get(source); this.held.delete(source);
    if (midi !== undefined && ![...this.held.values()].includes(midi)) this.onRelease(midi);
  }
  clear(): void { for (const source of [...this.held.keys()]) this.release(source); }
  clearPrefix(prefix: string): void { for (const source of [...this.held.keys()]) if (source.startsWith(prefix)) this.release(source); }
  get pressed(): number[] { return [...new Set(this.held.values())]; }
  bindKeyboard(): void {
    document.addEventListener('keydown', event => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest('input, select, textarea'))) return;
      const offset = KEY_BINDINGS.indexOf(event.key.toLowerCase());
      if (offset >= 0 && this.base + offset <= 108) { event.preventDefault(); this.press(`key:${event.code}`, this.base + offset); }
    });
    document.addEventListener('keyup', event => this.release(`key:${event.code}`));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
  }
}
