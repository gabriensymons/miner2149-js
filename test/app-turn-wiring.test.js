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
  assert.match(updateStats, /noOreVeins: countBuildings\(4\) === 0/);
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
  assert.ok(finish.indexOf('updateReports(days)') < finish.indexOf('disaster('));
  assert.ok(finish.indexOf('disaster(') < finish.indexOf('checkEnding()'));
});

test('core ending waits for callback disaster completion and queued tasks run serially', async () => {
  const source = await readFile(appUrl, 'utf8');
  const finish = functionBody(source, 'finishCoreUpdate');

  assert.ok(finish);
  assert.match(finish, /disaster\(\(\) => \{[\s\S]*?checkEnding\(\);[\s\S]*?showQueuedMessages\(\);[\s\S]*?\}\);/);
  assert.doesNotMatch(finish, /disaster\(\);/);
  // Phase 8 moved the queue into dialog-service.js, where tasks running serially
  // and the queue waiting on them are tested as behaviour ("a task is handed the
  // drain, and the queue waits until the task calls it"; "tasks run serially,
  // never side by side"). These two used to match the queue's implementation
  // here; what is left of app.js's part is handing work to it.
  assert.match(functionBody(source, 'queueTask'), /dialogs\.enqueueTask\(run\)/);
  assert.match(functionBody(source, 'showQueuedMessages'), /dialogs\.drain\(\)/);
});

test('app selects and dispatches all seven pure disasters with Pocket-exclusive randomness', async () => {
  const source = await readFile(appUrl, 'utf8');
  const disaster = functionBody(source, 'disaster');

  assert.match(source, /from '\.\/disaster-rules\.js';/);
  assert.match(source, /from '\.\/meteor-storm\.js';/);
  assert.match(source, /import \{ createMeteorStormView \} from '\.\/meteor-storm-view\.js';/);
  assert.ok(disaster);
  assert.match(disaster, /selectDisaster\(gameData, \{ random: pocketRandom \}\)/);
  assert.match(disaster, /if \(!selection\.selected\)[\s\S]*?done\(\);[\s\S]*?return;/);
  for (const id of [
    'PIRATE_RAID',
    'METEOR_STORM',
    'SPACEPORT_CRASH',
    'POWER_PLANT_EXPLOSION',
    'PLAGUE',
    'RADIATION_STORM',
    'MINE_CAVE_IN',
  ]) {
    assert.match(disaster, new RegExp(`DISASTER_IDS\\.${id}`));
  }
  for (const apply of [
    'applyPirateRaid',
    'createMeteorStormCommand',
    'applySpaceportCrash',
    'applyPowerPlantExplosion',
    'applyPlague',
    'applyRadiationStorm',
    'applyMineCaveIn',
  ]) {
    assert.match(disaster, new RegExp(`${apply}\\(`));
  }
  assert.match(disaster, /applyDisasterResult\(result, done\)/);
});

test('app preserves no-op disasters and presents applied synchronous results', async () => {
  const source = await readFile(appUrl, 'utf8');
  const applyResult = functionBody(source, 'applyDisasterResult');

  assert.ok(applyResult);
  assert.match(applyResult, /if \(!result\.outcome\.applied\)[\s\S]*?done\(\);[\s\S]*?return;/);
  assert.match(applyResult, /session\.replace\(result\.state\)/);
  assert.match(applyResult, /effect\.type === 'message'/);
  assert.match(applyResult, /queueMessage\(effect\.text/);
  assert.match(applyResult, /result\.outcome\.damagedSites/);
  assert.match(applyResult, /updateMineSurface\([\s\S]*?'Updating\.\.\.'/);
  assert.match(applyResult, /dayText\.text = gameData\.day\.toString\(\)/);
  assert.match(applyResult, /creditText\.text = gameData\.credits\.toString\(\)/);
  assert.match(applyResult, /updateReports\(\)/);
  assert.match(applyResult, /done\(\);\s*$/);
});

test('meteor disaster is a queued nonblocking view and commits before ending resumes', async () => {
  const source = await readFile(appUrl, 'utf8');
  const applyResult = functionBody(source, 'applyDisasterResult');
  const startMeteor = functionBody(source, 'startMeteorStorm');
  const applyMeteor = functionBody(source, 'applyMeteorStormResult');

  assert.ok(applyResult);
  assert.match(applyResult, /effect\.type === 'run-meteor-storm'/);
  assert.match(applyResult, /queueTask\(/);
  assert.match(applyResult, /startMeteorStorm\(meteorEffect\.command/);
  assert.match(applyResult, /showQueuedMessages\(\);[\s\S]*?return;/);

  assert.ok(startMeteor);
  assert.match(startMeteor, /createMeteorStorm\(command\)/);
  assert.match(startMeteor, /createMeteorStormView\(/);
  // The storm modal paints a white ground, so the title needs the black-tinted face.
  assert.match(startMeteor, /fonts: \{ title: bold, status: regular \}/);
  assert.match(startMeteor, /textures: sheet\.textures/);
  assert.match(startMeteor, /underlyingParent: mineScreen/);
  assert.match(startMeteor, /activate: activateMeteorStorm/);
  assert.match(startMeteor, /stepMeteorStorm\(state, \{ random: pocketRandom \}\)/);
  assert.match(startMeteor, /fire: fireMeteorLaser/);
  assert.match(startMeteor, /setInput: setMeteorLaserInput/);
  assert.match(startMeteor, /clearInput: clearMeteorLaserInput/);
  assert.match(startMeteor, /finishMeteorStorm\(completedState, \{[\s\S]*?maps: gameData\.maps,[\s\S]*?random: pocketRandom,[\s\S]*?\}\)/);

  assert.ok(applyMeteor);
  // The spread moved into the session: update() patches the current state, so
  // the call site no longer restates `...gameData`. Same commit, one owner.
  assert.match(applyMeteor, /session\.update\(\{[\s\S]*?efficiency: result\.nextEfficiency,[\s\S]*?maps: result\.nextMaps/);
  assert.match(applyMeteor, /for \(const message of result\.messages \?\? \[result\.message\]\) queueMessage\(message\)/);
  // Amended parity: both storm bonuses are applied here, clamped to the game's
  // own bounds, and are inert on a storm the player never fired in.
  assert.match(applyMeteor, /morale: Math\.max\(0, Math\.min\(100, gameData\.morale \+ \(result\.moraleDelta \?\? 0\)\)\)/);
  assert.match(applyMeteor, /diridium: gameData\.diridium \+ \(result\.diridiumBonus \?\? 0\)/);
  assert.match(applyMeteor, /updateReports\(\)/);
  assert.match(applyMeteor, /done\(\);\s*$/);
  assert.doesNotMatch(source, /PageDown|Page Down|code === ['"]PageDown['"]/);
});

test('source-derived core and ending RNG calls use exclusive Pocket ranges', async () => {
  const source = await readFile(appUrl, 'utf8');
  const rules = await readFile(rulesUrl, 'utf8');
  const core = functionBody(source, 'updateCoreStats');
  const ending = functionBody(source, 'checkEnding');

  assert.match(core, /\{ random: pocketRandom \}/);
  assert.match(rules, /random\(10\) === 1/);
  assert.match(rules, /const priceEvent = random\(50\)/);
  assert.match(rules, /random\(3\) \+ 5/);
  assert.match(rules, /random\(4\) - 2/);
  assert.match(rules, /random\(3\) - 1/);
  assert.doesNotMatch(core, /randomNum\(/);
  assert.match(ending, /pocketRandom\(11\)/);
  assert.match(ending, /evaluateEnding\(/);
});

test('terminal cleanup is guarded once and completion retains manual saves', async () => {
  const source = await readFile(appUrl, 'utf8');
  const endGame = functionBody(source, 'endGame');

  assert.ok(endGame);
  assert.match(endGame, /let hasEnded = false/);
  assert.match(endGame, /if \(hasEnded\) return/);
  assert.match(endGame, /resetAutosave\(\)/);
  assert.doesNotMatch(endGame, /save[123]/);
  assert.match(source, /buildCompletionPresentation\(/);
  assert.match(source, /writeLocalBestScore\(localStorage, category, \{ score: ending\.score, difficulty: gameData\.difficulty \}\)/);
});
