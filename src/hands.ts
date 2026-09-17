import type { PracticeEngine } from './engine';
import type { Settings } from './types';

export function installHandControls(host: HTMLElement, getEngine: () => PracticeEngine | undefined, configure: (settings: Partial<Settings>) => void): { loaded: () => void; sync: () => void } {
  const section = document.createElement('section'); section.className = 'control-section';
  section.innerHTML = `<h2>Welche Hand?</h2><div class="segmented hands"><button data-hand="both" aria-pressed="true">Beide</button><button data-hand="right" aria-pressed="false">Rechts</button><button data-hand="left" aria-pressed="false">Links</button></div><details class="mapping"><summary>Notensysteme zuordnen</summary><label>Rechte Hand<select id="right-staff"></select></label><label>Linke Hand<select id="left-staff"></select></label><p class="hint">Standard: oben rechts, unten links. Bei überkreuzten Händen die Zuordnung prüfen.</p></details>`;
  host.append(section);
  function sync(): void {
    const engine = getEngine(); if (!engine) return;
    for (const button of section.querySelectorAll<HTMLButtonElement>('[data-hand]')) button.setAttribute('aria-pressed', String(button.dataset.hand === engine.settings.hand));
    for (const id of ['right', 'left'] as const) section.querySelector<HTMLSelectElement>(`#${id}-staff`)!.value = String(engine.settings[id === 'right' ? 'rightStaff' : 'leftStaff']);
  }
  for (const button of section.querySelectorAll<HTMLButtonElement>('[data-hand]')) button.addEventListener('click', () => { configure({ hand: button.dataset.hand as Settings['hand'] }); sync(); });
  for (const id of ['right', 'left'] as const) section.querySelector(`#${id}-staff`)!.addEventListener('change', event => { configure({ [id === 'right' ? 'rightStaff' : 'leftStaff']: Number((event.target as HTMLSelectElement).value) }); sync(); });
  return { sync, loaded: () => {
    const engine = getEngine(); if (!engine) return;
    for (const select of section.querySelectorAll<HTMLSelectElement>('select')) {
      select.replaceChildren();
      for (const [index,label] of engine.score.staves.entries()) { const option = document.createElement('option'); option.value=String(index);option.textContent=label;select.append(option); }
    }
    sync();
  } };
}
