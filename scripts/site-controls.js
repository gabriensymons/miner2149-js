import {
  SKIN_CATALOGUE,
  SKIN_CSS_PROPERTY_NAMES,
  SKIN_UNLOCK_EVENT,
  skinById,
  skinCssVariables,
  skinIds,
} from './skin-catalogue.js';
import { createKonamiMatcher, pressKey, shouldIgnoreKeyEvent } from './konami.js';
import { grantUnlockForTrigger, readUnlockProgress } from './unlock-progress.js';

const storageKeys = {
  scale: 'minerDisplayScale',
  skin: 'minerDeviceSkin',
  tone: 'minerScreenTone',
};

const validScales = new Set(['2', '2.5', '3', '3.5', '4', '4.5', '5']);
const NO_SKIN = 'none';
// Every frame the catalogue knows about, plus the bare canvas. Which of these a
// given player may actually select is a separate question -- see unlockedSkins.
const validSkins = new Set([NO_SKIN, ...skinIds()]);
const validTones = new Set(['white', 'palmos', 'backlight']);

// Announced politely rather than interrupting: an unlock lands in the middle of
// play and must not steal focus from the canvas.
function showUnlockToast(skin) {
  let toast = document.querySelector('#skin-unlock-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'skin-unlock-toast';
    toast.className = 'skin-unlock-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
  }
  toast.textContent = `Frame unlocked: ${skin.label}`;
  toast.classList.add('is-visible');
  clearTimeout(showUnlockToast.timer);
  showUnlockToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 6000);
}

function lockedLabel(skin) {
  // Numbered rather than "???" so the locked frames are distinguishable from
  // one another. The name and the trigger are deliberately withheld.
  return `Locked \u2014 frame ${String(skin.slot).padStart(2, '0')}`;
}

/**
 * Rebuilds the frame picker. Locked frames stay in the list, disabled: hiding
 * them would make the collection invisible, and `disabled` is the accessible
 * way to say "present but not yours yet".
 */
function renderSkinOptions(skinSelect, unlockedSkins) {
  const none = document.createElement('option');
  none.value = NO_SKIN;
  none.textContent = 'None';

  skinSelect.replaceChildren(none, ...SKIN_CATALOGUE.map((skin) => {
    const option = document.createElement('option');
    const unlocked = unlockedSkins.has(skin.id);
    option.value = skin.id;
    option.textContent = unlocked ? skin.label : lockedLabel(skin);
    option.disabled = !unlocked;
    return option;
  }));
}

/**
 * Frame geometry lives on the element as custom properties rather than in six
 * hand-written CSS blocks that had to stay in step with this file, the option
 * list, and the build allowlist. `styles/style.css` still owns every rule that
 * reads them.
 */
function applySkinGeometry(frame, id) {
  for (const property of SKIN_CSS_PROPERTY_NAMES) frame.style.removeProperty(property);
  const skin = skinById(id);
  if (!skin) return;
  for (const [property, value] of Object.entries(skinCssVariables(skin))) {
    frame.style.setProperty(property, value);
  }
}

function readPreference(key, allowedValues, fallback) {
  const value = localStorage.getItem(key);
  return allowedValues.has(value) ? value : fallback;
}

function initDisplayControls() {
  const header = document.querySelector('.site-header');
  const drawer = document.querySelector('#display-controls-drawer');
  const drawerToggle = document.querySelector('#controls-toggle');
  const stage = document.querySelector('#game-stage');
  const frame = document.querySelector('#palm-frame');
  const sizeSlider = document.querySelector('#game-size');
  const sizeOutput = document.querySelector('#game-size-output');
  const skinSelect = document.querySelector('#device-skin');
  const toneSelect = document.querySelector('#screen-tone');

  const setDrawerOpen = (isOpen) => {
    drawer.classList.toggle('is-open', isOpen);
    drawer.setAttribute('aria-hidden', String(!isOpen));
    drawerToggle.setAttribute('aria-expanded', String(isOpen));
  };

  const applyScale = (value) => {
    const scale = validScales.has(value) ? value : '3';
    document.documentElement.style.setProperty('--game-scale', scale);
    sizeSlider.value = scale;
    sizeOutput.textContent = `${scale}×`;
    localStorage.setItem(storageKeys.scale, scale);
  };

  // The frames this player has earned. Rebuilt rather than mutated so the
  // picker, applySkin, and the unlock listener always agree.
  let unlockedSkins = new Set(readUnlockProgress(localStorage).unlocked);

  const refreshUnlocks = ({ announce } = {}) => {
    const previous = unlockedSkins;
    unlockedSkins = new Set(readUnlockProgress(localStorage).unlocked);
    renderSkinOptions(skinSelect, unlockedSkins);
    skinSelect.value = frame.dataset.skin;
    if (!announce) return;
    const gained = SKIN_CATALOGUE.find(({ id }) => unlockedSkins.has(id) && !previous.has(id));
    if (gained) showUnlockToast(gained);
  };

  const applySkin = (value) => {
    // A locked frame falls back to the bare canvas the same way an unknown one
    // does, which also migrates any frame id left in storage by an older build.
    const skin = validSkins.has(value) && (value === NO_SKIN || unlockedSkins.has(value))
      ? value
      : NO_SKIN;
    frame.dataset.skin = skin;
    skinSelect.value = skin;
    applySkinGeometry(frame, skin);
    localStorage.setItem(storageKeys.skin, skin);
  };

  const applyTone = (value) => {
    const tone = validTones.has(value) ? value : 'white';
    stage.dataset.screenTone = tone;
    toneSelect.value = tone;
    localStorage.setItem(storageKeys.tone, tone);
  };

  applyScale(readPreference(storageKeys.scale, validScales, '3'));
  renderSkinOptions(skinSelect, unlockedSkins);
  applySkin(readPreference(storageKeys.skin, validSkins, NO_SKIN));
  applyTone(readPreference(storageKeys.tone, validTones, 'white'));

  sizeSlider.addEventListener('input', (event) => applyScale(event.currentTarget.value));
  skinSelect.addEventListener('change', (event) => applySkin(event.currentTarget.value));
  toneSelect.addEventListener('change', (event) => applyTone(event.currentTarget.value));
  drawerToggle.addEventListener('click', () => {
    setDrawerOpen(drawerToggle.getAttribute('aria-expanded') !== 'true');
  });
  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) setDrawerOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || drawerToggle.getAttribute('aria-expanded') !== 'true') return;
    setDrawerOpen(false);
    drawerToggle.focus();
  });
  document.querySelectorAll('.site-nav a').forEach((link) => {
    link.addEventListener('click', () => setDrawerOpen(false));
  });

  // The game detects the in-play triggers and announces them here. It cannot
  // call into this module -- app.js and site-controls.js are separate entry
  // points on purpose -- so the catalogue's event name is the whole contract.
  document.addEventListener(SKIN_UNLOCK_EVENT, () => refreshUnlocks({ announce: true }));
  // An unlock earned in another tab should show up in this one.
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === 'miner2149.unlockProgress') refreshUnlocks();
  });

  // Player-facing Easter egg. Lives here rather than in app.js precisely because
  // this module has no path to scripts/dev/, which makes the recorded
  // separation between the two structural instead of a rule to remember.
  let konami = createKonamiMatcher();
  document.addEventListener('keydown', (event) => {
    if (shouldIgnoreKeyEvent(event)) return;
    const result = pressKey(konami, event.key);
    konami = result.state;
    if (!result.triggered) return;
    const { changed, skin } = grantUnlockForTrigger(localStorage, 'konami');
    refreshUnlocks();
    if (skin && changed) showUnlockToast(skin);
  });
}

initDisplayControls();
