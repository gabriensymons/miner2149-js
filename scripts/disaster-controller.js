/**
 * Disasters at the end of a turn: choosing one, applying it, and the meteor
 * storm the player can fight.
 *
 * What strikes and what it costs is `disaster-rules.js`; the storm's rules are
 * `meteor-storm.js` and its scene `meteor-storm-view.js`. This is the order
 * around them: the colony replaced, the labels and reports refreshed, the news
 * queued, the surface redrawn when the level on screen was hit, and the turn
 * resumed through `done` once everything has landed.
 *
 * The storm keeps the mini-game parity rule (AGENTS.md): a storm nobody fires
 * at yields exactly the source outcome, because both bonuses below are
 * unreachable without firing. Nothing here tunes it.
 *
 * Production code: it knows nothing of the development tooling. The dev-only
 * meteor trigger in `app.js` reaches `startMeteorStorm` and
 * `applyMeteorStormResult` from outside, and is stripped from the build.
 *
 * Injected: the dialogs and their queue, the map controller, the renderer's
 * reports, awarding a frame (the turn's), Pixi, the app and the atlas textures
 * the storm is drawn with, the storm view's factory, and `pocketRandom`.
 */

import {
  applyMineCaveIn,
  applyPirateRaid,
  applyPlague,
  applyPowerPlantExplosion,
  applyRadiationStorm,
  applySpaceportCrash,
  createMeteorStormCommand,
  DISASTER_IDS,
  selectDisaster,
} from './disaster-rules.js';
import { bold, regular } from './font-styles.js';
import {
  activateMeteorStorm,
  clearMeteorLaserInput,
  createMeteorStorm,
  finishMeteorStorm,
  fireMeteorLaser,
  setMeteorLaserInput,
  stepMeteorStorm,
} from './meteor-storm.js';

export function createDisasterController({
  session, view, dialogs, map, renderer, grantSkinForTrigger, PIXI, app, textures, createStormView, pocketRandom,
}) {
  const mineScreen = view.mine.screen;
  const { dayText, creditText } = view.mine.chrome;

  function disaster(done = doNothing) {
    const colony = session.getState();
    const selection = selectDisaster(colony, { random: pocketRandom });
    if (!selection.selected) {
      done();
      return;
    }

    let result;
    switch (selection.disasterId) {
      case DISASTER_IDS.PIRATE_RAID:
        result = applyPirateRaid(colony, { random: pocketRandom });
        break;
      case DISASTER_IDS.METEOR_STORM:
        result = createMeteorStormCommand(colony, {
          buildingCounts: {
            bulldozer: map.countBuildingsByName('Bulldozer'),
            diridiumMine: map.countBuildingsByName('Diridium Mine'),
            hydroponics: map.countBuildingsByName('Hydroponics'),
            lifeSupport: map.countBuildingsByName('Life Support'),
            spacePort: map.countBuildingsByName('Space Port'),
            powerPlant: map.countBuildingsByName('Power Plant'),
            processor: map.countBuildingsByName('Processor'),
            sickbay: map.countBuildingsByName('Sickbay'),
            storage: map.countBuildingsByName('Storage'),
          },
          random: pocketRandom,
        });
        break;
      case DISASTER_IDS.SPACEPORT_CRASH:
        result = applySpaceportCrash(colony, { random: pocketRandom });
        break;
      case DISASTER_IDS.POWER_PLANT_EXPLOSION:
        result = applyPowerPlantExplosion(colony, { random: pocketRandom });
        break;
      case DISASTER_IDS.PLAGUE:
        result = applyPlague(colony, {
          sickbayCount: map.countBuildingsByName('Sickbay'),
          random: pocketRandom,
        });
        break;
      case DISASTER_IDS.RADIATION_STORM:
        result = applyRadiationStorm(colony);
        break;
      case DISASTER_IDS.MINE_CAVE_IN:
        result = applyMineCaveIn(colony, { random: pocketRandom });
        break;
      default:
        throw new Error(`Unknown disaster: ${selection.disasterId}`);
    }

    applyDisasterResult(result, done);
  }

  function applyDisasterResult(result, done) {
    if (!result.outcome.applied) {
      done();
      return;
    }

    session.replace(result.state);
    refreshLabels();

    const meteorEffect = result.effects.find(effect => effect.type === 'run-meteor-storm');
    if (meteorEffect) {
      dialogs.enqueueTask(() => {
        startMeteorStorm(meteorEffect.command, meteorResult => {
          applyMeteorStormResult(meteorResult, done);
        });
      });
      dialogs.drain();
      return;
    }

    const damagedLevels = new Set(
      (result.outcome.damagedSites ?? []).map(({ level }) => level),
    );
    const messageEffects = result.effects.filter(effect => effect.type === 'message');
    messageEffects.forEach(effect => dialogs.enqueue(effect.text));
    if (damagedLevels.has(session.getState().level)) redrawSurface();

    renderer.updateReports();
    done();
  }

  function startMeteorStorm(command, onComplete) {
    const initialState = createMeteorStorm(command);
    const stormView = createStormView({
      PIXI,
      app,
      fonts: { title: bold, status: regular },
      textures,
      model: {
        activate: activateMeteorStorm,
        step: state => stepMeteorStorm(state, { random: pocketRandom }),
        fire: fireMeteorLaser,
        setInput: setMeteorLaserInput,
        clearInput: clearMeteorLaserInput,
      },
      underlyingParent: mineScreen,
      onComplete(completedState) {
        onComplete(finishMeteorStorm(completedState, {
          maps: session.getState().maps,
          random: pocketRandom,
        }));
      },
    });
    stormView.open(initialState);
  }

  function applyMeteorStormResult(result, done) {
    const { maps, morale, diridium } = session.getState();
    const surfaceChanged = Object.keys(maps.level1).some(row => (
      maps.level1[row].some((site, column) => (
        site !== result.nextMaps.level1[row][column]
      ))
    ));
    // Amended parity, 2026-08-20: a storm the player never touches still yields
    // exactly the original outcome, because moraleDelta's bonus branch needs zero
    // misses and diridiumBonus needs a cracked core -- neither is reachable
    // without firing. See the caps in scripts/meteor-storm.js.
    session.update({
      efficiency: result.nextEfficiency,
      maps: result.nextMaps,
      morale: Math.max(0, Math.min(100, morale + (result.moraleDelta ?? 0))),
      diridium: diridium + (result.diridiumBonus ?? 0),
    });
    refreshLabels();
    renderer.updateReports();
    grantSkinForTrigger('meteor-storm');
    for (const message of result.messages ?? [result.message]) dialogs.enqueue(message);
    if (surfaceChanged && session.getState().level === 'level1') redrawSurface();
    done();
  }

  function refreshLabels() {
    const { day, credits } = session.getState();
    dayText.text = day.toString();
    creditText.text = credits.toString();
  }

  // Queued, so the surface redraws in its turn among the news, and the queue
  // resumes once the reveal has landed.
  function redrawSurface() {
    dialogs.enqueueTask(resumeQueue => {
      const { level, maps } = session.getState();
      map.updateMineSurface('Updating...', level, maps, false, resumeQueue);
    });
  }

  return { disaster, startMeteorStorm, applyMeteorStormResult };
}

function doNothing() {
  return;
}
