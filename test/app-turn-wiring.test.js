import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { requireFunctionBody as functionBody } from './app-source.js';

const appUrl = new URL('../scripts/app.js', import.meta.url);
const rulesUrl = new URL('../scripts/simulation-rules.js', import.meta.url);

// Functions are sliced by their own boundaries, not by naming the one after
// them. The old helper required each pair to be adjacent in app.js, which broke
// on every decomposition phase that moved a neighbour -- and for
// finishCoreUpdate it was already false: grantSkinForTrigger sits between it and
// applyRandomEventResult, so the old slice returned both functions joined. See
// test/app-source.js.

test('app advances construction through the pure immutable simulation seam', async () => {
  const source = await readFile(appUrl, 'utf8');
  const advance = functionBody(source, 'advance');

  assert.match(source, /import \{[\s\S]*?advanceConstructionProgress[\s\S]*?\} from '\.\/simulation-rules\.js';/);
  assert.ok(advance);
  assert.match(advance, /advanceConstructionProgress\(gameData\.maps, days\)/);
  assert.doesNotMatch(source, /function updateMapProgress\(/);

  // Stage 2 of Plan 13: the advance path commits through the session in one
  // update and writes no field of the state by hand. This is the stage's exit
  // criterion, pinned so it cannot quietly regress.
  assert.match(advance, /session\.update\(\{[\s\S]*?day: gameData\.day \+ days/);
  assert.doesNotMatch(advance, /gameData\.\w+\s*(?:=[^=]|\+=|-=)/);

  // The reveal is handed the pre-advance maps explicitly. It used to read them
  // from a state that had deliberately not been committed yet, so committing
  // everything at once would have animated the new map into itself -- no visible
  // change and no error.
  assert.match(advance, /const previousMaps = gameData\.maps/);
  assert.match(advance, /updateMineSurface\([\s\S]*?previousMaps,[\s\S]*?\)/);
});

test('app keeps the daily core adapter thin and preserves the death-rate callback', async () => {
  const source = await readFile(appUrl, 'utf8');
  const core = functionBody(source, 'updateCoreStats');

  assert.match(source, /import \{[\s\S]*?updateDailyCore[\s\S]*?\} from '\.\/simulation-rules\.js';/);
  assert.ok(core);
  assert.match(core, /countCompletedBuildingsByName\(gameData\.maps, buildingMap\)/);
  assert.match(core, /updateDailyCore\(gameData, buildingCounts, days, \{ random: pocketRandom \}\)/);
  // Stage 1 of Plan 13 moved the call shape: the state is replaced through the
  // session so its listeners are told. The contract being pinned is unchanged --
  // the pure module's result becomes the state.
  assert.match(core, /session\.replace\(result\.state\)/);
  assert.match(core, /result\.messages\.forEach\(message => queueMessage\(message\)\)/);
  // The queued news is discarded before the game-over message, not shown after
  // it. That half was never asserted until phase 8 moved the queue, when losing
  // the variable it reset would have crashed this ending and nothing else.
  assert.match(core, /if \(result\.deathRateTerminal\)[\s\S]*?dialogs\.discard\(\);[\s\S]*?dialogs\.message\([\s\S]*?endGame\(false, 'Death Rate Reached 100%'\)[\s\S]*?return;/);
  assert.match(core, /finishCoreUpdate\(days\);\s*$/);
  assert.doesNotMatch(core, /Math\.(?:floor|ceil)|countBuildingsByName\(/);
});

test('app wires pure random events ahead of every positive core update', async () => {
  const source = await readFile(appUrl, 'utf8');
  const updateStats = functionBody(source, 'updateStats');

  assert.match(source, /import \{ pocketRandom, random, randomNum \} from '\.\/random\.js';/);
  assert.match(source, /import \{ applyRandomEvent, selectRandomEvent \} from '\.\/random-events\.js';/);
  assert.match(source, /import \{ runTurnCadence \} from '\.\/turn-cadence\.js';/);
  assert.ok(updateStats);
  assert.match(updateStats, /runTurnCadence\(/);
  // Phase 9b step 3: counting moved into map-controller.js, with its own tests.
  assert.match(updateStats, /noOreVeins: map\.countBuildings\(4\) === 0/);
  assert.doesNotMatch(updateStats, /gameData\.day\s*[<>]=?\s*21/);
  assert.doesNotMatch(source, /function checkRandomEvent\(/);
});

test('non-terminal pure core updates continue through reports, disaster, and ending in source order', async () => {
  const source = await readFile(appUrl, 'utf8');
  const core = functionBody(source, 'updateCoreStats');
  const finish = functionBody(source, 'finishCoreUpdate');

  assert.ok(core);
  assert.match(core, /updateDailyCore\([\s\S]*?finishCoreUpdate\(days\);\s*$/);
  assert.doesNotMatch(core, /gameData\.day\s*[<>]=?\s*21/);
  assert.ok(finish);
  assert.ok(finish.includes('renderer.updateReports()'));
  assert.ok(finish.indexOf('renderer.updateReports()') < finish.indexOf('disaster('));
  assert.ok(finish.includes('endings.checkEnding()'));
  assert.ok(finish.indexOf('disaster(') < finish.indexOf('endings.checkEnding()'));
});

test('core ending waits for callback disaster completion and queued tasks run serially', async () => {
  const source = await readFile(appUrl, 'utf8');
  const finish = functionBody(source, 'finishCoreUpdate');

  assert.ok(finish);
  assert.match(finish, /disaster\(\(\) => \{[\s\S]*?endings\.checkEnding\(\);[\s\S]*?showQueuedMessages\(\);[\s\S]*?\}\);/);
  assert.doesNotMatch(finish, /disaster\(\);/);
  // Phase 8 moved the queue into dialog-service.js, where tasks running serially
  // and the queue waiting on them are tested as behaviour ("a task is handed the
  // drain, and the queue waits until the task calls it"; "tasks run serially,
  // never side by side"). These two used to match the queue's implementation
  // here; what is left of app.js's part is handing work to it.
  assert.match(functionBody(source, 'queueTask'), /dialogs\.enqueueTask\(run\)/);
  assert.match(functionBody(source, 'showQueuedMessages'), /dialogs\.drain\(\)/);
});

// The three disaster tests that sliced disaster, applyDisasterResult,
// startMeteorStorm and applyMeteorStormResult moved with them into
// disaster-controller.js in phase 9b step 7. Each intent is a behaviour test in
// disaster-controller.test.js: the selection drawn from pocketRandom (gate, then
// table), each of the seven disasters dispatched to its own rule with exactly its
// draws, a no-op resuming the turn untouched, labels and reports refreshed and
// done() last, the damaged level redrawn as a queued task, the storm queued and
// the queue drained, the storm view opened with the bold title face, the atlas,
// the mine screen and the storm rules, its result applied with morale clamped and
// both bonuses inert on a storm nobody fired in.

test('app.js handles no Page Down key', async () => {
  const source = await readFile(appUrl, 'utf8');

  assert.doesNotMatch(source, /PageDown|Page Down|code === ['"]PageDown['"]/);
});

test('source-derived core and ending RNG calls use exclusive Pocket ranges', async () => {
  const source = await readFile(appUrl, 'utf8');
  const rules = await readFile(rulesUrl, 'utf8');
  const core = functionBody(source, 'updateCoreStats');

  assert.match(core, /\{ random: pocketRandom \}/);
  assert.match(rules, /random\(10\) === 1/);
  assert.match(rules, /const priceEvent = random\(50\)/);
  assert.match(rules, /random\(3\) \+ 5/);
  assert.match(rules, /random\(4\) - 2/);
  assert.match(rules, /random\(3\) - 1/);
  assert.doesNotMatch(core, /randomNum\(/);
  // The ending's draws -- pocketRandom(11) for a revolt, only below 30 morale, and
  // pocketRandom(3) only once completion is reached -- moved with checkEnding into
  // endings-controller.js in phase 9b step 6, and are tested there as behaviour.
});

// 'terminal cleanup is guarded once and completion retains manual saves' moved
// with endGame into endings-controller.js in phase 9b step 6. Every intent it
// matched in app.js's source -- the once-only guard, the autosave cleared and no
// manual slot written, the day and credits read before anything can reset the
// colony, and the record written to the category's store -- is now a behaviour
// test in endings-controller.test.js.
