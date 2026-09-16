import {
  SKIN_CATALOGUE,
  SKIN_CSS_PROPERTY_NAMES,
  SKIN_UNLOCK_EVENT,
  skinAboutLabel,
  skinById,
  skinCssVariables,
  skinIds,
} from './skin-catalogue.js';
import { createKonamiMatcher, pressKey, shouldIgnoreKeyEvent } from './konami.js';
import {
  grantUnlockForTrigger,
  markUnlocksSeen,
  readUnlockProgress,
  unseenRewardCount,
} from './unlock-progress.js';
import { playLightningStrike } from './lightning-overlay.js';

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
// The Diridium tone is a Konami reward and is only selectable once that frame
// is on file, so it is not in the base set.
const DIRIDIUM_TONE = 'diridium';
const DIRIDIUM_SKIN = 'diridium';
const BASE_TONES = ['white', 'palmos', 'backlight'];

/**
 * Concept art from the introduction, released with the Diridium unit.
 * Full-size JPEGs, so they are only inserted once earned -- a player who has
 * not found the code never downloads them.
 */
const CONCEPT_ART = Object.freeze([
  {
    file: 'diridium-asteroid-mine.jpg',
    ref: 'Plate 01',
    kind: 'Survey record',
    title: 'Working face, mid-stage colony',
    lead: 'A diridium cut worked in terraces, because at this gravity a vertical '
      + 'wall does not stay one.',
    body: [
      'Black-violet ore at the face; behind it the drilling gantries, the processing '
      + 'string, the habitat rings, the haulers, and a cargo shuttle on the pad. Two '
      + 'years of frontier operation for a crew that cannot be resupplied on request.',
      'Early expeditions built flat and built on the surface, and the meteor storms of '
      + 'the first decade took the lot. Anything that cannot be rebuilt inside a week '
      + 'now sits on a deeper layer.',
    ],
  },
  {
    file: 'dark-matter-drive.jpg',
    ref: 'Plate 02',
    kind: 'Drive schematic',
    title: 'Dark matter drive, cutaway',
    lead: 'A diridium core suspended inside intersecting field rings, bending '
      + 'spacetime rather than pushing against it.',
    body: [
      'The rings are the ship. The hull is assembled around them, and the crew berth '
      + 'outside the containment radius, because there is no inside to berth in.',
      'The core runs to the size of a habitat module and the field is never interrupted '
      + 'under way. No drive that lost containment at speed has left anything to '
      + 'examine, which is why none has ever been serviced under load.',
    ],
  },
]);

/** What a plate is called outside its own card: in alt text, and in the viewer. */
function plateLabel(plate) {
  return `${plate.ref} \u2014 ${plate.title}`;
}

/**
 * Splits text into runs that can each be lit separately.
 *
 * The stagger is written as an inline `--flash-index` rather than as nth-child
 * rules, because neither the number of runs nor their order is known here: a
 * name breaks where its catalogue entry says, and a detail breaks into however
 * many words it has. `styles/style.css` owns what the index means.
 */
function appendFlashRuns(runs, { separator = '' } = {}) {
  return runs.flatMap((text, index) => {
    const span = document.createElement('span');
    span.className = 'skin-unlock-toast__flash';
    span.style.setProperty('--flash-index', String(index));
    span.textContent = text;
    // A real space between the runs, so the sentence still wraps and still
    // reads as words to a screen reader rather than as one long token.
    return index === 0 || !separator
      ? [span]
      : [document.createTextNode(separator), span];
  });
}

/**
 * Announces an unlock at the top of the page, under the navigation.
 *
 * It used to sit bottom-right, where it was reliably missed: the player is
 * looking at the canvas, and the canvas is centred. Top centre puts it in the
 * same column as the thing they are already watching, and it still takes no
 * focus and blocks no pointer -- an unlock lands mid-play and must not interrupt
 * it.
 */
function showUnlockToast(skin, { charged = false, detail = '' } = {}) {
  let toast = document.querySelector('#skin-unlock-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'skin-unlock-toast';
    toast.className = 'skin-unlock-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
  }

  const label = document.createElement('span');
  label.className = 'skin-unlock-toast__label';
  label.textContent = charged ? 'Unlocked' : 'Frame unlocked';
  const name = document.createElement('strong');
  name.className = 'skin-unlock-toast__name';
  // The name strikes in pieces on a charged notice, each on its own beat, so it
  // reads as the word being lit rather than a label fading in. Frames without
  // their own break points strike whole.
  name.append(...appendFlashRuns(skin.nameSegments ?? [skin.label]));
  toast.replaceChildren(label, name);
  if (detail) {
    const note = document.createElement('span');
    note.className = 'skin-unlock-toast__detail';
    // Word by word, at half the name's beat: the detail is a sentence, and a
    // sentence flickering in lockstep with a three-syllable word is noise.
    note.append(...appendFlashRuns(detail.split(' '), { separator: ' ' }));
    toast.append(note);
  }

  // Measured rather than guessed: the header is sticky, and its height changes
  // with the viewport -- the nav wraps to two rows on a phone. A hard-coded top
  // was right until the nav grew a link, which is exactly the kind of thing
  // nobody re-checks.
  const header = document.querySelector('.site-header');
  if (header) {
    const clearance = Math.round(header.getBoundingClientRect().height) + 14;
    toast.style.setProperty('--toast-top', `${clearance}px`);
  }

  // The Konami unit announces itself differently to the ones you earn by playing.
  toast.classList.toggle('is-charged', charged);
  toast.classList.add('is-visible');
  clearTimeout(showUnlockToast.timer);
  showUnlockToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 8000);
}

// The DSEF-102 casing is stencilled in Japanese. Wrapping that run in lang="ja"
// makes a screen reader switch voice instead of spelling it out in English.
const JAPANESE_RUN = /([\u3000-\u30ff\u4e00-\u9faf]+)/g;

function appendLore(target, lore) {
  for (const [index, part] of lore.split(JAPANESE_RUN).entries()) {
    if (!part) continue;
    if (index % 2 === 1) {
      const run = document.createElement('span');
      run.lang = 'ja';
      run.textContent = part;
      target.append(run);
    } else {
      target.append(document.createTextNode(part));
    }
  }
}

/**
 * The hardware list. Locked entries carry no name, no lore, and no image --
 * the frame number is the only thing that distinguishes them, so the collection
 * is visibly incomplete without giving away what is missing or how to get it.
 */
function renderFieldKit(unlockedSkins) {
  const list = document.querySelector('#field-kit-list');
  const progress = document.querySelector('#field-kit-progress');
  if (!list || !progress) return;

  const earned = SKIN_CATALOGUE.filter(({ id }) => unlockedSkins.has(id));
  progress.textContent = `${earned.length} of ${SKIN_CATALOGUE.length} units on file.`;

  list.replaceChildren(...SKIN_CATALOGUE.map((skin) => {
    const item = document.createElement('li');
    const unlocked = unlockedSkins.has(skin.id);
    item.className = `field-kit__item${unlocked ? '' : ' is-locked'}`;

    const heading = document.createElement('h3');
    heading.textContent = unlocked ? skin.label : lockedLabel(skin);
    if (!unlocked) {
      // No <img>: the thumbnails are ~60 KB each and there is nothing to show.
      const placeholder = document.createElement('div');
      placeholder.className = 'field-kit__placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      item.append(placeholder, heading);
      return item;
    }

    const image = document.createElement('img');
    image.className = 'field-kit__image';
    image.src = `/assets/skins/thumbs/${skin.file}`;
    image.alt = `${skin.label} handheld unit`;
    image.loading = 'lazy';
    image.decoding = 'async';
    // Intrinsic size keeps the list from reflowing as thumbnails arrive.
    image.width = Math.round((skin.imageWidth / skin.imageHeight) * 240);
    image.height = 240;

    const lore = document.createElement('p');
    appendLore(lore, skin.lore);
    item.append(image, heading, lore);
    return item;
  }));
}

/**
 * The selected frame's entry, as a popup off the console line.
 *
 * It lived in the controls drawer for a while and should not again: a fourth
 * column made the three pickers tall and narrow and left the drawer deep enough
 * to sit over the device it describes. The lore is a footnote about the
 * hardware, so it hangs off the hardware's name instead.
 *
 * A native <dialog>, like the image viewer, so Escape, the backdrop and focus
 * handling come from the platform rather than being reimplemented.
 */
function openLoreDialog(skin) {
  let dialog = document.querySelector('#device-lore-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'device-lore-dialog';
    dialog.className = 'lore-dialog';
    dialog.innerHTML = `
      <form method="dialog">
        <button class="lore-dialog__close" value="close" aria-label="Close">&times;</button>
      </form>
      <p class="lore-dialog__eyebrow">Field note</p>
      <h2 class="lore-dialog__title"></h2>
      <p class="lore-dialog__body"></p>`;
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.body.append(dialog);
  }
  dialog.querySelector('.lore-dialog__title').textContent = skin.label;
  const body = dialog.querySelector('.lore-dialog__body');
  body.replaceChildren();
  appendLore(body, skin.lore);
  dialog.showModal();
}

/**
 * Full-size view of one archive image. A native <dialog> so Escape, focus
 * trapping, and the backdrop come from the platform rather than being
 * reimplemented.
 */
function openImageViewer(plate) {
  let dialog = document.querySelector('#image-viewer');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'image-viewer';
    dialog.className = 'image-viewer';
    dialog.innerHTML = `
      <form method="dialog">
        <button class="image-viewer__close" value="close" aria-label="Close">&times;</button>
      </form>
      <img class="image-viewer__image" alt="">
      <div class="image-viewer__record">
        <p class="image-viewer__ref"></p>
        <h3 class="image-viewer__title"></h3>
        <div class="image-viewer__caption"></div>
      </div>`;
    // Clicking the backdrop closes it; clicks on the image itself do not.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.body.append(dialog);
  }
  const image = dialog.querySelector('.image-viewer__image');
  image.src = `/assets/concepts/${plate.file}`;
  image.alt = plateLabel(plate);
  dialog.querySelector('.image-viewer__ref').textContent = `${plate.ref} \u00b7 ${plate.kind}`;
  dialog.querySelector('.image-viewer__title').textContent = plate.title;
  dialog.querySelector('.image-viewer__caption').replaceChildren(
    ...renderPlateProse(plate),
  );
  dialog.showModal();
}

/**
 * A plate's text: one lead sentence, then the record.
 *
 * Built once and used in both the card and the full-size viewer, so the two
 * cannot drift, and split into real paragraphs rather than one block -- the
 * single long paragraph these replaced was accurate and nobody read it.
 */
function renderPlateProse(plate) {
  const lead = document.createElement('p');
  lead.className = 'plate__lead';
  lead.textContent = plate.lead;
  return [lead, ...plate.body.map((text) => {
    const paragraph = document.createElement('p');
    paragraph.className = 'plate__body';
    paragraph.textContent = text;
    return paragraph;
  })];
}

function renderConceptArt(unlockedSkins) {
  const section = document.querySelector('#field-kit .manual-section__content');
  const existing = document.querySelector('#field-kit-concepts');
  if (!section) return;
  if (!unlockedSkins.has(DIRIDIUM_SKIN)) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'field-kit-concepts';
  const heading = document.createElement('h3');
  heading.className = 'field-kit__concepts-title';
  heading.textContent = 'Archive image library';
  // The heading sits outside the grid; inside it, it takes a cell of its own
  // and pushes the figures out of alignment.
  const grid = document.createElement('div');
  grid.className = 'field-kit__concepts';
  grid.append(...CONCEPT_ART.map((plate) => {
    const figure = document.createElement('figure');
    figure.className = 'plate';
    const image = document.createElement('img');
    image.src = `/assets/concepts/${plate.file}`;
    // The plate's label is the alt text; the record below it is the record, and
    // a screen reader should not have to sit through the record twice.
    image.alt = plateLabel(plate);
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = 1536;
    image.height = 1024;
    // A button rather than a bare click handler: the enlarge action has to be
    // reachable by keyboard and announced as interactive.
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'field-kit__expand';
    trigger.setAttribute('aria-label', `Enlarge: ${plateLabel(plate)}`);
    trigger.append(image);
    trigger.addEventListener('click', () => openImageViewer(plate));

    const figcaption = document.createElement('figcaption');
    figcaption.className = 'plate__record';
    const ref = document.createElement('p');
    ref.className = 'plate__ref';
    ref.textContent = `${plate.ref} \u00b7 ${plate.kind}`;
    const heading = document.createElement('h4');
    heading.className = 'plate__title';
    heading.textContent = plate.title;
    figcaption.append(ref, heading, ...renderPlateProse(plate));
    figure.append(trigger, figcaption);
    return figure;
  }));
  wrapper.append(heading, grid);
  section.append(wrapper);
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
  const skinControl = document.querySelector('.display-control--skin');
  const toneControl = document.querySelector('.display-control--tone');
  const loreSlot = document.querySelector('#device-lore-slot');
  const loreButton = document.querySelector('#device-lore-button');

  const setDrawerOpen = (isOpen) => {
    drawer.classList.toggle('is-open', isOpen);
    drawer.setAttribute('aria-hidden', String(!isOpen));
    drawerToggle.setAttribute('aria-expanded', String(isOpen));
    // The drawer opens into the same strip of the page the toast occupies. A
    // player opening it has already read the notice -- that is why they are
    // opening it -- so the notice gets out of the way rather than sitting on
    // top of the controls it was pointing at.
    if (isOpen) document.querySelector('#skin-unlock-toast')?.classList.remove('is-visible');
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

  // A frame the player has not looked at yet marks the control that reveals it.
  // Without this an unlock earned mid-game is announced once and then invisible.
  const refreshBadge = () => {
    // Rewards, not frames: the Diridium unit brings a screen colour with it, so
    // that unlock is a badge of two and the drawer has two new things in it.
    const pending = unseenRewardCount(readUnlockProgress(localStorage));
    drawerToggle.classList.toggle('has-unseen', pending > 0);
    drawerToggle.dataset.unseen = pending > 0 ? String(pending) : '';
    drawerToggle.setAttribute(
      'aria-description',
      pending > 0 ? `${pending} new display option${pending === 1 ? '' : 's'} available` : '',
    );
  };

  /**
   * Rings the controls a new unlock actually lives in.
   *
   * The badge says something is new; it does not say where. The Konami reward is
   * two separate <select>s inside a drawer the player may never have opened, so
   * without this the announcement is followed by a hunt. Each ring comes off
   * individually -- see `clearHighlightOn` below for when, and why not simply on
   * the drawer opening.
   */
  const highlightControls = (controls) => {
    for (const control of controls) control?.classList.add('is-newly-unlocked');
  };

  // Each ring comes off when its own control is used, not when the drawer opens.
  // Opening the drawer is what the badge was asking for; the ring is asking for
  // something more specific, and it has not been answered until the player has
  // actually gone into that select.
  const clearHighlightOn = (control, select) => {
    if (!control || !select) return;
    const clear = () => control.classList.remove('is-newly-unlocked');
    // pointerdown fires as the list opens, focus covers reaching it by keyboard,
    // and change covers a selection made without either being observed.
    for (const type of ['pointerdown', 'focus', 'change']) {
      select.addEventListener(type, clear);
    }
  };

  /**
   * Points the console line's footnote at whichever frame is mounted.
   *
   * The Field Kit carries the same lore, but that is a section further down the
   * page; this is the copy that reaches a player who has just chosen a frame and
   * is looking at it. Both render from the same catalogue entry, so they cannot
   * disagree. The whole segment goes away with the bare canvas -- there is no
   * hardware to have a note about.
   */
  let loreSkin = null;
  const renderSkinLore = (id) => {
    if (!loreSlot || !loreButton) return;
    loreSkin = skinById(id);
    loreSlot.hidden = !loreSkin;
    loreButton.textContent = loreSkin ? skinAboutLabel(loreSkin) : '';
  };
  loreButton?.addEventListener('click', () => {
    if (loreSkin) openLoreDialog(loreSkin);
  });

  const refreshUnlocks = ({ announce } = {}) => {
    const previous = unlockedSkins;
    unlockedSkins = new Set(readUnlockProgress(localStorage).unlocked);
    renderSkinOptions(skinSelect, unlockedSkins);
    renderFieldKit(unlockedSkins);
    renderConceptArt(unlockedSkins);
    renderScreenTones(toneSelect, unlockedSkins);
    refreshBadge();
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
    renderSkinLore(skin === NO_SKIN ? null : skin);
    localStorage.setItem(storageKeys.skin, skin);
  };

  // Rebuilt with the unlock set, so the Diridium tone appears when earned.
  let validTones = new Set(BASE_TONES);
  const renderScreenTones = (select, unlockedSkins) => {
    validTones = new Set(unlockedSkins.has(DIRIDIUM_SKIN)
      ? [...BASE_TONES, DIRIDIUM_TONE]
      : BASE_TONES);
    const option = select.querySelector(`option[value="${DIRIDIUM_TONE}"]`);
    if (validTones.has(DIRIDIUM_TONE) && !option) {
      const added = document.createElement('option');
      added.value = DIRIDIUM_TONE;
      added.textContent = 'Dark matter';
      select.append(added);
    } else if (!validTones.has(DIRIDIUM_TONE) && option) {
      option.remove();
    }
  };

  const applyTone = (value) => {
    const tone = validTones.has(value) ? value : 'white';
    stage.dataset.screenTone = tone;
    toneSelect.value = tone;
    localStorage.setItem(storageKeys.tone, tone);
  };

  applyScale(readPreference(storageKeys.scale, validScales, '3'));
  renderSkinOptions(skinSelect, unlockedSkins);
  renderFieldKit(unlockedSkins);
  renderConceptArt(unlockedSkins);
  renderScreenTones(toneSelect, unlockedSkins);
  refreshBadge();
  applySkin(readPreference(storageKeys.skin, validSkins, NO_SKIN));
  applyTone(readPreference(storageKeys.tone, validTones, 'white'));

  sizeSlider.addEventListener('input', (event) => applyScale(event.currentTarget.value));
  skinSelect.addEventListener('change', (event) => {
    const chosen = event.currentTarget.value;
    applySkin(chosen);
    // Only from the picker, never from applySkin: that also runs at load from
    // stored preferences, and a bolt on every page refresh is weather, not an
    // event.
    if (chosen === DIRIDIUM_SKIN) playLightningStrike();
  });
  toneSelect.addEventListener('change', (event) => applyTone(event.currentTarget.value));
  clearHighlightOn(skinControl, skinSelect);
  clearHighlightOn(toneControl, toneSelect);
  drawerToggle.addEventListener('click', () => {
    const opening = drawerToggle.getAttribute('aria-expanded') !== 'true';
    setDrawerOpen(opening);
    // Opening the drawer is the player seeing what they earned.
    if (!opening) return;
    if (markUnlocksSeen(localStorage).changed) refreshBadge();
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
    if (!skin || !changed) return;
    // Applied rather than merely offered. This is a one-time find and the
    // reveal is the reward -- a notice saying a frame exists somewhere in a
    // closed drawer is not one. Both controls stay right there, highlighted, so
    // going back is one click.
    applySkin(skin.id);
    applyTone(DIRIDIUM_TONE);
    highlightControls([skinControl, toneControl]);
    playLightningStrike();
    showUnlockToast(skin, {
      charged: true,
      detail: 'Device frame and dark matter screen applied \u2014 both are under Controls.',
    });
  });
}

initDisplayControls();
