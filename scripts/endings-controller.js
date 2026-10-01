/**
 * How a colony ends: the end-of-turn check for a credit extension, a revolt,
 * insolvency or completion, and the way out to game over -- resigning included.
 *
 * Which ending applies, and what it costs, is `ending-model.js`; what the game
 * over screen says is `game-over-view.js`. This is the order things happen in
 * around them: the colony updated, the messages queued, the record written, the
 * frame granted, and game over shown once the queue has drained.
 *
 * Three boundaries meet here and must not be merged (see AGENTS.md):
 * `isNormalSession()` decides whether a result may be recorded at all,
 * `scoreCategory()` which record it goes in, and `!devSandbox` -- applied by the
 * injected `grantSkinForTrigger` -- whether a frame is granted.
 *
 * The dialogs, the screen flow, the renderer's reports, the save workflow,
 * awarding a frame (the turn's), the storage records are kept in, and the
 * Pocket-style random draw all arrive injected.
 */

import { evaluateEnding } from './ending-model.js';
import { describeEnding, showEnding } from './game-over-view.js';
import {
  isNormalSession,
  readLocalBestScore,
  scoreCategory,
  writeLocalBestScore,
} from './local-best-score.js';

export function createEndingsController({
  session, view, dialogs, flow, renderer, saveWorkflow, grantSkinForTrigger, storage, pocketRandom,
}) {
  const mineScreen = view.mine.screen;
  const { creditText } = view.mine.chrome;
  const optionsMenu = view.options.menu;
  const { screen: gameOver, status: gameOverStatus } = view.gameOver;

  function checkEnding() {
    const colony = session.getState();
    // Disaster Mode runs are ranked in their own category rather than excluded:
    // the result was earned harder, not unearned. Only sandbox sessions are
    // rejected outright.
    const category = scoreCategory(colony);
    const localBest = readLocalBestScore(storage, category);
    const recordEligible = isNormalSession(colony);
    const revoltRoll = colony.morale < 30 ? pocketRandom(11) : 11;
    const endingInputs = {
      day: colony.day,
      morale: colony.morale,
      credits: colony.credits,
      diridium: colony.diridium,
      sellPrice: colony.sellPrice,
      difficulty: colony.difficulty,
      creditFlag: colony.creditFlag,
      revoltRoll,
      completionFlavorRoll: 0,
      localHighScore: localBest.score,
      recordEligible,
    };
    let ending = evaluateEnding(endingInputs);

    // The source only consumes random(3) once all higher-priority endings pass.
    if (ending.outcome === 'complete') {
      ending = evaluateEnding({
        ...endingInputs,
        completionFlavorRoll: pocketRandom(3),
      });
    }

    // Found by the development freeze on the first play-through after it landed.
    // This was an Object.assign onto the colony, which is why the stage 1-5 scans
    // -- all looking for `gameData.field =` -- never saw it.
    session.update(ending.state);
    creditText.text = session.getState().credits.toString();

    if (ending.outcome === 'credit-extended') {
      dialogs.enqueue('You do not have enough processed diridium to cover your debts.');
      dialogs.enqueue(`Your credit has been extended to cover ${ending.creditExtension.debtCovered} credits in debt. A lien is placed on future processed ore. Cut costs immediately!`);
      if (ending.creditExtension.limitReached) {
        dialogs.enqueue('WARNING: Your creditors refuse any future extension of your credit. Watch your expenses carefully.');
      }
      renderer.updateReports();
      saveWorkflow.save('autoSave', false);
    }

    if (ending.outcome === 'revolt') {
      dialogs.whenDrained(() => {
        dialogs.message(mineScreen, 'DISASTER: You have been forced out of an airlock by angry workers! At least the workers let you put your suit and helmet on first. A nearby ship rescues you.', () => endGame(false, 'Worker Revolt'));
      });
    } else if (ending.outcome === 'insolvency') {
      dialogs.enqueue('You do not have enough processed diridium to cover your debts.');
      dialogs.whenDrained(() => {
        dialogs.message(mineScreen, 'Your creditors will not extend you further credit. You have been terminated and creditors have taken over your mining operation. Don\'t ask for any recommendation letters.', () => endGame(false, 'Insufficient Funds'));
      });
    } else if (ending.outcome === 'complete') {
      // Two full years without ever leaving Disaster Mode. The hardest thing in
      // the game, and the only frame that cannot be earned any other way.
      if (category === 'disaster') grantSkinForTrigger('disaster-mode-completion');
      if (ending.localRecord.isNewRecord) {
        try {
          writeLocalBestScore(storage, category, { score: ending.score, difficulty: session.getState().difficulty });
        } catch {
          // Completion remains playable when browser storage is unavailable.
        }
      }
      dialogs.whenDrained(() => endGame(false, '', ending.completion));
    }
  }

  function endGame(hasConfirmation = true, failure = '', completion = null) {
    let hasEnded = false;

    // The day and credits are read here, before anything below can reset the
    // colony, and handed over as values. See game-over-view.js.
    const { day, credits } = session.getState();
    const ending = describeEnding({ completion, failure, day, credits });
    showEnding(gameOverStatus, ending);

    if (failure || completion) {
      endGameFunctions();
    } else if (hasConfirmation) {
      dialogs.confirm(optionsMenu, 'Are you sure you want to resign? (This will end your current colony.)', endGameFunctions, doNothing);
    } else endGameFunctions();

    function endGameFunctions() {
      if (hasEnded) return;
      hasEnded = true;
      flow.leaveMineForGameOver();
      // The autosave is cleared so a colony that has ended cannot be loaded back.
      // The colony itself is not reset here: that happens once, when the next one
      // begins (newMine) or is loaded, whichever way the player leaves game over.
      saveWorkflow.resetAutosave();
      flow.showGameOver();
      if (ending.followUp) {
        dialogs.message(gameOver, ending.followUp, doNothing);
      }
    }
  }

  return { checkEnding, endGame };
}

function doNothing() {
  return;
}
