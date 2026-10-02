const STORAGE_KEY = 'miner2149.localBestScore';

/**
 * What a class's table holds before anyone has set a record: the source's own
 * placeholder (Miner30Source, 917-926), so a run has to beat 5,000,000 to set
 * one, as it did on the Palm.
 */
export const PLACEHOLDER_RECORD = Object.freeze({ score: 5_000_000, name: 'Mr. Nobody' });

/** The source's limit: `gets("Enter your name below (max=8):")`, asked until it fits. */
export const NAME_MAX_LENGTH = 8;

/**
 * Dispatched on `document` when the game writes to a board, so the site's
 * Records section -- another entry point, which shares nothing else with the
 * game -- redraws. The skin catalogue's unlock event is the precedent.
 */
export const RECORDS_EVENT = 'miner2149:records-changed';

/** How many places each board keeps (decided 2026-10-02). */
export const BOARD_SIZE = 10;

/**
 * The colony's archive: who held each board before the player, on every board
 * alike. Mr. Nobody is the source's own; the rest are the port's (chosen
 * 2026-10-02) -- puns and sound-alikes, never a franchise name spelled out, at
 * most eight characters as a player's name is. Merged in when a board is read,
 * never stored, so rewording one needs no migration.
 */
export const SEEDED_ENTRIES = Object.freeze([
  PLACEHOLDER_RECORD,
  { score: 4_200_000, name: 'PickCard' },
  { score: 3_500_000, name: 'StrBuck' },
  { score: 2_800_000, name: 'Hal O' },
  { score: 2_200_000, name: 'R2-DToo' },
  { score: 1_700_000, name: 'MegA.Bit' },
  { score: 1_200_000, name: 'CyBorg' },
  { score: 800_000, name: 'RayGun' },
  { score: 500_000, name: 'Sal Vage' },
  { score: 250_000, name: 'RowBot' },
].map((entry) => Object.freeze(entry)));

const CLASSES = Object.freeze([1, 2, 3, 4, 5]);

/**
 * Runs are ranked per asteroid class, and within a class in categories rather
 * than against one pooled number. Per class is a deliberate divergence (decided
 * 2026-10-02): v3.0 kept one score and compared it without adjustment, carrying
 * the class beside it only in the Tycoon Club code it showed the player.
 *
 * Disaster Mode is not cheating and not a sandbox -- it is the far end of the
 * same axis the asteroid class already sits on, since both change disasters
 * through `20 * (6 - difficulty)`. Ranking it separately keeps both games
 * meaningful without having to guess a multiplier for a difficulty delta the
 * project has not characterized.
 */
export const SCORE_CATEGORIES = Object.freeze(['normal', 'disaster']);

function validDifficulty(difficulty) {
  return Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5;
}

function validScore(score) {
  return Number.isFinite(score) && score >= 0;
}

function validRecord(record) {
  return validScore(record?.score) && typeof record.name === 'string' && record.name.length <= NAME_MAX_LENGTH;
}

// The shapes from before records were kept per class: a score and its class.
function validClassedRecord(record) {
  return validScore(record?.score) && validDifficulty(record.difficulty);
}

/**
 * Which category a colony's result belongs to.
 *
 * A colony counts as a Disaster Mode run only if Disaster Mode was on for every
 * day of it. Toggling it off at any point puts the run back in the normal
 * category, which is what stops someone flipping it on for the last few days to
 * claim a Disaster Mode record for a run played on normal odds. A player
 * experimenting mid-run is not punished beyond losing the harder category --
 * and having taken the extra disasters, they are simply at a disadvantage in
 * the category they land in, which needs no extra rule.
 *
 * Counting the days spent OUTSIDE the mode rather than inside it is deliberate:
 * the EM time shift advances `day` without any turn being played, so a counter
 * of days inside the mode could never equal `day` on a run that hit one.
 */
export function scoreCategory({ day, daysOutsideDisasterMode }) {
  const outside = Number.isFinite(daysOutsideDisasterMode) ? daysOutsideDisasterMode : Infinity;
  return day > 0 && outside === 0 ? 'disaster' : 'normal';
}

// `devSandbox` is set by development-only tooling that forces events the player
// did not earn. Such a session can never post a score, which is the boundary a
// future leaderboard rejects at rather than a badge it has to trust.
//
// Disaster Mode is deliberately NOT rejected here. It was once, grouped with
// sandbox sessions, but the two are opposites: a sandbox result was not earned,
// a Disaster Mode result was earned harder. It gets its own category instead.
export function isNormalSession({ difficulty, asteroid, devSandbox }) {
  if (devSandbox) return false;
  return validDifficulty(difficulty) && asteroid === `Class:${difficulty}`;
}

/**
 * A board as shown: its real entries and the archive's, best first, the top
 * BOARD_SIZE. A score has to beat an entry to pass it -- the source's
 * `credits>hiscore` -- so on a tie the earlier entry stays above, and the
 * archive counts as earlier than anything the player sets.
 */
export function readBoard(storage, category, difficulty) {
  const real = SCORE_CATEGORIES.includes(category) && validDifficulty(difficulty)
    ? readStoredRecords(storage)[category][difficulty] ?? [] : [];
  return merge(real).map(({ score, name, seeded }) => ({ score, name, seeded }));
}

/** The top of a board: what a run must beat to be a personal record, and what the hi-score line shows. */
export function readLocalBestScore(storage, category, difficulty) {
  const [{ score, name }] = readBoard(storage, category, difficulty);
  return { score, name };
}

/** Where `score` would go on `board` (0 is the top), or null if it would not make it. */
export function placeOnBoard(board, score) {
  const place = board.filter((entry) => entry.score >= score).length;
  return place < BOARD_SIZE ? place : null;
}

/**
 * Enters a run on its board, below any equal score already there. Real entries
 * the archive and better runs have pushed off the end are not kept.
 */
export function addToBoard(storage, category, difficulty, entry) {
  const stored = writableRecords(storage, category, difficulty, entry);
  const real = stored[category][difficulty] ?? [];
  const place = real.filter((existing) => existing.score >= entry.score).length;
  const next = [...real.slice(0, place), { score: entry.score, name: entry.name }, ...real.slice(place)];
  const shown = new Set(merge(next).filter(({ seeded }) => !seeded).map(({ at }) => at));
  stored[category][difficulty] = next.filter((_, at) => shown.has(at));
  storage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/** Names the entry a run was entered under with no name yet; the lowest such one, if there are several. */
export function nameBoardEntry(storage, category, difficulty, { score, name }) {
  const stored = writableRecords(storage, category, difficulty, { score, name });
  const real = stored[category][difficulty] ?? [];
  const index = real.findLastIndex((entry) => entry.score === score && entry.name === '');
  if (index === -1) return;
  real[index] = { score, name };
  storage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

// The archive and the player's entries, best first and cut to the board. Array
// sort is stable, so among equal scores the archive stays first and the
// player's entries keep the order they were stored in. `at` is a player's
// entry's index in `real`.
function merge(real) {
  return [
    ...SEEDED_ENTRIES.map((entry) => ({ ...entry, seeded: true })),
    ...real.map((entry, at) => ({ ...entry, seeded: false, at })),
  ]
    .sort((left, right) => right.score - left.score)
    .slice(0, BOARD_SIZE);
}

function writableRecords(storage, category, difficulty, entry) {
  if (!SCORE_CATEGORIES.includes(category)) {
    throw new TypeError(`A local best score category must be one of: ${SCORE_CATEGORIES.join(', ')}.`);
  }
  if (!validDifficulty(difficulty)) throw new TypeError('A local best score is kept per asteroid class, 1 through 5.');
  if (!validRecord(entry)) {
    throw new TypeError(`A local best score requires a non-negative score and a name of at most ${NAME_MAX_LENGTH} characters.`);
  }
  return readStoredRecords(storage);
}

// Only what is actually stored, every shape migrated into a list per board,
// best first; no archive.
function readStoredRecords(storage) {
  const records = Object.fromEntries(SCORE_CATEGORIES.map((category) => [category, {}]));
  let stored;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    return records;
  }
  if (!stored || typeof stored !== 'object') return records;

  // Before categories: one bare { score, difficulty }, which belongs in normal.
  if (validClassedRecord(stored)) {
    records.normal[stored.difficulty] = [{ score: stored.score, name: '' }];
    return records;
  }
  for (const category of SCORE_CATEGORIES) {
    const table = stored[category];
    // Before classes: one { score, difficulty } per category.
    if (validClassedRecord(table)) {
      records[category][table.difficulty] = [{ score: table.score, name: '' }];
      continue;
    }
    for (const difficulty of CLASSES) {
      const board = table?.[difficulty];
      // Before boards: one { score, name } per class. Since: a list of them.
      const entries = (Array.isArray(board) ? board : [board]).filter(validRecord);
      if (entries.length) {
        records[category][difficulty] = entries
          .map(({ score, name }) => ({ score, name }))
          .sort((left, right) => right.score - left.score)
          .slice(0, BOARD_SIZE);
      }
    }
  }
  return records;
}
