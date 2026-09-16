const LOGICAL_SIZE = 160;
const MINIMUM_STEP_INTERVAL_MS = 1000 / 60;
// Source lines 237-250 hold the alert on screen while the platform slides in.
// Source lines 237-246: the platform walks from x=10 to x=71 one pixel per
// sleep(100), then settles two pixels higher once the loop leaves d at 72.
const SLIDE_START_X = 10;
const SLIDE_END_X = 71;
const SLIDE_STEP_MS = 100;
const SLIDE_CAPTION_X = 37;   // d == 37 flips the caption to SRCMSG-011
// Port adjustment: the browser frame is tighter than the Palm screen, so the
// ground band is lifted two pixels. The recharge bar deliberately stays at its
// source row -- lifting it would clip the source-exact rect.
const SCENE_LIFT = 2;
const SLIDE_Y = 147 - SCENE_LIFT;
const SETTLE_X = 72;
// Playtest fix, 2026-08-20: the settle frame and the armed tank keep the source
// rows without the scene lift, so all three tank bitmaps share a bottom edge at
// y=155. The tank no longer jumps up two pixels at the moment it stops moving.
const SETTLE_Y = 145;
const PLATFORM_ARMED_Y = 140;
const RECHARGE_BAR_WIDTH = 30;
// The model raises 'low-power' for only the dozen or so steps it takes power to
// climb back past 15, which at the step rate is a caption that blinks and is
// gone. Once raised it is latched until the recharge bar is back to this much of
// full, so the warning lasts as long as the condition it is warning about costs
// the player anything.
const LOW_POWER_CLEAR_FRACTION = 0.8;
// The caption sits five pixels below the dotted rule under "Disaster Alert:",
// which frees the middle of the screen for meteors falling in from the top.
const TITLE_Y = 8;
const TITLE_UNDERLINE_OFFSET = 11;
const WARNING_CAPTION_Y = TITLE_Y + TITLE_UNDERLINE_OFFSET + 5;
// The counters appear only once the tank has settled, then the player gets a
// beat to read them before the first meteor is spawned.
const ARMED_PAUSE_MS = 2000;
// The model emits a laser effect for a single simulation step, which at the
// source step delay is roughly one frame -- far too brief to see. The view
// holds the beam on screen instead of tying it to the effect's lifetime.
const LASER_HOLD_MS = 300;
// Half the 3px gap between the beam triangle's two base points at the aim site.
const LASER_BASE_HALF_WIDTH = 1.5;
// Fallback direction for a zero-length beam, which has no axis to be square to.
const LASER_FALLBACK_AXIS = Object.freeze({ x: 0, y: 1 });
// A last beat on the finished field so the accumulated craters are readable
// before the scene hands back to the message queue.
const COMPLETION_HOLD_MS = 1200;
// The repaired platform is worth a beat of its own. Without it the caption
// snaps straight back to the targeting line and the player never learns why
// they can shoot again.
const RESTORED_HOLD_MS = 1200;
// Meteors now start their fall above the frame, so everything that moves in the
// play field is clipped to the inside of the double border. A meteor is hidden
// until it clears the frame rather than drawn across it.
const PLAY_FIELD = Object.freeze({ x: 5, y: 5, width: 150, height: 150 });

// --- Wreckage, 2026-09-15 ---------------------------------------------------
// A kill used to draw the burst bitmap for exactly one step: the meteor was
// there, and then it was not, which read as a deletion rather than as a hit.
// The burst now keeps falling under the meteor's own momentum for a moment, so
// the player watches wreckage drop away instead of a sprite disappearing.
//
// Presentation only. The model resolves the slot the instant the shot lands and
// has already moved on; these constants cannot reach an outcome.
const DEBRIS_STEPS = 9;
// Past this age the wreckage blinks on alternate steps. The screen is 1-bit, so
// fading it out is not available -- flickering out is how that display loses
// something, and alpha would read as a foreign medium beside the bitmaps.
const DEBRIS_FLICKER_AFTER = 5;
// The burst is lighter than the rock, so it keeps most of the fall and not all
// of it. At the fastest meteor this is about eight pixels over its whole life:
// enough to see, not enough to look like a second falling object.
const DEBRIS_FALL_SCALE = 0.6;
// Wreckage stops at the skyline the view draws at y=130. Deliberately the
// view's own number rather than the model's ground line: nothing here is
// allowed to depend on the rules module, which is what keeps this file
// harness-testable with an injected model.
const DEBRIS_FLOOR_Y = 130;

// Source bitmaps from the loaded atlas, keyed by their role in Storm() (source lines 236-315).
const SPRITE_KEYS = Object.freeze({
  skylineLeft: 'SRCBMP-023_splash_frame_line_327.png',
  skylineMiddle: 'SRCBMP-024_splash_frame_line_328.png',
  skylineRight: 'SRCBMP-025_splash_frame_line_329.png',
  // Source lines 240 and 245: the same bitmap drawn at (d,147) through the
  // slide, then once at (72,145) when the loop leaves d at 72.
  platformSlide: 'SRCBMP-016_storm_frame_line_240.png',
  // Source line 255: bitmap(72,140,...), 15x15 -- the tank with its turret raised.
  // SRCBMP-018 is the commented-out meteor variant at line 260, never drawn by the
  // original, and confirmed absent from the shipped v3.2a binary's string pool.
  platformArmed: 'SRCBMP-017_storm_frame_line_255.png',
  // v3.2 redrew the in-flight meteor as a solid dark blob, replacing v3.0's
  // hollow outline (string pool index 306; SRCBMP-019 is absent from the
  // shipped binary). Confirmed against the v3.2a playtest recordings.
  meteor: 'V32BMP-070_storm_meteor_pool_306.png',
  meteorDestroyed: 'SRCBMP-020_storm_frame_line_287.png',
  meteorImpact: 'SRCBMP-021_storm_frame_line_307.png',
  groundExplosion: 'SRCBMP-022_storm_frame_line_309.png',
});

// Source Splash() paints the colony skyline from three bitmaps before any
// disaster animation runs: bitmap(5,130), bitmap(50,130), bitmap(100,130).
const SKYLINE = Object.freeze([
  [SPRITE_KEYS.skylineLeft, 5, 130 - SCENE_LIFT],
  [SPRITE_KEYS.skylineMiddle, 50, 130 - SCENE_LIFT],
  [SPRITE_KEYS.skylineRight, 100, 130 - SCENE_LIFT],
]);

// Source Storm() writes every scene caption to the same centred slot at text(80, 40).
// The original prints the surrounding quotation marks literally; the beta
// recordings confirm they appear on screen.
const CAPTIONS = Object.freeze({
  deploying: '"Warning: Meteor Storm! "',    // SRCMSG-010, source line 236
  preparing: '"Preparing Laser Platform! "', // SRCMSG-011, source line 239
  targeting: '"Target Incoming Meteors! "',  // SRCMSG-012, source line 251
  lowPower: 'LOW POWER',
  drained: 'POWER DRAINED',
  // Port addition. Cased to match the two warnings above, which share this slot.
  repairing: 'REPAIRING TANK',
  // Port addition, styled after the source's own SRCMSG-011 platform caption
  // that it answers: the platform announced itself arriving, so it announces
  // itself coming back.
  restored: '"Laser Platform Restored! "',
});

// The wrecked platform bitmap sits over the tank's own footprint.
const TANK_WRECK_Y = 143;

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
  // A fractional recharge step leaves a fractional cooldown; the bar is drawn in
  // whole pixels like the source rect it reproduces.
  const width = Math.round(
    Math.max(0, Math.min(RECHARGE_BAR_WIDTH, RECHARGE_BAR_WIDTH - cooldown)),
  );
  bar.clear();
  if (width <= 0) return;
  bar.beginFill(0x000000).drawRect(0, 0, width, 6).endFill();
}

// The beam is a solid wedge: one point at the turret, and a 3px base centred on
// where the player tapped. The base is square to the beam, not to the screen --
// the median from the turret to the midpoint of the base runs down the beam axis
// and meets the base at a right angle, so the wedge stays symmetric at every
// firing angle. Offsetting the base horizontally instead sheared the far end
// off, which showed badly on shallow shots.
export function laserWedge({ from, to }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const axis = length === 0
    ? LASER_FALLBACK_AXIS
    : { x: dx / length, y: dy / length };
  // Rotate the unit axis a quarter turn to get the base direction.
  const offsetX = -axis.y * LASER_BASE_HALF_WIDTH;
  const offsetY = axis.x * LASER_BASE_HALF_WIDTH;
  return [
    { x: from.x, y: from.y },
    { x: to.x - offsetX, y: to.y - offsetY },
    { x: to.x + offsetX, y: to.y + offsetY },
  ];
}

// Palm drew on a 160x160 grid of whole pixels. Left as a vector shape the wedge
// is rasterized by the renderer at the canvas resolution, so its diagonals come
// out three times finer than any bitmap beside them and read as a sharper,
// foreign medium. Scan-converting it onto the logical grid ourselves gives it
// the same stairstep the sprites have.
//
// One span per pixel row, so a full-height beam costs about 140 rects.
export function rasterizeTriangle(points) {
  const top = Math.floor(Math.min(...points.map(({ y }) => y)));
  const bottom = Math.ceil(Math.max(...points.map(({ y }) => y)));
  const spans = [];
  for (let y = top; y < bottom; y += 1) {
    const scan = y + 0.5;
    const crossings = [];
    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      // Half-open test, so a vertex exactly on the scanline is counted once.
      if ((start.y <= scan && end.y > scan) || (end.y <= scan && start.y > scan)) {
        crossings.push(start.x + ((scan - start.y) / (end.y - start.y)) * (end.x - start.x));
      }
    }
    if (crossings.length < 2) continue;
    const left = Math.floor(Math.min(...crossings));
    const right = Math.ceil(Math.max(...crossings));
    // Never thinner than a pixel: the rows near the apex are sub-pixel wide and
    // the beam would otherwise fade out before it reached the turret.
    spans.push([left, y, Math.max(1, right - left)]);
  }
  return spans;
}

function drawLaser(laser, beam) {
  laser.clear();
  laser.visible = Boolean(beam);
  if (!beam) return;
  laser.beginFill(0x000000);
  for (const [x, y, width] of rasterizeTriangle(laserWedge(beam))) {
    laser.drawRect(x, y, width, 1);
  }
  laser.endFill();
}

function addPlayFieldMask(PIXI, scene) {
  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff)
    .drawRect(PLAY_FIELD.x, PLAY_FIELD.y, PLAY_FIELD.width, PLAY_FIELD.height)
    .endFill();
  scene.addChild(mask);
  return mask;
}

function addLabel(PIXI, scene, text, style, x, y) {
  const label = new PIXI.BitmapText(text, style);
  label.position.set(x, y);
  scene.addChild(label);
  return label;
}

// Source line 234 sets textattr(2,1,1), which underlines the title. Palm draws
// the rule as alternating pixels, so step two per dot.
function drawTitleUnderline(PIXI, scene, title) {
  const rule = new PIXI.Graphics();
  const width = Number.isFinite(title.width) ? Math.round(title.width) : 0;
  rule.position.set(title.x, title.y + TITLE_UNDERLINE_OFFSET);
  rule.beginFill(0x000000);
  for (let x = 0; x < width; x += 2) rule.drawRect(x, 0, 1, 1);
  rule.endFill();
  scene.addChild(rule);
  return rule;
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
  slideStepInterval = SLIDE_STEP_MS,
  armedPauseInterval = ARMED_PAUSE_MS,
  completionHoldInterval = COMPLETION_HOLD_MS,
  laserHoldInterval = LASER_HOLD_MS,
  restoredHoldInterval = RESTORED_HOLD_MS,
}) {
  let scene = null;
  let state = null;
  let statusText = null;
  let progressText = null;
  let warningText = null;
  let rechargeBar = null;
  let laserGraphic = null;
  let platformSprite = null;
  let slidePlatformSprite = null;
  let meteorSprites = [];
  let impactSprites = [];
  let debrisSprites = [];
  let tankWreckSprite = null;
  let meteorLayer = null;
  let craterLayer = null;
  let debris = [];
  let missFrame = 0;
  let pendingCraters = [];
  let hitTarget = null;
  let activePointerId = null;
  let previousInteractiveChildren;
  let accumulator = 0;
  let slideElapsed = null;      // ms into the slide-in, or null when not deploying
  let armedPause = 0;           // ms left of the read-the-counters beat
  let completionHold = 0;       // ms left of the final beat before handing back
  let laserBeam = null;         // the wedge currently held on screen
  let laserHold = 0;            // ms left of that hold
  let lastLaserEffect = null;   // the effect object the current hold came from
  let restoredHold = 0;         // ms left of the "platform restored" caption
  let lastRepairEffect = null;  // matched by identity, as the laser effect is
  let lowPowerHeld = false;     // LOW POWER caption latched until the bar refills
  let tickerListener = null;
  let visibilityListener = null;
  const pointerListeners = new Map();

  function render(nextState) {
    if (!scene) return;
    state = nextState;
    // Effects are consumed before anything is drawn: they arm the view's own
    // holds, and the caption below reads from those.
    const effects = state.effects ?? [];
    holdLaser(effects);
    holdRestored(effects);

    statusText.text = `HIT ${state.destroyed}  MISS ${state.missed}`;
    progressText.text = `${Math.min(state.currentIndex + 1, state.total)}/${state.total}`;
    const warnings = state.warnings ?? [];
    warningText.text = captionFor(warnings);
    warningText.visible = warningText.text.length > 0;
    centerLabel(warningText, WARNING_CAPTION_Y);
    drawRechargeBar(rechargeBar, state.cooldown);
    const deploying = state.phase === 'deploying';
    // Nothing to score yet while the platform is still driving into position;
    // the counters arrive with the armed tank so they read as a briefing.
    statusText.visible = !deploying;
    progressText.visible = !deploying;
    platformSprite.visible = !deploying && !state.laserDisabled;
    slidePlatformSprite.visible = deploying;
    drawLaser(laserGraphic, laserBeam);
    renderMeteorBitmaps(effects);
  }

  // A fresh laser effect restarts the hold; an effect-free state leaves the
  // existing wedge alone until the ticker has run the hold down. The armed pause
  // and the completion hold re-render the same state every frame, so the effect
  // is matched by identity: re-seeing one already handled must not keep
  // restarting the hold, or the beam would never clear.
  function holdLaser(effects) {
    const effect = effects.findLast(({ type }) => type === 'laser');
    if (effect && effect !== lastLaserEffect) {
      lastLaserEffect = effect;
      laserBeam = { from: { ...effect.from }, to: { ...effect.to } };
      laserHold = laserHoldInterval;
      return;
    }
    if (laserHold <= 0) laserBeam = null;
  }

  // Source lines 261-313 redrew one meteor, its one-frame hit bitmap, and the
  // two-frame surface impact at the same anchor. The port now has to cope with
  // two live meteors at once (a split) and with two of them landing on the same
  // step, so the sprites are pooled and the impact frames are driven by the
  // effect list, which carries its own coordinates.
  function renderMeteorBitmaps(effects) {
    const inbound = (state.meteors ?? []).filter(({ status }) => status === 'inbound');
    syncPool(meteorSprites, SPRITE_KEYS.meteor, inbound.map(round));

    // Existing wreckage falls first, so anything killed on this step still draws
    // at the point of impact before it starts to move.
    debris = debris
      .map((piece) => ({
        ...piece,
        age: piece.age + 1,
        x: piece.x + piece.drift,
        y: piece.y + piece.fallStep,
      }))
      .filter((piece) => piece.age < DEBRIS_STEPS && piece.y < DEBRIS_FLOOR_Y);

    // A crack throws off wreckage the same way a kill does: the meteor visibly
    // breaks open. Both are collected, because one shot can clear the second
    // half of a split and a single sprite could only have shown one of them.
    const struck = effects.filter(
      ({ type }) => type === 'meteor-hit' || type === 'meteor-split',
    );
    for (const hit of struck) {
      debris.push({
        x: hit.x,
        y: hit.y,
        // A model that does not send the meteor's motion still gets wreckage,
        // it just falls straight down at the port's own rate.
        fallStep: (hit.fallStep ?? 1) * DEBRIS_FALL_SCALE,
        drift: hit.drift ?? 0,
        age: 0,
      });
    }

    syncPool(
      debrisSprites,
      SPRITE_KEYS.meteorDestroyed,
      debris
        .filter(({ age }) => age <= DEBRIS_FLICKER_AFTER || age % 2 === 0)
        .map(round),
    );

    // Every rock that reaches the ground plays the impact, including a half
    // whose slot was already saved -- it really did land. Only the ones that
    // cost the player something leave a crater behind.
    const impacts = effects
      .filter(({ type }) => type === 'meteor-missed' || type === 'meteor-spent')
      .map(round);
    const damaging = effects.filter(({ type }) => type === 'meteor-missed').map(round);
    if (impacts.length > 0) {
      missFrame = 1;
      pendingCraters = damaging;
      syncPool(impactSprites, SPRITE_KEYS.meteorImpact, impacts);
    } else if (missFrame > 0) {
      // Frame two is the ground explosion, and it is the last frame each miss
      // ever draws: the crater is left on the field for the rest of the storm
      // so the damage the colony took stays visible.
      if (missFrame === 1) {
        for (const at of pendingCraters) addCrater(at);
        pendingCraters = [];
      }
      missFrame = missFrame >= 2 ? 0 : missFrame + 1;
    }
    if (missFrame !== 1) syncPool(impactSprites, SPRITE_KEYS.meteorImpact, []);

    // A wrecked platform shows the burst in the tank's place until it repairs.
    const disabled = Boolean(state.laserDisabled);
    tankWreckSprite.visible = disabled;
    if (disabled) platformSprite.visible = false;
  }

  // SRCBMP-022 is 14px wide against the meteor's 10, so back it off two pixels
  // to keep the burst centred on the point of impact.
  function addCrater({ x, y }) {
    const crater = addSprite(PIXI, craterLayer, textures, SPRITE_KEYS.groundExplosion, true);
    crater.position.set(x - 2, y);
    return crater;
  }

  function round({ x, y }) {
    // The model carries fractional travel so it can halve the source's fall
    // speed; the bitmaps still land on whole pixels.
    return { x: Math.round(x), y: Math.round(y) };
  }

  // Grows a sprite pool on demand and hides the surplus. Splits mean at most two
  // are ever needed, but nothing here depends on that. Pooled sprites go into
  // the masked meteor layer so they keep their place in the z-order however many
  // get created -- appending to the scene would put them over the header text.
  function syncPool(pool, key, positions) {
    while (pool.length < positions.length) {
      pool.push(addSprite(PIXI, meteorLayer, textures, key));
    }
    pool.forEach((sprite, index) => {
      const at = positions[index];
      sprite.visible = Boolean(at);
      if (at) sprite.position.set(at.x, at.y);
    });
  }

  // Power warnings pre-empt the phase caption, matching the shared source text slot.
  function captionFor(warnings) {
    // Nothing is left to warn about once the sky is clear, and a storm can end
    // with the platform still wrecked -- the closing beat should be quiet.
    if (state.phase === 'complete') return '';
    // A wrecked platform outranks the power warnings: the player cannot act on
    // power while the tank is down, and the recharge bar is now the repair
    // timer, so the caption and the bar are telling one story.
    if (state.laserDisabled) return CAPTIONS.repairing;
    if (warnings.includes('power-drained')) return CAPTIONS.drained;
    if (lowPowerLatched(warnings)) return CAPTIONS.lowPower;
    if (restoredHold > 0) return CAPTIONS.restored;
    if (state.phase === 'deploying') {
      return slidePlatformSprite && slidePlatformSprite.x >= SLIDE_CAPTION_X
        ? CAPTIONS.preparing
        : CAPTIONS.deploying;
    }
    return CAPTIONS.targeting;
  }

  // The model announces the repair on a single step, so the view holds the
  // caption. Matched by identity for the same reason the laser beam is: the
  // armed pause and completion hold re-render one state every frame.
  function holdRestored(effects) {
    const effect = effects.find(({ type }) => type === 'tank-repaired');
    if (effect && effect !== lastRepairEffect) {
      lastRepairEffect = effect;
      restoredHold = restoredHoldInterval;
    }
  }

  // Latches on the model's warning and clears only once the bar has refilled to
  // LOW_POWER_CLEAR_FRACTION, so the caption is readable instead of a flicker.
  function lowPowerLatched(warnings) {
    if (warnings.includes('low-power')) {
      lowPowerHeld = true;
      return true;
    }
    if (!lowPowerHeld) return false;
    const filled = RECHARGE_BAR_WIDTH - (state.cooldown ?? 0);
    if (filled >= RECHARGE_BAR_WIDTH * LOW_POWER_CLEAR_FRACTION) lowPowerHeld = false;
    return lowPowerHeld;
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
      const elapsed = Math.max(0, Number.isFinite(tickerMilliseconds)
        ? tickerMilliseconds
        : deltaTime * MINIMUM_STEP_INTERVAL_MS);
      if (laserHold > 0) laserHold = Math.max(0, laserHold - elapsed);
      if (restoredHold > 0) restoredHold = Math.max(0, restoredHold - elapsed);
      if (slideElapsed !== null) {
        slideElapsed += elapsed;
        const step = Math.floor(slideElapsed / slideStepInterval);
        const x = SLIDE_START_X + step;
        if (x <= SLIDE_END_X) {
          slidePlatformSprite.position.set(x, SLIDE_Y);
        } else if (x === SETTLE_X) {
          slidePlatformSprite.position.set(SETTLE_X, SETTLE_Y);
        } else {
          slideElapsed = null;
          armedPause = armedPauseInterval;
          state = model.activate(state);
          render(state);
          return;
        }
        render(state);
        return;
      }
      // The tank is armed and the counters are up; hold before the first spawn.
      // Time past the end of the hold still counts towards the first step, so a
      // long frame cannot lose a whole simulation tick to the pause.
      let advance = elapsed;
      if (armedPause > 0) {
        advance = Math.max(0, elapsed - armedPause);
        armedPause = Math.max(0, armedPause - elapsed);
        if (armedPause > 0) {
          render(state);
          return;
        }
      }
      if (completionHold > 0) {
        completionHold = Math.max(0, completionHold - elapsed);
        render(state);
        if (completionHold === 0) finish();
        return;
      }
      accumulator += advance;
      const interval = Math.max(minimumStepInterval, state.stepDelay ?? 0);
      while (scene && accumulator >= interval) {
        accumulator -= interval;
        state = model.step(state);
        render(state);
        if (state.phase === 'complete') {
          if (completionHoldInterval <= 0) {
            finish();
            return;
          }
          completionHold = completionHoldInterval;
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
    slideElapsed = null;
    armedPause = 0;
    completionHold = 0;
    laserBeam = null;
    laserHold = 0;
    lastLaserEffect = null;
    restoredHold = 0;
    lastRepairEffect = null;
    lowPowerHeld = false;
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
    slidePlatformSprite = null;
    meteorSprites = [];
    impactSprites = [];
    debrisSprites = [];
    debris = [];
    tankWreckSprite = null;
    meteorLayer = null;
    craterLayer = null;
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
    const playFieldMask = addPlayFieldMask(PIXI, scene);
    // Craters sit on the skyline and under everything that still moves.
    craterLayer = new PIXI.Container();
    craterLayer.name = 'craters';
    craterLayer.mask = playFieldMask;
    scene.addChild(craterLayer);
    // Everything that falls lives here: one masked layer at a fixed depth, so
    // meteors pass behind the header however many the pools grow to.
    meteorLayer = new PIXI.Container();
    meteorLayer.name = 'meteors';
    meteorLayer.mask = playFieldMask;
    scene.addChild(meteorLayer);
    // Meteor bitmaps are added before the header text so a meteor entering from
    // above the frame passes behind the title rather than across it.
    impactSprites = [];
    meteorSprites = [];
    // One wreckage sprite exists from the start; the pool grows from there when
    // a split is cleared and two pieces are falling at once.
    debrisSprites = [addSprite(PIXI, meteorLayer, textures, SPRITE_KEYS.meteorDestroyed)];
    laserGraphic = new PIXI.Graphics();
    laserGraphic.name = 'beam';
    scene.addChild(laserGraphic);
    // Slide-in platform, source line 240: bitmap(d, 147, ...).
    slidePlatformSprite = addSprite(PIXI, scene, textures, SPRITE_KEYS.platformSlide);
    slidePlatformSprite.position.set(SLIDE_START_X, SLIDE_Y);
    // Armed laser platform, source line 255: bitmap(72, 140, ...).
    platformSprite = addSprite(PIXI, scene, textures, SPRITE_KEYS.platformArmed);
    platformSprite.position.set(72, PLATFORM_ARMED_Y);
    // Shown in the tank's place while the platform is wrecked and repairing.
    tankWreckSprite = addSprite(PIXI, scene, textures, SPRITE_KEYS.groundExplosion);
    tankWreckSprite.position.set(72, TANK_WRECK_Y);
    rechargeBar = new PIXI.Graphics();
    rechargeBar.position.set(120, 147);
    scene.addChild(rechargeBar);
    // SRCMSG-003, source line 234: text(80, 15, "Disaster Alert:").
    const title = addLabel(PIXI, scene, 'Disaster Alert:', fonts.title ?? fonts.status, 43, TITLE_Y);
    centerLabel(title, TITLE_Y);
    drawTitleUnderline(PIXI, scene, title);
    warningText = addLabel(PIXI, scene, '', fonts.status ?? fonts.title, 50, WARNING_CAPTION_Y);
    // Port addition: the original shows no counters. They share the recharge bar
    // row, which has two clear bands -- x8..71 before the tank at x72..87, and
    // x88..118 between the tank and the bar at x120.
    statusText = addLabel(PIXI, scene, '', fonts.status ?? fonts.title, 8, 147 - SCENE_LIFT);
    progressText = addLabel(PIXI, scene, '', fonts.status ?? fonts.title, 96, 147 - SCENE_LIFT);
    debris = [];
    missFrame = 0;
    pendingCraters = [];
    laserBeam = null;
    laserHold = 0;
    lastLaserEffect = null;
    restoredHold = 0;
    lastRepairEffect = null;
    lowPowerHeld = false;
    armedPause = 0;
    completionHold = 0;
    bindPointerInput();
    app.stage.addChild(scene);

    // The slide-in only exists when the model still has a deploying phase to leave.
    slideElapsed = initialState.phase === 'deploying' ? 0 : null;
    state = slideElapsed === null ? model.activate(initialState) : initialState;
    render(state);
    startSimulation();
    return state;
  }

  return { open, render, close };
}
