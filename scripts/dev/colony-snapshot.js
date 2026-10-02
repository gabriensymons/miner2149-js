/**
 * Development-only colony snapshot: capture the colony, play on, put it back.
 *
 * Like everything in `scripts/dev/`, this never reaches production
 * (`tools/build-static.js`, proved by `test/dev-tooling-excluded.test.js`).
 *
 * A restore goes through the same seam as loading a save: the colony is
 * replaced in the session and the mine is entered as a loaded colony, so the
 * screen is redrawn from state and the surface revealed exactly as after a
 * load. Nothing here draws.
 *
 * The minimal version of the developer console's snapshot step (section I):
 * one snapshot, in memory, captured and restored only while the mine screen is
 * idle -- no dialog, menu, reveal or storm over it. Restoring from the middle
 * of a turn would need the turn's queued messages and phase captured as well,
 * which is the full version's job. A restored colony is always a sandbox: the
 * snapshot may predate the panel's first change, and putting back a colony is
 * itself a change no player could make.
 */

import { PANEL_ID } from './meteor-trigger.js';

/**
 * @param {object} capabilities
 * @param {() => object} capabilities.getColony           the session's colony
 * @param {(colony: object) => void} capabilities.restoreColony  replaces it and enters the mine
 * @param {() => boolean} capabilities.isIdle             the mine screen is showing and taking input
 * @param {(value: object) => object} [capabilities.clone]
 */
export function createColonySnapshot({ getColony, restoreColony, isIdle, clone = structuredClone }) {
  let snapshot = null;

  function capture() {
    if (!isIdle()) return { ok: false, reason: 'Only from the mine screen, with nothing over it.' };
    // A copy, so playing on cannot reach into it.
    snapshot = clone(getColony());
    return { ok: true, day: snapshot.day };
  }

  function restore() {
    if (!snapshot) return { ok: false, reason: 'Capture a snapshot first.' };
    if (!isIdle()) return { ok: false, reason: 'Only from the mine screen, with nothing over it.' };
    // A fresh copy each time, so the same snapshot can be restored again.
    restoreColony({ ...clone(snapshot), devSandbox: true });
    return { ok: true, day: snapshot.day };
  }

  return { capture, restore, hasSnapshot: () => snapshot !== null };
}

/**
 * Adds the snapshot controls to the development panel the meteor trigger
 * mounts. Installed after it; does nothing if the panel is not there.
 */
export function installColonySnapshot(capabilities, { documentRef = globalThis.document } = {}) {
  const panel = documentRef?.getElementById(PANEL_ID);
  if (!panel) return null;

  const snapshots = createColonySnapshot(capabilities);
  const section = documentRef.createElement('div');
  section.innerHTML = `
    <h2 style="margin-top: 12px">Dev · snapshot</h2>
    <button id="${PANEL_ID}-capture" type="button">Capture colony</button>
    <button id="${PANEL_ID}-restore" type="button" disabled>Restore colony</button>
    <p class="status" id="${PANEL_ID}-snapshot-status"></p>
  `;
  panel.appendChild(section);

  const captureButton = section.querySelector(`#${PANEL_ID}-capture`);
  const restoreButton = section.querySelector(`#${PANEL_ID}-restore`);
  const status = section.querySelector(`#${PANEL_ID}-snapshot-status`);

  function report(result, done) {
    status.textContent = result.ok ? done(result) : result.reason;
    status.classList.toggle('flag', !result.ok);
    restoreButton.disabled = !snapshots.hasSnapshot();
  }

  captureButton.addEventListener('click', () => {
    report(snapshots.capture(), ({ day }) => `Captured day ${day}.`);
  });
  restoreButton.addEventListener('click', () => {
    report(snapshots.restore(), ({ day }) => `Restored day ${day}. SANDBOX // UNRANKED`);
  });

  return snapshots;
}
