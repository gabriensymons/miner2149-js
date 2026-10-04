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
 * awarding a frame (the turn's), the hi-score line, the storage records are kept
 * in, telling the site the boards changed, and the Pocket-style random draw all
 * arrive injected.
 */

import { evaluateEnding } from './ending-model.js';
import { describeEnding, showEnding } from './game-over-view.js';
import {
  NAME_MAX_LENGTH,
  addToBoard,
  isNormalSession,
  nameBoardEntry,
  placeOnBoard,
  readBoard,
  scoreCategory,
} from './local-best-score.js';

// The source's own words for a record and its name (Miner30Source, 2035-2039).
const RECORD_MESSAGE = 'Congratulations, you have earned a personal record on this mine!';
const NAME_PROMPT = `Enter your name below (max=${NAME_MAX_LENGTH}):`;

// The port's own, for a place on the board below the top: the source had one
// record and nothing to say about second place.
function boardMessage({ category, difficulty, place }) {
  const board = `Class ${difficulty}${category === 'disaster' ? ' Disaster Mode' : ''}`;
  return `Your colony has earned place ${place + 1} in the ${board} records!`;
}

export function createEndingsController({
  session, view, dialogs, flow, renderer, saveWorkflow, grantSkinForTrigger, highScoreLine, storage, pocketRandom,
  announceRecords,
}) {
  const mineScreen = view.mine.screen;
  const { creditText } = view.mine.chrome;
  const optionsMenu = view.options.menu;
  const { screen: gameOver, status: gameOverStatus } = view.gameOver;
  const { inputText } = view.message.message;

  function checkEnding() {
    const colony = session.getState();
    // Disaster Mode runs are ranked in their own category rather than excluded:
    // the result was earned harder, not unearned. Only sandbox sessions are
    // rejected outright.
    const category = scoreCategory(colony);
    // Measured against this colony's own board: its class, in its category.
    const board = readBoard(storage, category, colony.difficulty);
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
      localHighScore: board[0].score,
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
      // A place on the board -- the top of it is a personal record -- is
      // written as soon as it is earned, under no name yet, so closing the page
      // at the name prompt cannot lose it; the name is written in after.
      const place = recordEligible ? placeOnBoard(board, ending.score) : null;
      let entry = null;
      if (place !== null) {
        entry = { category, difficulty: colony.difficulty, score: ending.score, place };
        if (!enter(entry)) entry = null;
      }
      dialogs.whenDrained(() => endGame(false, '', ending.completion, entry));
    }
  }

  function endGame(hasConfirmation = true, failure = '', completion = null, entry = null) {
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
      // Game over is drawn over the start screen, whose line shows this colony's board.
      highScoreLine.showColony(session.getState());
      flow.showGameOver();
      if (ending.followUp) {
        dialogs.message(gameOver, ending.followUp, entry ? () => announce(entry) : doNothing);
      }
    }
  }

  // As the source: a record is announced after the mine's future, then the
  // name is asked for until it fits; a lower place gets the port's own line
  // and the same question. Cancel, which the source's prompt did not have,
  // leaves the entry as it was written, under no name -- it was earned either way.
  function announce(entry) {
    const message = entry.place === 0 ? RECORD_MESSAGE : boardMessage(entry);
    dialogs.message(gameOver, message, () => askName(entry));
  }

  function askName(entry) {
    dialogs.input(gameOver, '', () => {
      const name = inputText.text;
      if (name.length > NAME_MAX_LENGTH) {
        askName(entry);
        return;
      }
      try {
        nameBoardEntry(storage, entry.category, entry.difficulty, { score: entry.score, name });
        announceRecords();
      } catch {
        // The entry stands under no name.
      }
      // As the source redraws its line once the name is in.
      highScoreLine.showColony(session.getState());
    }, doNothing, { prompt: NAME_PROMPT });
  }

  function enter({ category, difficulty, score }) {
    try {
      addToBoard(storage, category, difficulty, { score, name: '' });
      announceRecords();
      return true;
    } catch {
      // Completion remains playable when browser storage is unavailable.
      return false;
    }
  }

  return { checkEnding, endGame };
}

function doNothing() {
  return;
}
