/**
 * Development-only meteor storm trigger.
 *
 * This file never reaches production: `tools/build-static.js` skips
 * `scripts/dev/` when it copies `scripts/`, and strips the `dev-only` region
 * from `app.js` that imports it. `test/dev-tooling-excluded.test.js` proves
 * both, so the guarantee is checked rather than assumed.
 *
 * It takes a capability object rather than reading globals, so nothing here can
 * reach into game state that was not deliberately handed over.
 *
 * Any session that uses it is marked `devSandbox`, which makes
 * `isNormalSession()` false and so blocks a local best score. Storms you did
 * not earn must not produce a ranked result.
 */

import { rechargeStepForClass, tankGlanceToleranceForClass } from '../meteor-storm.js';

const PANEL_ID = 'miner-dev-panel';

// "Colony" runs the storm at whatever class the current mine actually is; the
// numbered options override it so the whole gradient can be played back to back
// without starting five colonies. Only the storm sees the override -- gameData
// is not touched, so nothing else in the session shifts class underneath it.
const COLONY_CLASS = 'colony';

const STYLE = `
#${PANEL_ID} {
  position: fixed; left: 12px; bottom: 12px; z-index: 9999;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #12161f; color: #d7dee9; border: 1px solid #38455c;
  border-radius: 6px; padding: 10px 12px; min-width: 190px;
  box-shadow: 0 6px 20px rgba(0,0,0,.45);
}
#${PANEL_ID} h2 {
  margin: 0 0 8px; font-size: 11px; letter-spacing: .09em;
  text-transform: uppercase; color: #8fa3c0; font-weight: 600;
}
#${PANEL_ID} button {
  display: block; width: 100%; margin-top: 6px; padding: 6px 8px;
  font: inherit; color: #f2f6fb; background: #24304a;
  border: 1px solid #3d4d6b; border-radius: 4px; cursor: pointer;
}
#${PANEL_ID} button:hover:not(:disabled) { background: #2f3e5e; }
#${PANEL_ID} button:disabled { opacity: .45; cursor: not-allowed; }
#${PANEL_ID} label { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
#${PANEL_ID} input, #${PANEL_ID} select { width: 58px; font: inherit; padding: 2px 4px;
  background: #0d1119; color: #d7dee9; border: 1px solid #38455c; border-radius: 3px; }
#${PANEL_ID} .derived { margin: 6px 0 0; color: #7f8ea6; font-size: 11px; }
#${PANEL_ID} .status { margin-top: 8px; color: #7f8ea6; min-height: 1.4em; }
#${PANEL_ID} .flag { color: #e0a340; font-weight: 600; }
`;

/**
 * @param {object} capabilities
 * @param {() => object} capabilities.getGameData    current game state (read-only use)
 * @param {(patch: object) => void} capabilities.markSandbox
 * @param {() => boolean} capabilities.isPlayable    false on menus and title screens
 * @param {(command: object, done: Function) => void} capabilities.startMeteorStorm
 * @param {(result: object, done: Function) => void} capabilities.applyMeteorStormResult
 * @param {() => object} capabilities.getBuildingCounts
 * @param {() => void} [capabilities.resetUnlocks]  clears earned device frames
 * @param {Document} [capabilities.documentRef]
 */
export function installMeteorTrigger({
  getGameData,
  markSandbox,
  isPlayable,
  startMeteorStorm,
  applyMeteorStormResult,
  getBuildingCounts,
  resetUnlocks,
  documentRef = globalThis.document,
}) {
  if (!documentRef || documentRef.getElementById(PANEL_ID)) return null;

  const style = documentRef.createElement('style');
  style.textContent = STYLE;
  documentRef.head.appendChild(style);

  const panel = documentRef.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <h2>Dev · meteor</h2>
    <label>Meteors <input id="${PANEL_ID}-count" type="number" min="1" max="40" value="12"></label>
    <label title="Asteroid class the storm is played at. Overrides the colony's own class for this storm only.">Class <select id="${PANEL_ID}-class">
      <option value="${COLONY_CLASS}">Colony</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
      <option value="4">4</option>
      <option value="5">5</option>
    </select></label>
    <label title="Cooldown units the recharge bar recovers per simulation step. 1 is the original rate; lower refills slower. Refilled from the class on every class change, and from the colony's class each time Colony triggers a storm. Pick a numbered class to override.">Recharge <input id="${PANEL_ID}-recharge" type="number" min="0.1" max="2" step="0.05" value="0.5"></label>
    <label title="Pixels of meteor-on-tank overlap forgiven as a glancing blow. 0 is class 5: any contact wrecks the platform.">Glance <input id="${PANEL_ID}-glance" type="number" min="0" max="8" step="1" value="0"></label>
    <p class="derived" id="${PANEL_ID}-derived"></p>
    <button id="${PANEL_ID}-run" type="button">Trigger storm</button>
    <button id="${PANEL_ID}-reset" type="button">Reset unlocks</button>
    <p class="status" id="${PANEL_ID}-status"></p>
  `;
  documentRef.body.appendChild(panel);

  const runButton = panel.querySelector(`#${PANEL_ID}-run`);
  const countInput = panel.querySelector(`#${PANEL_ID}-count`);
  const rechargeInput = panel.querySelector(`#${PANEL_ID}-recharge`);
  const glanceInput = panel.querySelector(`#${PANEL_ID}-glance`);
  const classSelect = panel.querySelector(`#${PANEL_ID}-class`);
  const derived = panel.querySelector(`#${PANEL_ID}-derived`);
  const status = panel.querySelector(`#${PANEL_ID}-status`);
  const resetButton = panel.querySelector(`#${PANEL_ID}-reset`);

  function setStatus(text, flagged = false) {
    status.textContent = text;
    status.classList.toggle('flag', flagged);
  }

  // The class the next storm will run at: the panel's override, or the colony's
  // own class when the panel is left on "Colony".
  function selectedClass() {
    if (classSelect.value !== COLONY_CLASS) return Number(classSelect.value);
    const colony = Number(getGameData()?.difficulty);
    return Number.isInteger(colony) && colony >= 1 && colony <= 5 ? colony : null;
  }

  // Class changes refill both knobs from the gradient, so the panel shows the
  // numbers a real player of that class would get. Typing over either one is
  // the override, and it survives until the class changes again.
  //
  // On "Colony" the knobs are refreshed again at trigger time, because the panel
  // is installed before any mine exists: syncToClass had nothing to read then
  // and left the markup's own defaults in the boxes, so a storm triggered on
  // Colony used class 5 knobs whatever class the colony actually was, while the
  // status line cheerfully reported the real class beside them. To override on
  // your colony's own class, pick that number rather than Colony.
  function syncToClass() {
    const difficulty = selectedClass();
    if (difficulty === null) {
      derived.textContent = 'Class from colony \u00b7 start a mine.';
      return;
    }
    rechargeInput.value = String(rechargeStepForClass(difficulty));
    glanceInput.value = String(tankGlanceToleranceForClass(difficulty));
    const band = 25 - 2 * tankGlanceToleranceForClass(difficulty);
    derived.textContent = `Class ${difficulty} \u00b7 tank band ${band}px `
      + `(${(band / 140 * 100).toFixed(1)}% of the play span)`;
  }

  classSelect.addEventListener('change', syncToClass);

  runButton.addEventListener('click', () => {
    if (!isPlayable()) {
      setStatus('Start a mine first.');
      return;
    }
    // See syncToClass: on Colony the class is the authority, not whatever the
    // boxes happen to be holding from before there was a mine to read.
    if (classSelect.value === COLONY_CLASS) syncToClass();
    const meteorCount = Math.max(1, Math.min(40, Number(countInput.value) || 12));
    const state = getGameData();
    const difficulty = selectedClass() ?? state.difficulty;
    const rechargeStep = Math.max(0.1, Math.min(2, Number(rechargeInput.value)
      || rechargeStepForClass(difficulty)));
    const glanceTolerance = Math.max(0, Math.min(8, Math.round(Number(glanceInput.value) || 0)));

    markSandbox({ devSandbox: true });
    runButton.disabled = true;
    setStatus(`Storm running · class ${difficulty} · ${meteorCount} meteors `
      + `· recharge ${rechargeStep} · glance ${glanceTolerance}`);

    startMeteorStorm({
      day: state.day,
      difficulty,
      jobs: state.jobs,
      efficiency: state.efficiency,
      buildingCounts: getBuildingCounts(),
      meteorCount,
      rechargeStep,
      glanceTolerance,
    }, (result) => {
      applyMeteorStormResult(result, () => {
        runButton.disabled = false;
        const { destroyed, missed, total } = result.stats;
        setStatus(`Class ${difficulty}: hit ${destroyed}/${total}, missed ${missed} `
          + '· SANDBOX, UNRANKED', true);
      });
    });
  });

  // The Konami reward is a one-time event per browser, so re-testing it needs a
  // way back. This clears earned frames only -- it never grants one, and nothing
  // here can trigger the code itself.
  resetButton.addEventListener('click', () => {
    if (!resetUnlocks) {
      setStatus('No reset capability wired.');
      return;
    }
    resetUnlocks();
    setStatus('Unlocks cleared. Reload to re-test the code.', true);
  });

  syncToClass();
  setStatus('Ready.');
  return panel;
}
