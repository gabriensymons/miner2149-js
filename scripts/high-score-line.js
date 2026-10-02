/**
 * The one "Hi Score: ... by ..." line, along the bottom of the start screen --
 * and so beneath the asteroid survey and game over, which are drawn over it.
 *
 * The source draws it as text (`text(80,146,"Hi Score:"+hiscore+" by "+hiname)`
 * in Splash()); the port's art had the placeholder's painted in. There is one
 * record per asteroid class and category, so the line has to pick one board:
 * the colony's own while there is one, and afterwards the board of the last
 * colony played -- or class 1 before any (decided 2026-10-02). Which board that
 * was is cross-game state, so it keeps its own storage key, as the records do.
 *
 * DOM-free: the label (anything with `setText`) and the storage arrive injected.
 */

import { SCORE_CATEGORIES, readLocalBestScore, scoreCategory } from './local-best-score.js';

const STORAGE_KEY = 'miner2149.highScoreBoard';

/** The board shown before any colony has been played. */
export const DEFAULT_BOARD = Object.freeze({ category: 'normal', difficulty: 1 });

/** The source's own wording, spacing included. */
export function formatHighScore({ score, name }) {
  return `Hi Score:${score} by ${name}`;
}

function validBoard(board) {
  return SCORE_CATEGORIES.includes(board?.category)
    && Number.isInteger(board.difficulty) && board.difficulty >= 1 && board.difficulty <= 5;
}

/** The board of the last colony played; the default when there is none, or it cannot be read. */
export function readLastBoard(storage) {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY));
    if (validBoard(stored)) return { category: stored.category, difficulty: stored.difficulty };
  } catch {
    // Unreadable storage shows the default board rather than failing the screen.
  }
  return { ...DEFAULT_BOARD };
}

export function createHighScoreLine({ label, storage }) {
  function show(board) {
    label.setText(formatHighScore(readLocalBestScore(storage, board.category, board.difficulty)));
  }

  /**
   * Shows the colony's own board and remembers it. A colony whose class is not
   * a real one leaves the last board in place.
   */
  function showColony(colony) {
    const board = { category: scoreCategory(colony), difficulty: colony.difficulty };
    if (!validBoard(board)) {
      showLast();
      return;
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(board));
    } catch {
      // The line still shows the right board this session.
    }
    show(board);
  }

  function showLast() {
    show(readLastBoard(storage));
  }

  return { showColony, showLast };
}
