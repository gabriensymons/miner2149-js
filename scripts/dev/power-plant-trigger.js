/**
 * Development-only power-plant overload trigger: the dev panel's Power plant tab.
 *
 * Never reaches production; see meteor-trigger.js. It strikes the colony with
 * the real rule and the real scene, so what plays is exactly what a turn would
 * play -- the damage, the scene, the news and the redraw. A colony it struck is
 * marked `devSandbox`, which keeps it off the records and out of the unlocks.
 */

import { DISASTER_IDS } from '../disaster-rules.js';
import { PANEL_ID, devPanel } from './dev-panel.js';

/**
 * @param {object} capabilities
 * @param {() => boolean} capabilities.isPlayable    false on menus and title screens
 * @param {(patch: object) => void} capabilities.markSandbox
 * @param {(disasterId: string) => {applied: boolean}} capabilities.strike
 *   forces one disaster through its rule and queues what follows
 * @param {Document} [capabilities.documentRef]
 */
export function installPowerPlantTrigger({
  isPlayable,
  markSandbox,
  strike,
  documentRef = globalThis.document,
}) {
  if (!documentRef || documentRef.getElementById(`${PANEL_ID}-overload`)) return null;

  const tab = devPanel(documentRef).addTab('power-plant', 'Power plant');
  tab.innerHTML = `
    <p class="derived">Needs a power plant on level 1, as the rule does.</p>
    <button id="${PANEL_ID}-overload" type="button">Trigger overload</button>
    <p class="status" id="${PANEL_ID}-overload-status"></p>
  `;
  const button = tab.querySelector(`#${PANEL_ID}-overload`);
  const status = tab.querySelector(`#${PANEL_ID}-overload-status`);

  function setStatus(text, flagged = false) {
    status.textContent = text;
    status.classList.toggle('flag', flagged);
  }

  button.addEventListener('click', () => {
    if (!isPlayable()) {
      setStatus('Start a mine first.');
      return;
    }
    const { applied } = strike(DISASTER_IDS.POWER_PLANT_EXPLOSION);
    if (!applied) {
      setStatus('No power plant on level 1.');
      return;
    }
    markSandbox({ devSandbox: true });
    setStatus('Overload struck · SANDBOX, UNRANKED', true);
  });

  setStatus('Ready.');
  return tab;
}
