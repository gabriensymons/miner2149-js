/**
 * Development-only power-plant overload trigger: the dev panel's Power plant tab.
 *
 * Never reaches production; see meteor-trigger.js. It strikes the colony with
 * the real rule and the real scene, so what plays is exactly what a turn would
 * play -- the damage, the scene, the news and the redraw. A colony it struck is
 * marked `devSandbox`, which keeps it off the records and out of the unlocks.
 */

import { DISASTER_IDS } from '../disaster-rules.js';
import { GAME_KINDS } from '../breaker-games.js';
import { countdownFor, faultsToContainFor, unitCountForClass } from '../power-plant-overload.js';
import { PANEL_ID, devPanel } from './dev-panel.js';

// As the meteor tab: "Colony" plays at the mine's own class, a number overrides
// it for this overload only.
const COLONY_CLASS = 'colony';

/**
 * @param {object} capabilities
 * @param {() => boolean} capabilities.isPlayable    false on menus and title screens
 * @param {(patch: object) => void} capabilities.markSandbox
 * @param {(disasterId: string, scene: {difficulty?: number, countdownMs?: number, kind?: string}) => {applied: boolean}} capabilities.strike
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
    <label title="Asteroid class the panel is played at: it sets how many units there are. Overrides the colony's own class for this overload only.">Class <select id="${PANEL_ID}-overload-class">
      <option value="${COLONY_CLASS}">Colony</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
      <option value="4">4</option>
      <option value="5">5</option>
    </select></label>
    <label title="Which repair the lit unit opens. Random is the game's own draw, never the same kind twice running.">Repair <select id="${PANEL_ID}-overload-kind" style="width: auto">
      <option value="">Random</option>
      ${GAME_KINDS.map((kind) => `<option value="${kind}">${kind}</option>`).join('')}
    </select></label>
    <label title="Seconds on the clock once the lit unit is tapped. Blank is the class's own.">Countdown <input id="${PANEL_ID}-overload-countdown" type="number" min="1" max="120" step="1" placeholder="class"></label>
    <p class="derived" id="${PANEL_ID}-overload-derived"></p>
    <button id="${PANEL_ID}-overload" type="button">Trigger overload</button>
    <p class="status" id="${PANEL_ID}-overload-status"></p>
  `;
  const button = tab.querySelector(`#${PANEL_ID}-overload`);
  const status = tab.querySelector(`#${PANEL_ID}-overload-status`);
  const classSelect = tab.querySelector(`#${PANEL_ID}-overload-class`);
  const derived = tab.querySelector(`#${PANEL_ID}-overload-derived`);
  const kindSelect = tab.querySelector(`#${PANEL_ID}-overload-kind`);
  const countdownInput = tab.querySelector(`#${PANEL_ID}-overload-countdown`);

  function selectedClass() {
    return classSelect.value === COLONY_CLASS ? undefined : Number(classSelect.value);
  }

  function describeClass() {
    const difficulty = selectedClass();
    derived.textContent = difficulty === undefined
      ? 'Class from colony.'
      : `Class ${difficulty} \u00b7 ${unitCountForClass(difficulty)} units \u00b7 `
        + `${faultsToContainFor(difficulty)} to contain \u00b7 ${countdownFor(difficulty) / 1000} s`;
  }
  classSelect.addEventListener('change', describeClass);
  describeClass();

  function setStatus(text, flagged = false) {
    status.textContent = text;
    status.classList.toggle('flag', flagged);
  }

  button.addEventListener('click', () => {
    if (!isPlayable()) {
      setStatus('Start a mine first.');
      return;
    }
    const seconds = Number(countdownInput.value);
    const { applied } = strike(DISASTER_IDS.POWER_PLANT_EXPLOSION, {
      difficulty: selectedClass(),
      countdownMs: seconds > 0 ? Math.min(120, seconds) * 1000 : undefined,
      kind: kindSelect.value || undefined,
    });
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
