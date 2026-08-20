const STORAGE_KEY = 'miner2149.localBestScore';
const EMPTY_RECORD = Object.freeze({ score: 0, difficulty: null });

function validDifficulty(difficulty) {
  return Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5;
}

function validRecord(record) {
  return Number.isFinite(record?.score)
    && record.score >= 0
    && validDifficulty(record.difficulty);
}

export function isNormalSession({ difficulty, asteroid }) {
  return validDifficulty(difficulty) && asteroid === `Class:${difficulty}`;
}

export function readLocalBestScore(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_RECORD };
    const record = JSON.parse(raw);
    return validRecord(record)
      ? { score: record.score, difficulty: record.difficulty }
      : { ...EMPTY_RECORD };
  } catch {
    return { ...EMPTY_RECORD };
  }
}

export function writeLocalBestScore(storage, record) {
  if (!validRecord(record)) throw new TypeError('A local best score requires a non-negative score and difficulty 1 through 5.');
  storage.setItem(STORAGE_KEY, JSON.stringify({
    score: record.score,
    difficulty: record.difficulty,
  }));
}
