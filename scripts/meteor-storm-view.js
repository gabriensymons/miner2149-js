const LOGICAL_SIZE = 160;
const MINIMUM_STEP_INTERVAL_MS = 1000 / 60;
// Source lines 237-250 hold the alert on screen while the platform slides in.
const SETUP_HOLD_MS = 1200;
const RECHARGE_BAR_WIDTH = 30;

// Source bitmaps from the loaded atlas, keyed by their role in Storm() (source lines 236-315).
const SPRITE_KEYS = Object.freeze({
  skylineLeft: 'SRCBMP-023_splash_frame_line_327.png',
  skylineMiddle: 'SRCBMP-024_splash_frame_line_328.png',
  skylineRight: 'SRCBMP-025_splash_frame_line_329.png',
  // Source line 255: bitmap(72,140,...), 15x15 -- the tank with its turret raised.
  // SRCBMP-018 is the commented-out meteor variant at line 260, never drawn by the
  // original, and confirmed absent from the shipped v3.2a binary's string pool.
  platformArmed: 'SRCBMP-017_storm_frame_line_255.png',
  meteor: 'SRCBMP-019_storm_frame_line_261.png',
  meteorDestroyed: 'SRCBMP-020_storm_frame_line_287.png',
  meteorImpact: 'SRCBMP-021_storm_frame_line_307.png',
  groundExplosion: 'SRCBMP-022_storm_frame_line_309.png',
});

// Source Splash() paints the colony skyline from three bitmaps before any
// disaster animation runs: bitmap(5,130), bitmap(50,130), bitmap(100,130).
const SKYLINE = Object.freeze([
  [SPRITE_KEYS.skylineLeft, 5, 130],
  [SPRITE_KEYS.skylineMiddle, 50, 130],
  [SPRITE_KEYS.skylineRight, 100, 130],
]);

// Source Storm() writes every scene caption to the same centred slot at text(80, 40).
// The original prints the surrounding quotation marks literally; the beta
// recordings confirm they appear on screen.
const CAPTIONS = Object.freeze({
  // SRCMSG-011 ("Preparing Laser Platform! ", source line 239) belongs to the
  // platform slide-in, which the pure model does not phase separately.
  deploying: '"Warning: Meteor Storm! "',  // SRCMSG-010, source line 236
  targeting: '"Target Incoming Meteors! "', // SRCMSG-012, source line 251
  lowPower: 'LOW POWER',
  drained: 'POWER DRAINED',
});

function drawFrame(PIXI) {
  const frame = new PIXI.Graphics();
  frame.beginFill(0xffffff).drawRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE).endFill();
  frame.lineStyle(1, 0x000000).drawRect(2, 2, 156, 156).drawRect(4, 4, 152, 152);
  return frame;
}

function addSprite(PIXI, scene, textures, key, visible = false) {
  const sprite = new PIXI.Sprite(textures[key]);
  sprite.visible = visible;
  scene.addChild(sprite);
  return sprite;
}

// Source line 300: rect(1,120,147,150-f,153,0). The bar runs x = 120 to 150 - f
// and y = 147 to 153, so a FULL bar means ready to fire. The v3.2 manual calls
// it "a meter at the bottom right of the screen [that] shows your recharging
// time"; the original never gauges power, it warns about it in the caption slot.
function drawRechargeBar(bar, cooldown) {
  const width = Math.max(0, Math.min(RECHARGE_BAR_WIDTH, RECHARGE_BAR_WIDTH - cooldown));
  bar.clear();
  if (width <= 0) return;
  bar.beginFill(0x000000).drawRect(0, 0, width, 6).endFill();
}

function drawLaser(laser, effects) {
  const effect = effects.findLast(({ type }) => type === 'laser');
  laser.clear();
  laser.visible = Boolean(effect);
  if (!effect) return;
  laser.lineStyle(2, 0x000000).moveTo(effect.from.x, effect.from.y).lineTo(effect.to.x, effect.to.y);
  laser.lineStyle(1, 0xffffff).moveTo(effect.from.x, effect.from.y).lineTo(effect.to.x, effect.to.y);
}

function addLabel(PIXI, scene, text, style, x, y) {
  const label = new PIXI.BitmapText(text, style);
  label.position.set(x, y);
  scene.addChild(label);
  return label;
}

// Source line 232 sets textalign(01); captions are centred on x = 80.
function centerLabel(label, y) {
  const width = label.width;
  label.position.set(Number.isFinite(width) ? Math.round(80 - width / 2) : label.x, y);
}

export function createMeteorStormView({
  PIXI,
  app,
  document: documentRef = globalThis.document,
  fonts = {},
  textures = {},
  model,
  underlyingParent,
  onComplete = () => {},
  minimumStepInterval = MINIMUM_STEP_INTERVAL_MS,
  setupHold = SETUP_HOLD_MS,
}) {
  let scene = null;
  let state = null;
  let statusText = null;
  let progressText = null;
  let warningText = null;
  let rechargeBar = null;
  let laserGraphic = null;
  let platformSprite = null;
  let meteorSprite = null;
  let destroyedSprite = null;
  let impactSprite = null;
  let explosionSprite = null;
  let destroyedFrames = 0;
  let missFrame = 0;
  let missAnchor = null;
  let hitTarget = null;
  let activePointerId = null;
  let previousInteractiveChildren;
  let accumulator = 0;
  let setupRemaining = 0;
  let tickerListener = null;
  let visibilityListener = null;
  const pointerListeners = new Map();

  function render(nextState) {
    if (!scene) return;
    state = nextState;
    statusText.text = `HIT ${state.destroyed}  MISS ${state.missed}`;
    progressText.text = `${Math.min(state.currentIndex + 1, state.total)}/${state.total}`;
    const warnings = state.warnings ?? [];
    warningText.text = captionFor(warnings);
    warningText.visible = warningText.text.length > 0;
    centerLabel(warningText, 36);
    drawRechargeBar(rechargeBar, state.cooldown);
    const effects = state.effects ?? [];
    drawLaser(laserGraphic, effects);
    platformSprite.visible = state.phase !== 'deploying';
    renderMeteorBitmaps(effects);
  }

  // Source lines 261-313: the in-flight meteor, its one-frame hit bitmap, and the
  // two-frame surface impact are all the same anchor point redrawn in place.
  function renderMeteorBitmaps(effects) {
    const meteor = state.meteor;
    meteorSprite.visible = meteor?.status === 'inbound';
    if (meteor) meteorSprite.position.set(meteor.x, meteor.y);

    if (effects.some(({ type }) => type === 'meteor-hit')) {
      destroyedFrames = 1;
      if (meteor) destroyedSprite.position.set(meteor.x, meteor.y);
    } else if (destroyedFrames > 0) {
      destroyedFrames -= 1;
    }
    destroyedSprite.visible = destroyedFrames > 0;

    if (effects.some(({ type }) => type === 'meteor-missed')) {
      missFrame = 1;
      missAnchor = meteor ? { x: meteor.x, y: meteor.y } : missAnchor;
    } else if (missFrame > 0) {
      missFrame = missFrame >= 2 ? 0 : missFrame + 1;
    }
    if (missAnchor) {
      impactSprite.position.set(missAnchor.x, missAnchor.y);
      explosionSprite.position.set(missAnchor.x - 2, missAnchor.y);
    }
    impactSprite.visible = missFrame === 1;
    explosionSprite.visible = missFrame === 2;
  }

  // Power warnings pre-empt the phase caption, matching the shared source text slot.
  function captionFor(warnings) {
    if (warnings.includes('power-drained')) return CAPTIONS.drained;
    if (warnings.includes('low-power')) return CAPTIONS.lowPower;
    if (state.phase === 'deploying') return CAPTIONS.deploying;
    if (state.phase === 'complete') return '';
    return CAPTIONS.targeting;
  }

  function localAim(event) {
    const point = scene.toLocal(event.data.global);
    return { x: point.x, y: point.y };
  }

  function stopEvent(event) {
    event.stopPropagation?.();
  }

  function bindPointerInput() {
    hitTarget = new PIXI.Container();
    hitTarget.interactive = true;
    hitTarget.hitArea = new PIXI.Rectangle(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

    const down = (event) => {
      stopEvent(event);
      const pointerId = event.data.pointerId ?? 0;
      if (activePointerId !== null) return;
      activePointerId = pointerId;
      const aim = localAim(event);
      state = model.setInput(state, { held: true, ...aim });
      state = model.fire(state, aim);
      render(state);
    };
    const move = (event) => {
      stopEvent(event);
      if ((event.data.pointerId ?? 0) !== activePointerId) return;
      const aim = localAim(event);
      state = model.setInput(state, { held: true, ...aim });
      render(state);
    };
    const release = (event) => {
      stopEvent(event);
      if ((event.data.pointerId ?? 0) !== activePointerId) return;
      activePointerId = null;
      state = model.clearInput(state);
      render(state);
    };

    for (const [name, listener] of [
      ['pointerdown', down],
      ['pointermove', move],
      ['pointerup', release],
      ['pointerupoutside', release],
      ['pointercancel', release],
    ]) {
      pointerListeners.set(name, listener);
      hitTarget.on(name, listener);
    }
    scene.addChild(hitTarget);
  }

  function finish() {
    const completedState = state;
    close();
    onComplete(completedState);
  }

  function startSimulation() {
    tickerListener = (deltaTime) => {
      if (!scene || documentRef?.hidden) return;
      const tickerMilliseconds = app.ticker.deltaMS;
      const elapsed = Number.isFinite(tickerMilliseconds)
        ? tickerMilliseconds
        : deltaTime * MINIMUM_STEP_INTERVAL_MS;
      if (setupRemaining > 0) {
        setupRemaining -= Math.max(0, elapsed);
        if (setupRemaining > 0) return;
        setupRemaining = 0;
        state = model.activate(state);
        render(state);
        return;
      }
      accumulator += Math.max(0, elapsed);
      const interval = Math.max(minimumStepInterval, state.stepDelay ?? 0);
      while (scene && accumulator >= interval) {
        accumulator -= interval;
        state = model.step(state);
        render(state);
        if (state.phase === 'complete') {
          finish();
          return;
        }
      }
    };
    app.ticker.add(tickerListener);

    visibilityListener = () => {
      accumulator = 0;
      if (!scene || !documentRef.hidden) return;
      activePointerId = null;
      state = model.clearInput(state);
      render(state);
    };
    documentRef?.addEventListener?.('visibilitychange', visibilityListener);
  }

  function close() {
    if (!scene) return;
    if (tickerListener) app.ticker.remove(tickerListener);
    if (visibilityListener) {
      documentRef?.removeEventListener?.('visibilitychange', visibilityListener);
    }
    tickerListener = null;
    visibilityListener = null;
    accumulator = 0;
    setupRemaining = 0;
    if (state) state = model.clearInput(state);
    activePointerId = null;
    for (const [name, listener] of pointerListeners) hitTarget.off(name, listener);
    pointerListeners.clear();
    if (scene.parent) scene.parent.removeChild(scene);
    scene.destroy({ children: true });
    scene = null;
    state = null;
    rechargeBar = null;
    progressText = null;
    platformSprite = null;
    meteorSprite = null;
    destroyedSprite = null;
    impactSprite = null;
    explosionSprite = null;
    hitTarget = null;
    if (underlyingParent) underlyingParent.interactiveChildren = previousInteractiveChildren;
  }

  function open(initialState) {
    if (scene) close();
    previousInteractiveChildren = underlyingParent?.interactiveChildren;
    if (underlyingParent) underlyingParent.interactiveChildren = false;

    scene = new PIXI.Container();
    scene.addChild(drawFrame(PIXI));
    for (const [key, x, y] of SKYLINE) {
      addSprite(PIXI, scene, textures, key, true).position.set(x, y);
    }
    // SRCMSG-003, source line 234: text(80, 15, "Disaster Alert:").
    centerLabel(addLabel(PIXI, scene, 'Disaster Alert:', fonts.title ?? fonts.status, 43, 8), 8);
    warningText = addLabel(PIXI, scene, '', fonts.status ?? fonts.title, 50, 36);
    // Port addition: the original shows no counters. They share the recharge bar
    // row, which has two clear bands -- x8..71 before the tank at x72..87, and
    // x88..118 between the tank and the bar at x120.
    statusText = addLabel(PIXI, scene, '', fonts.status ?? fonts.title, 8, 147);
    progressText = addLabel(PIXI, scene, '', fonts.status ?? fonts.title, 96, 147);
    rechargeBar = new PIXI.Graphics();
    rechargeBar.position.set(120, 147);
    scene.addChild(rechargeBar);
    // Armed laser platform anchor from source line 260: bitmap(72, 140, ...).
    platformSprite = addSprite(PIXI, scene, textures, SPRITE_KEYS.platformArmed);
    platformSprite.position.set(72, 140);
    laserGraphic = new PIXI.Graphics();
    scene.addChild(laserGraphic);
    meteorSprite = addSprite(PIXI, scene, textures, SPRITE_KEYS.meteor);
    destroyedSprite = addSprite(PIXI, scene, textures, SPRITE_KEYS.meteorDestroyed);
    impactSprite = addSprite(PIXI, scene, textures, SPRITE_KEYS.meteorImpact);
    explosionSprite = addSprite(PIXI, scene, textures, SPRITE_KEYS.groundExplosion);
    destroyedFrames = 0;
    missFrame = 0;
    missAnchor = null;
    bindPointerInput();
    app.stage.addChild(scene);

    // The alert beat only exists when the model still has a deploying phase to leave.
    setupRemaining = initialState.phase === 'deploying' ? setupHold : 0;
    state = setupRemaining > 0 ? initialState : model.activate(initialState);
    render(state);
    startSimulation();
    return state;
  }

  return { open, render, close };
}
