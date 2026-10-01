/**
 * Awarding the PDA frame attached to an in-game trigger, and telling the site.
 *
 * Gated on `!devSandbox` rather than on `isNormalSession()`. The two are
 * different boundaries (AGENTS.md): isNormalSession also demands that the
 * asteroid class match, so gating cosmetics on it would mean a colony played at
 * a class it was not surveyed at could unlock nothing -- and Disaster Mode, which
 * isNormalSession allows, must keep unlocking too. Scores need that strictness;
 * frames do not. A storm forced from the dev panel sets devSandbox, so it is not
 * earned and does not unlock, with no knowledge of the dev tooling here.
 *
 * One grant function is built once and handed to every controller that awards a
 * frame: the economy, the map, the endings, the disasters and the turn.
 *
 * Injected: the session (for devSandbox), the storage unlock progress lives in,
 * the dialog queue the news flash goes into, and `announce`, which tells the
 * site chrome -- `app.js` dispatches the event `site-controls.js` listens for, so
 * this module stays free of the DOM.
 */

import { grantUnlockForTrigger } from './unlock-progress.js';

export function createSkinGrant({ session, storage, enqueue, announce }) {
  return function grantSkinForTrigger(trigger) {
    if (session.getState().devSandbox) return;
    const { changed, skin } = grantUnlockForTrigger(storage, trigger);
    if (!changed || !skin) return;
    // Announced on the canvas as well as in the site chrome: the player is looking
    // at the game when it happens, and a toast behind the console is easy to miss.
    enqueue(`NEWS FLASH: ${skin.label} handheld issued to your field kit.`);
    announce(skin.id);
  };
}
