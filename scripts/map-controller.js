/**
 * The asteroid surface as the player works it: tapping a site, placing and
 * undoing a building, switching levels, and the reveal that plays whenever the
 * map changes underneath the player.
 *
 * The rules are in `construction-rules.js` -- what a tap on a site means, what
 * placing a building costs and leaves behind -- and the drawing is in
 * `map-view.js`. This is what connects them to the session, the dialogs and the
 * mine screen's top bar.
 *
 * It also answers how many of a building the colony has, for the renderer, the
 * economy and the turn. Those count exact site values, so a building still
 * under construction is not counted.
 *
 * Everything that belongs elsewhere is injected: the dialogs, the map view
 * (which the colony-start flow and the gridlines toggle also draw through),
 * lighting a level button (the renderer's), and awarding a frame (the turn's).
 *
 * The undo record is this controller's own. It is not part of the colony: it is
 * never saved, and nothing else reads it.
 */

import { resolvePlacement, resolveSiteTap } from './construction-rules.js';
import { setSite } from './map-grid.js';
import { deepClone } from './utilities.js';

export function createMapController({
  session, view, mapView, buildingNames, constructionTimes, dialogs, updateLevelButtons, grantSkinForTrigger,
}) {
  // The last placement, until Undo takes it back or another placement replaces it.
  let undoData = { hasUndo: false };

  const mineScreen = view.mine.screen;
  const { dayText, creditText } = view.mine.chrome;
  const { cover: topBarCover, text: topBarText } = view.mine.chrome.topBar;

  // Asteroid grid top left is (0,0), bottom right is (9,9)
  function tapSurface(x, y) {
    const { info, decision } = resolveSiteTap(session.getState(), x, y, buildingNames);

    // An occupied site reports itself first and decides afterwards, so the
    // decision is deferred behind the message rather than raced with it.
    if (info) {
      dialogs.message(mineScreen, info, () => applySiteDecision(decision, x, y));
      return;
    }

    applySiteDecision(decision, x, y);
  }

  function applySiteDecision(decision, x, y) {
    switch (decision.action) {
      case 'notice':
        dialogs.notice(decision.text);
        return;
      case 'place':
        placeStructure(decision.num, x, y);
        return;
      case 'confirm':
        dialogs.confirm(mineScreen, decision.text, () => placeStructure(decision.num, x, y), doNothing);
        return;
    }
  }

  function placeStructure(num, x, y) {
    const result = resolvePlacement(session.getState(), num, x, y, constructionTimes);

    if (result.outcome === 'unaffordable') {
      dialogs.notice(result.text);
      return;
    }

    if (result.unlock) grantSkinForTrigger(result.unlock);

    // The site and the payment are one transaction.
    session.update({ maps: result.maps, credits: result.credits });

    const { maps, level } = session.getState();
    mapView.draw(maps[level]);

    undoData = result.undo;
  }

  function undo() {
    if (undoData.hasUndo) {
      undoData.hasUndo = false;

      const { credits, maps } = session.getState();
      session.update({
        credits: credits + undoData.undoPrice,
        maps: setSite(
          maps,
          undoData.undoLevel,
          undoData.undoY,
          undoData.undoX,
          undoData.undoNum,
        ),
      });

      const { maps: next, level } = session.getState();
      mapView.draw(next[level]);
    } else {
      dialogs.message(mineScreen, 'There is nothing that can be undone.', doNothing);
    }
  }

  function showLevel(newLevel) {
    // Short circuit if already on the same level
    if (newLevel === session.getState().level) return;

    updateLevelButtons(newLevel);

    updateMineSurface('Mapping...', newLevel, session.getState().maps);
  }

  /**
   * Redraws the surface as a row-by-row reveal from the current level's map to
   * `newMaps[newLevel]`, with the top bar showing `title` and the screen locked
   * until it lands.
   *
   * `currentMaps` defaults to the live maps, which is right for every caller
   * whose state has not moved yet. `advance()` passes the pre-advance maps.
   * `clearMap` starts the reveal from a cleared surface, which is how a colony
   * opens. `doneAnimating`, if a function, runs once it has landed.
   */
  function updateMineSurface(title, newLevel, newMaps, clearMap = false, doneAnimating, currentMaps = session.getState().maps) {
    mineScreen.interactiveChildren = false;
    dayText.visible = false;
    creditText.visible = false;
    topBarText.text = title;
    topBarCover.visible = true;

    const currentMap = deepClone(currentMaps[session.getState().level]);
    const newMap = { ...newMaps[newLevel] };

    mapView.revealLevel({ currentMap, newMap, clearMap }, () => allDone(newLevel, doneAnimating));
  }

  function allDone(newLevel, doneAnimating) {
    topBarCover.visible = false;
    dayText.visible = true;
    creditText.visible = true;
    mineScreen.interactiveChildren = true;

    // The animation is how the player's level change actually commits, so the
    // view owns this one write. Routing it through the session means it redraws
    // the level buttons like any other state change rather than relying on
    // showLevel() having set them before the animation started.
    session.update({ level: newLevel });

    // Optional callback when done animating
    typeof doneAnimating === 'function' && doneAnimating();
  }

  function countBuildings(buildingNum) {
    const { maps } = session.getState();
    let count = 0;
    for (let level in maps) {
      for (let row in maps[level]) {
        count += maps[level][row]
          .filter(site => site === buildingNum)
          .length;
      }
    }
    return count;
  }

  // Usage: countBuildingsByName('Space Port'). See buildingMap in gamedata.js
  // for the names.
  function countBuildingsByName(name) {
    const num = Number(Object.keys(buildingNames).find(key => buildingNames[key] === name));
    return countBuildings(num);
  }

  return { tapSurface, undo, showLevel, updateMineSurface, countBuildings, countBuildingsByName };
}

function doNothing() {
  return;
}
