const STORAGE_KEY = 'miner2149.localBestScore';

/**
 * What a class's table holds before anyone has set a record: the source's own
 * placeholder (Miner30Source, 917-926), so a run has to beat 5,000,000 to set
 * one, as it did on the Palm.
 */
export const PLACEHOLDER_RECORD = Object.freeze({ score: 5_000_000, name: 'Mr. Nobody' });

/** The source's limit: `gets("Enter your name below (max=8):")`, asked until it fits. */
export const NAME_MAX_LENGTH = 8;

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
 * Reads every best score: each category, each asteroid class.
 *
 * A class with no record yet reads as the source's placeholder, so a run has to
 * beat 5,000,000 to set one. Two older shapes are migrated, each record into
 * the class it was set on: a bare `{ score, difficulty }` from before
 * categories (into `normal` -- Disaster Mode did not exist then), and one
 * `{ score, difficulty }` per category from before classes. Neither stored a
 * name, so theirs is empty. Their scores are kept even below the placeholder:
 * they were earned.
 */
export function readLocalBestScores(storage) {
  const stored = readStoredRecords(storage);
  const tables = {};
  for (const category of SCORE_CATEGORIES) {
    tables[category] = {};
    for (const difficulty of CLASSES) {
      tables[category][difficulty] = { ...(stored[category][difficulty] ?? PLACEHOLDER_RECORD) };
    }
  }
  return tables;
}

/** The record a finished run in `category` on a class-`difficulty` asteroid is measured against. */
export function readLocalBestScore(storage, category, difficulty) {
  if (!SCORE_CATEGORIES.includes(category) || !validDifficulty(difficulty)) return { ...PLACEHOLDER_RECORD };
  return readLocalBestScores(storage)[category][difficulty];
}

export function writeLocalBestScore(storage, category, difficulty, record) {
  if (!SCORE_CATEGORIES.includes(category)) {
    throw new TypeError(`A local best score category must be one of: ${SCORE_CATEGORIES.join(', ')}.`);
  }
  if (!validDifficulty(difficulty)) throw new TypeError('A local best score is kept per asteroid class, 1 through 5.');
  if (!validRecord(record)) {
    throw new TypeError(`A local best score requires a non-negative score and a name of at most ${NAME_MAX_LENGTH} characters.`);
  }
  const stored = readStoredRecords(storage);
  stored[category][difficulty] = { score: record.score, name: record.name };
  storage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

// Only what is actually stored, every shape migrated; no placeholders.
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

  if (validClassedRecord(stored)) {
    records.normal[stored.difficulty] = { score: stored.score, name: '' };
    return records;
  }
  for (const category of SCORE_CATEGORIES) {
    const table = stored[category];
    if (validClassedRecord(table)) {
      records[category][table.difficulty] = { score: table.score, name: '' };
      continue;
    }
    for (const difficulty of CLASSES) {
      const record = table?.[difficulty];
      if (validRecord(record)) records[category][difficulty] = { score: record.score, name: record.name };
    }
  }
  return records;
}
