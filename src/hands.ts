import type { PracticeEngine } from './engine';
import type { Settings } from './types';

export function installHandControls(host: HTMLElement, mappingHost: HTMLElement, getEngine: () => PracticeEngine | undefined, configure: (settings: Partial<Settings>) => void): { loaded: () => void; sync: () => void } {
  const section = document.createElement('section'); section.className = 'hand-control';
  section.innerHTML = `<h2>Handwahl</h2><div class="segmented hands" role="group" aria-label="Handwahl"><button data-hand="both" aria-pressed="true">Beide</button><button data-hand="right" aria-pressed="false">Rechts</button><button data-hand="left" aria-pressed="false">Links</button></div>`;
  host.append(section);
  const mapping = document.createElement('section'); mapping.className = 'control-section';
  mapping.innerHTML = `<details class="mapping"><summary>Notensysteme zuordnen</summary><div class="details-content"><label>Rechte Hand<select id="right-staff"></select></label><label>Linke Hand<select id="left-staff"></select></label><p class="hint">Standard: oben rechts, unten links. Bei überkreuzten Händen die Zuordnung prüfen.</p></div></details>`;
  mappingHost.append(mapping);
  function sync(): void {
    const engine = getEngine(); if (!engine) return;
    for (const button of section.querySelectorAll<HTMLButtonElement>('[data-hand]')) button.setAttribute('aria-pressed', String(button.dataset.hand === engine.settings.hand));
    for (const id of ['right', 'left'] as const) mapping.querySelector<HTMLSelectElement>(`#${id}-staff`)!.value = String(engine.settings[id === 'right' ? 'rightStaff' : 'leftStaff']);
  }
  for (const button of section.querySelectorAll<HTMLButtonElement>('[data-hand]')) button.addEventListener('click', () => { configure({ hand: button.dataset.hand as Settings['hand'] }); sync(); });
  for (const id of ['right', 'left'] as const) mapping.querySelector(`#${id}-staff`)!.addEventListener('change', event => { configure({ [id === 'right' ? 'rightStaff' : 'leftStaff']: Number((event.target as HTMLSelectElement).value) }); sync(); });
  return { sync, loaded: () => {
    const engine = getEngine(); if (!engine) return;
    for (const select of mapping.querySelectorAll<HTMLSelectElement>('select')) {
      select.replaceChildren();
      for (const [index,label] of engine.score.staves.entries()) { const option = document.createElement('option'); option.value=String(index);option.textContent=label;select.append(option); }
    }
    sync();
  } };
}
