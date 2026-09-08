/**
 * Cosmetic unlock progress: which PDA frames the player has earned, and the
 * running total they have earned selling diridium.
 *
 * This is deliberately NOT part of `gameData` and not in a save slot.
 * `resetGameData()` wipes gameData on every new mine and loading an older save
 * would roll a counter backwards, so a "lifetime" total kept there would mean
 * "this colony, until you load a save" -- which is not what it says. Unlocks
 * also have to outlive the colony that earned them.
 *
 * Modelled on `scripts/local-best-score.js`: one storage key, storage injected
 * rather than reached for, total validation, and corrupt data reading as empty
 * rather than throwing. Pure apart from the storage argument, so it is testable
 * in Node with a plain object.
 */

import { DEFAULT_SKIN_IDS, skinForTrigger, skinIds } from './skin-catalogue.js';

const STORAGE_KEY = 'miner2149.unlockProgress';

/**
 * Credits earned from selling diridium that unlock the MegaTech frame.
 *
 * Deliberately a lifetime total rather than a credit balance: the game starts
 * the player with a large balance, so a balance threshold would fire on day
 * one. This counts what the colony actually earned.
 */
export const LIFETIME_EARNINGS_TARGET = 1_000_000;

const EMPTY_PROGRESS = Object.freeze({ unlocked: [], lifetimeDiridiumCredits: 0, unseen: [] });

function knownSkinIds() {
  return new Set(skinIds());
}

/**
 * Ids are written to `frame.dataset.skin`, which CSS matches on, so a
 * hand-edited storage value must never reach the DOM.
 */
function validId(id) {
  return typeof id === 'string' && knownSkinIds().has(id);
}

function validProgress(progress) {
  return Array.isArray(progress?.unlocked)
    && progress.unlocked.every(validId)
    && Number.isFinite(progress.lifetimeDiridiumCredits)
    && progress.lifetimeDiridiumCredits >= 0
    // Absent on records written before the badge existed, which read as "all
    // seen" -- the player should not be nagged about frames they already have.
    && (progress.unseen === undefined || (Array.isArray(progress.unseen) && progress.unseen.every(validId)));
}

/**
 * Storage holds only ids the player earned; the frames that ship unlocked are
 * unioned in here. That way changing which frames start unlocked takes effect
 * for existing players instead of depending on what their storage happens to
 * hold.
 */
function withDefaults(unlocked) {
  return [...new Set([...DEFAULT_SKIN_IDS, ...unlocked])];
}

export function readUnlockProgress(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { unlocked: withDefaults([]), lifetimeDiridiumCredits: 0, unseen: [] };
    const progress = JSON.parse(raw);
    if (!validProgress(progress)) {
      return { unlocked: withDefaults([]), lifetimeDiridiumCredits: 0, unseen: [] };
    }
    return {
      unlocked: withDefaults(progress.unlocked),
      lifetimeDiridiumCredits: progress.lifetimeDiridiumCredits,
      unseen: progress.unseen ?? [],
    };
  } catch {
    return { unlocked: withDefaults([]), lifetimeDiridiumCredits: 0, unseen: [] };
  }
}

/**
 * Persists progress, minus the default frames -- storing those would mean a
 * later change to the defaults could not reach a player who already has a
 * record. Returns whether the write actually landed: a browser in private mode
 * or over quota throws, and losing a cosmetic unlock must not take the game
 * down with it.
 */
export function writeUnlockProgress(storage, progress) {
  if (!validProgress(progress)) {
    throw new TypeError('Unlock progress requires known skin ids and a non-negative earnings total.');
  }
  const earned = progress.unlocked.filter((id) => !DEFAULT_SKIN_IDS.includes(id));
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      unlocked: earned,
      lifetimeDiridiumCredits: progress.lifetimeDiridiumCredits,
      unseen: progress.unseen ?? [],
    }));
    return true;
  } catch {
    return false;
  }
}

export function isUnlocked(progress, id) {
  return progress.unlocked.includes(id);
}

/**
 * Awards one frame by id.
 *
 * `changed` is false when the frame was already held, which is what callers use
 * to decide whether to announce anything -- the triggers fire on events that can
 * repeat across a long game, and the tenth meteor storm should not re-announce
 * a frame earned during the first.
 */
export function grantUnlock(storage, id) {
  const progress = readUnlockProgress(storage);
  if (!validId(id)) return { changed: false, progress };
  if (isUnlocked(progress, id)) return { changed: false, progress };

  const next = {
    unlocked: [...progress.unlocked, id],
    lifetimeDiridiumCredits: progress.lifetimeDiridiumCredits,
    // Marked unseen so the site chrome can badge the control that reveals it.
    unseen: [...new Set([...(progress.unseen ?? []), id])],
  };
  writeUnlockProgress(storage, next);
  return { changed: true, progress: next };
}

/** Awards whichever frame a named trigger is attached to in the catalogue. */
export function grantUnlockForTrigger(storage, trigger) {
  const skin = skinForTrigger(trigger);
  if (!skin) return { changed: false, progress: readUnlockProgress(storage), skin: null };
  return { ...grantUnlock(storage, skin.id), skin };
}

/**
 * Adds a diridium sale to the lifetime total and awards MegaTech on crossing
 * the target. The threshold lives here rather than at the call site so it is
 * testable at the boundary instead of being a number buried in app.js.
 */
export function recordDiridiumSale(storage, credits) {
  const progress = readUnlockProgress(storage);
  if (!Number.isFinite(credits) || credits <= 0) {
    return { changed: false, progress, unlocked: [] };
  }

  const total = progress.lifetimeDiridiumCredits + credits;
  const earnedNow = total >= LIFETIME_EARNINGS_TARGET
    && progress.lifetimeDiridiumCredits < LIFETIME_EARNINGS_TARGET;
  const target = skinForTrigger('lifetime-earnings');
  const alreadyHeld = target ? isUnlocked(progress, target.id) : true;
  const unlocked = earnedNow && target && !alreadyHeld ? [target.id] : [];

  const next = {
    unlocked: [...progress.unlocked, ...unlocked],
    lifetimeDiridiumCredits: total,
    unseen: [...new Set([...(progress.unseen ?? []), ...unlocked])],
  };
  writeUnlockProgress(storage, next);
  return { changed: true, progress: next, unlocked };
}

/** Clears the badge once the player has been shown what they earned. */
export function markUnlocksSeen(storage) {
  const progress = readUnlockProgress(storage);
  if ((progress.unseen ?? []).length === 0) return { changed: false, progress };
  const next = { ...progress, unseen: [] };
  writeUnlockProgress(storage, next);
  return { changed: true, progress: next };
}

/**
 * Wipes all progress. Development only -- the dev panel uses it to re-test the
 * Konami reward, which is otherwise a one-time event per browser.
 */
export function resetUnlockProgress(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the record is already unreachable.
  }
  return readUnlockProgress(storage);
}
