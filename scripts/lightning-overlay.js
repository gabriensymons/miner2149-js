/**
 * The Diridium strike: a full-viewport lightning bolt with a matching flash
 * across the page behind it.
 *
 * Played when the Diridium unit is unlocked, and again whenever the player
 * chooses it, because the whole point of that frame is that it is not ordinary
 * hardware.
 *
 * Two things worth knowing about how it composites:
 *
 * 1. There is no alpha channel and no runtime chroma key. The clip is encoded
 *    with a true black background (`tools/build-lightning-overlay.js`) and drawn
 *    with `mix-blend-mode: screen`, under which black contributes nothing and
 *    the bolt adds light. That is both cheaper than keying 4K frames on a canvas
 *    and a better match for what lightning actually does to a scene.
 * 2. The element and its sources are built on the first strike, never at load.
 *    A player who has not found the code never requests the video at all, the
 *    same rule the concept art follows.
 *
 * Site chrome only: imported by `scripts/site-controls.js`, which has no path to
 * the game or to `scripts/dev/`.
 */

const OVERLAY_ID = 'diridium-lightning';
const SOURCES = [
  { src: '/assets/video/diridium-lightning.webm', type: 'video/webm' },
  { src: '/assets/video/diridium-lightning.mp4', type: 'video/mp4' },
];

// The clip is about 2.1s. The flash class is dropped a little after it so the
// page settles before the bolt has fully faded, rather than the other way
// round, which reads as the lights coming back on too early.
const STRIKE_MS = 2400;

function prefersReducedMotion(view) {
  return Boolean(view.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

function buildOverlay(documentRef) {
  const overlay = documentRef.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'lightning-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const video = documentRef.createElement('video');
  video.className = 'lightning-overlay__video';
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  // No `loop`: a strike is an event, not weather.
  video.preload = 'auto';
  for (const { src, type } of SOURCES) {
    const source = documentRef.createElement('source');
    source.src = src;
    source.type = type;
    video.append(source);
  }

  overlay.append(video);
  documentRef.body.append(overlay);
  return overlay;
}

/**
 * Fires one strike. Safe to call again while one is running -- the clip restarts
 * rather than stacking, so a player toggling the frame back and forth gets one
 * bolt at a time instead of an accumulating storm.
 *
 * Returns false when nothing was played, which is the case under reduced motion
 * and if the browser refuses playback.
 */
export function playLightningStrike({
  documentRef = globalThis.document,
  view = globalThis,
} = {}) {
  if (!documentRef?.body) return false;
  // Reduced motion gets the unlock without the weather. The toast still
  // announces it, so nothing is lost but the spectacle.
  if (prefersReducedMotion(view)) return false;

  const overlay = documentRef.getElementById(OVERLAY_ID) ?? buildOverlay(documentRef);
  const video = overlay.querySelector('.lightning-overlay__video');

  overlay.classList.add('is-striking');
  documentRef.documentElement.classList.add('is-storm-lit');

  try {
    video.currentTime = 0;
  } catch {
    // Not seekable yet; it will start from the beginning anyway.
  }
  // Muted playback is allowed without a gesture, but a rejected promise must not
  // take the unlock down with it -- the flash still runs either way.
  video.play?.().catch(() => {});

  clearTimeout(playLightningStrike.timer);
  playLightningStrike.timer = setTimeout(() => {
    overlay.classList.remove('is-striking');
    documentRef.documentElement.classList.remove('is-storm-lit');
    video.pause?.();
  }, STRIKE_MS);

  return true;
}
