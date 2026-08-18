const storageKeys = {
  scale: 'minerDisplayScale',
  skin: 'minerDeviceSkin',
  tone: 'minerScreenTone',
};

const validScales = new Set(['2', '2.5', '3', '3.5', '4', '4.5', '5']);
const validSkins = new Set([
  'none',
  'palm-iiic',
  'palm-iiie',
  'palm-v',
  'palm-viix',
  'palm-m100',
  'palm-m505',
]);
const validTones = new Set(['white', 'palmos', 'backlight']);

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

  const applySkin = (value) => {
    const skin = validSkins.has(value) ? value : 'none';
    frame.dataset.skin = skin;
    skinSelect.value = skin;
    localStorage.setItem(storageKeys.skin, skin);
  };

  const applyTone = (value) => {
    const tone = validTones.has(value) ? value : 'white';
    stage.dataset.screenTone = tone;
    toneSelect.value = tone;
    localStorage.setItem(storageKeys.tone, tone);
  };

  applyScale(readPreference(storageKeys.scale, validScales, '3'));
  applySkin(readPreference(storageKeys.skin, validSkins, 'none'));
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
}

initDisplayControls();
