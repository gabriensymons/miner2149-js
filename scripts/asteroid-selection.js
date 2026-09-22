/**
 * Pure asteroid-survey rules: what the probes find, and what picking one does to
 * the colony.
 *
 * DOM-free and Pixi-free, with randomness injected rather than reached for, so
 * the survey can be replayed exactly in a test. `app.js` owns the buttons this
 * feeds and commits the selection through the session.
 *
 * Probe counting and its cost live in `economy-rules.js` with the other money.
 */

/**
 * Surveys one asteroid per probe.
 *
 * **The draw order is load-bearing.** Each probe rolls its class first and its
 * designation second, and the two draws come from the same generator, so
 * reordering them or hoisting one into its own loop changes every result that
 * follows. The loop is written the way `launchProbes()` wrote it for that
 * reason.
 *
 * `rollDifficulty` returns a class label (`'Class 3-Few Mines'`); `rollDesignation`
 * returns the two-character tag printed on the button.
 */
export function surveyAsteroids(probeCount, { rollDifficulty, rollDesignation }) {
  const asteroids = [];

  for (let i = 0; i < probeCount; i++) {
    const label = rollDifficulty();
    const designation = rollDesignation();
    asteroids.push({ label, designation });
  }

  return asteroids;
}

/**
 * The class digit inside a label such as `'Class 4-Rocky'`.
 *
 * Read positionally, as the original does, rather than by pattern: every label
 * in `difficultyMap` is `Class <n>-<word>`, so position 6 is the digit. A parser
 * would accept labels the game cannot produce and hide a typo in the map.
 */
export function difficultyFromLabel(label) {
  return Number(label.charAt(6));
}

/**
 * What choosing one surveyed asteroid does to the colony.
 *
 * `miningEfficiency` comes from source line 1110, `meff = 110 - (diff * 10)`.
 * **This is the only place it is derived from the class** — the engineer event
 * moves it afterwards, so it is stored rather than recomputed.
 */
export function selectAsteroid(asteroids, index) {
  const { label } = asteroids[index];
  const difficulty = difficultyFromLabel(label);

  return {
    asteroid: `Class:${difficulty}`,
    difficulty,
    miningEfficiency: 110 - difficulty * 10,
  };
}
