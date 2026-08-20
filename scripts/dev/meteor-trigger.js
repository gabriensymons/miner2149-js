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

const PANEL_ID = 'miner-dev-panel';

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
#${PANEL_ID} input { width: 58px; font: inherit; padding: 2px 4px;
  background: #0d1119; color: #d7dee9; border: 1px solid #38455c; border-radius: 3px; }
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
 * @param {Document} [capabilities.documentRef]
 */
export function installMeteorTrigger({
  getGameData,
  markSandbox,
  isPlayable,
  startMeteorStorm,
  applyMeteorStormResult,
  getBuildingCounts,
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
    <button id="${PANEL_ID}-run" type="button">Trigger storm</button>
    <p class="status" id="${PANEL_ID}-status"></p>
  `;
  documentRef.body.appendChild(panel);

  const runButton = panel.querySelector(`#${PANEL_ID}-run`);
  const countInput = panel.querySelector(`#${PANEL_ID}-count`);
  const status = panel.querySelector(`#${PANEL_ID}-status`);

  function setStatus(text, flagged = false) {
    status.textContent = text;
    status.classList.toggle('flag', flagged);
  }

  runButton.addEventListener('click', () => {
    if (!isPlayable()) {
      setStatus('Start a mine first.');
      return;
    }
    const meteorCount = Math.max(1, Math.min(40, Number(countInput.value) || 12));
    const state = getGameData();

    markSandbox({ devSandbox: true });
    runButton.disabled = true;
    setStatus(`Storm running · ${meteorCount} meteors`);

    startMeteorStorm({
      day: state.day,
      difficulty: state.difficulty,
      jobs: state.jobs,
      efficiency: state.efficiency,
      buildingCounts: getBuildingCounts(),
      meteorCount,
    }, (result) => {
      applyMeteorStormResult(result, () => {
        runButton.disabled = false;
        const { destroyed, missed, total } = result.stats;
        setStatus(`Hit ${destroyed}/${total}, missed ${missed} · SANDBOX, UNRANKED`, true);
      });
    });
  });

  setStatus('Ready.');
  return panel;
}
