const STORAGE_KEY = 'miner2149.localBestScore';
const EMPTY_RECORD = Object.freeze({ score: 0, difficulty: null });

/**
 * Runs are ranked in categories rather than against one pooled number.
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

function validRecord(record) {
  return Number.isFinite(record?.score)
    && record.score >= 0
    && validDifficulty(record.difficulty);
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

function emptyRecords() {
  return { normal: { ...EMPTY_RECORD }, disaster: { ...EMPTY_RECORD } };
}

/**
 * Reads the best score in each category.
 *
 * Records written before categories existed are a bare `{ score, difficulty }`.
 * Those are migrated into `normal`, which is correct: Disaster Mode did not
 * exist when they were set.
 */
export function readLocalBestScores(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyRecords();
    const stored = JSON.parse(raw);
    if (validRecord(stored)) {
      return { normal: { score: stored.score, difficulty: stored.difficulty }, disaster: { ...EMPTY_RECORD } };
    }
    const records = emptyRecords();
    for (const category of SCORE_CATEGORIES) {
      const record = stored?.[category];
      if (validRecord(record)) records[category] = { score: record.score, difficulty: record.difficulty };
    }
    return records;
  } catch {
    return emptyRecords();
  }
}

/** The best score in one category, for comparing a finished run against. */
export function readLocalBestScore(storage, category = 'normal') {
  return readLocalBestScores(storage)[category] ?? { ...EMPTY_RECORD };
}

export function writeLocalBestScore(storage, category, record) {
  if (!SCORE_CATEGORIES.includes(category)) {
    throw new TypeError(`A local best score category must be one of: ${SCORE_CATEGORIES.join(', ')}.`);
  }
  if (!validRecord(record)) throw new TypeError('A local best score requires a non-negative score and difficulty 1 through 5.');
  const records = readLocalBestScores(storage);
  records[category] = { score: record.score, difficulty: record.difficulty };
  storage.setItem(STORAGE_KEY, JSON.stringify(records));
}
