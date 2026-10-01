/**
 * A turn: advancing the days, and everything that follows in the source's order.
 *
 *   construction progress and the reveal of the new surface
 *   -> at most one random event (turn-cadence.js), which may ask the player first
 *   -> the daily core update (simulation-rules.js)
 *   -> the reports, then the autosave
 *   -> the disaster check, and only once it has landed
 *   -> the ending check, then the queued news.
 *
 * The order is the game's, and the tests here pin it as call order. A death rate
 * of 100% ends the colony inside the core update: the news already queued for
 * the day is discarded, and nothing after the core runs.
 *
 * The rules are imported. Everything that belongs to another part of the game is
 * injected: the dialogs and their queue, the map controller (surface reveal and
 * ore-vein count), the renderer's reports, the save workflow, the disasters, the
 * endings, the frame grant, and `pocketRandom`. Choosing and applying a random
 * event are injected too (`selectEvent`, `applyEvent`), because the event module
 * draws from its own generator.
 */

import { countCompletedBuildingsByName } from './simulation-calculations.js';
import { advanceConstructionProgress, updateDailyCore } from './simulation-rules.js';
import { runTurnCadence } from './turn-cadence.js';
import { deepClone } from './utilities.js';

const ORE_VEIN = 4;

export function createTurnController({
  session, view, dialogs, map, renderer, saveWorkflow, disasters, endings, grantSkinForTrigger,
  buildingNames, selectEvent, applyEvent, pocketRandom,
}) {
  const mineScreen = view.mine.screen;
  const { dayText, creditText, sellPrice } = view.mine.chrome;

  function advance(days) {
    const colony = session.getState();
    // Captured before the state moves, because the reveal animates from the map as
    // it was to the map as it now is.
    //
    // This used to work by committing the new maps on the line *after* the
    // animation was started, so the animation silently depended on the state being
    // one step stale. Committing everything in one go would have animated the new
    // map into itself -- no visible change, no error. The dependency is a
    // parameter now rather than an ordering nobody could see.
    const previousMaps = colony.maps;
    const updatedMaps = advanceConstructionProgress(colony.maps, days);

    session.update({
      day: colony.day + days,
      // Days played outside Disaster Mode decide the run's score category. Counted
      // here rather than from `day` because the EM time shift moves the day forward
      // without a turn being played, and those days belong to neither mode.
      daysOutsideDisasterMode: colony.disasterMode
        ? colony.daysOutsideDisasterMode
        : colony.daysOutsideDisasterMode + days,
      soldToday: false,
      maps: deepClone(updatedMaps),
    });

    map.updateMineSurface(
      'Updating...',
      session.getState().level,
      updatedMaps,
      false,
      () => updateStats(days),
      previousMaps,
    );
  }

  function updateStats(days) {
    runTurnCadence({
      days,
      state: session.getState(),
      noOreVeins: map.countBuildings(ORE_VEIN) === 0,
      selectEvent,
      applyEvent,
      commitEvent: applyRandomEventResult,
      requestChoice(choice, accept, decline) {
        dialogs.confirm(mineScreen, choice.message, accept, decline);
      },
      coreUpdate: updateCoreStats,
    });
  }

  function applyRandomEventResult(result) {
    session.replace(result.state);
    const { day, credits } = session.getState();
    dayText.text = day.toString();
    creditText.text = credits.toString();
    result.messages.forEach(message => dialogs.enqueue(message));

    // Matched on effects rather than event ids: the effects array is the committed
    // contract between random-events.js and this controller, and `set-morale` is
    // emitted only by the alien artifact, `time-shift` only by the EM storm.
    const effectTypes = new Set((result.effects ?? []).map(({ type }) => type));
    if (effectTypes.has('set-morale')) grantSkinForTrigger('alien-artifact');
    if (effectTypes.has('time-shift')) grantSkinForTrigger('time-shift');

    if (result.mapUpdate?.redraw) {
      const { level, maps } = session.getState();
      map.updateMineSurface('Updating...', level, maps, false, doNothing);
    }
  }

  function updateCoreStats(days) {
    const colony = session.getState();
    const buildingCounts = countCompletedBuildingsByName(colony.maps, buildingNames);
    const result = updateDailyCore(colony, buildingCounts, days, { random: pocketRandom });
    session.replace(result.state);
    creditText.text = session.getState().credits.toString();
    sellPrice.text = session.getState().sellPrice.toString();

    if (result.deathRateTerminal) {
      dialogs.discard();
      dialogs.message(mineScreen, 'NEWS FLASH: With the asteriod mine death rate rising to 100%, the Space Guard has intervened to rescue the remaining workers. A reward is offered for the capture of those responsible.', () => endings.endGame(false, 'Death Rate Reached 100%'));
      return;
    }

    result.messages.forEach(message => dialogs.enqueue(message));
    finishCoreUpdate();
  }

  function finishCoreUpdate() {
    renderer.updateReports();
    saveWorkflow.save('autoSave', false);

    disasters.disaster(() => {
      endings.checkEnding();
      dialogs.drain();
    });
  }

  return { advance };
}

function doNothing() {
  return;
}
