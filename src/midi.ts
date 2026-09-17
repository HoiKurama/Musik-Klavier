import type { NoteInput } from './input';

export function parseMidiMessage(data: ArrayLike<number>): { kind: 'on' | 'off'; midi: number; velocity: number } | undefined {
  if (data.length < 3 || data[1] < 21 || data[1] > 108) return;
  const command = data[0] & 0xf0;
  if (command === 0x80 || (command === 0x90 && data[2] === 0)) return { kind:'off', midi:data[1], velocity:0 };
  if (command === 0x90) return { kind:'on', midi:data[1], velocity:Math.max(0, Math.min(1, data[2] / 127)) };
}
export class MidiInput {
  private access?: MIDIAccess;
  private port?: MIDIInput;
  onStatus: (text: string, ports: MIDIInput[]) => void = () => {};
  constructor(private input: NoteInput) {}
  async connect(): Promise<void> {
    if (!navigator.requestMIDIAccess) throw new Error('Dieser Browser unterstützt MIDI nicht. Bitte Google Chrome oder Microsoft Edge verwenden.');
    if (!this.access) {
      this.access = await navigator.requestMIDIAccess({ sysex:false });
      this.access.onstatechange = () => this.refresh();
    }
    this.refresh();
  }
  select(id: string): void {
    if (this.port) this.port.onmidimessage = null;
    this.input.clearPrefix('midi:'); this.port = this.access?.inputs.get(id);
    const port=this.port;
    if (port) port.onmidimessage = event => {
      if (!event.data) return;
      const note = parseMidiMessage(event.data); if (!note) return;
      const source = `midi:${port.id}:${event.data[0] & 0x0f}:${note.midi}`;
      if (note.kind === 'on') this.input.press(source,note.midi,note.velocity);
      else this.input.release(source);
    };
    this.report();
  }
  private refresh(): void {
    const ports = [...this.access!.inputs.values()].filter(p => p.state === 'connected');
    if (!this.port || !ports.some(p => p.id === this.port!.id)) this.select(ports[0]?.id ?? '');
    else this.report();
  }
  private report(): void {
    const ports = this.access ? [...this.access.inputs.values()].filter(p=>p.state==='connected') : [];
    this.onStatus(this.port ? `Verbunden: ${this.port.name || 'Digitalpiano'}` : 'Kein MIDI-Eingang gefunden. Digitalpiano per USB verbinden.', ports);
  }
}
export function installMidiControls(host: HTMLElement, input: NoteInput): MidiInput {
  const section = document.createElement('section'); section.className = 'control-section';
  section.innerHTML = `<h2>Dein Digitalpiano</h2><button id="midi-connect" class="secondary full-width">Digitalpiano verbinden</button><select id="midi-device" class="full-width" aria-label="MIDI-Eingabegerät" hidden></select><p id="midi-status" class="hint" role="status">Optional: MIDI per USB, wenn dein Browser es unterstützt. Der Zugriff erfolgt erst nach deinem Klick.</p>`;
  host.append(section); const midi = new MidiInput(input);
  const button = section.querySelector<HTMLButtonElement>('#midi-connect')!;
  const select = section.querySelector<HTMLSelectElement>('#midi-device')!;
  midi.onStatus = (text, ports) => {
    section.querySelector('#midi-status')!.textContent=text;const previous=select.value;select.replaceChildren();
    for (const port of ports) {const option=document.createElement('option');option.value=port.id;option.textContent=port.name || 'Digitalpiano';select.append(option);}
    select.hidden=!ports.length;if(ports.some(p=>p.id===previous))select.value=previous;
    button.textContent='MIDI-Geräte aktualisieren';
  };
  button.addEventListener('click', () => {
    button.disabled=true;
    void midi.connect().catch(error=>{section.querySelector('#midi-status')!.textContent=error instanceof Error && error.name==='NotAllowedError' ? 'MIDI-Zugriff wurde nicht erlaubt. Du kannst weiter per Bildschirm oder Computertastatur üben.' : error instanceof Error ? error.message : 'MIDI konnte nicht verbunden werden.';}).finally(()=>button.disabled=false);
  });
  select.addEventListener('change',()=>midi.select(select.value));return midi;
}
