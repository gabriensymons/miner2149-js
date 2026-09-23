import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { PENDING_UNLOCK_TRIGGERS, UNLOCK_TRIGGERS } from '../scripts/skin-catalogue.js';
import { requireFunctionBody } from './app-source.js';

const appUrl = new URL('../scripts/app.js', import.meta.url);
const siteControlsUrl = new URL('../scripts/site-controls.js', import.meta.url);
const konamiUrl = new URL('../scripts/konami.js', import.meta.url);

// Every file that may name an unlock trigger. `app.js` and `site-controls.js`
// grant directly; a pure rules module cannot grant anything itself, so it
// *produces* a trigger as an `unlock` field and its caller fires it. Both count
// as wiring, and both have to be searched or a frame looks unreachable the
// moment its rule moves into a module. Add a module here when it starts naming
// triggers -- not `skin-catalogue.js`, which names all of them by definition and
// would make the pending-trigger check below vacuous.
const wiringUrls = [
  appUrl,
  siteControlsUrl,
  new URL('../scripts/construction-rules.js', import.meta.url),
];

async function readWiring() {
  const sources = await Promise.all(wiringUrls.map(url => readFile(url, 'utf8')));
  return sources.join('\n');
}

const grantPattern = trigger => new RegExp(
  `grantUnlockForTrigger\\([^)]*'${trigger}'`
  + `|grantSkinForTrigger\\('${trigger}'\\)`
  + `|unlock:[^,\n]*'${trigger}'`,
);

// These files explain in prose why they stay clear of the development tooling,
// so the prohibited strings appear in their own comments. Assert against code.
function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

test('every catalogue trigger is actually wired to a site that can fire it', async () => {
  const wiring = await readWiring();

  for (const trigger of UNLOCK_TRIGGERS) {
    if (PENDING_UNLOCK_TRIGGERS.includes(trigger)) continue;
    assert.match(
      wiring,
      grantPattern(trigger),
      `nothing grants the '${trigger}' unlock, so that frame is unreachable`,
    );
  }
});

// A trigger produced by a rules module reaches the player only if its caller
// actually fires it. Without this, moving a rule into a module could satisfy the
// test above with a value nothing acts on.
test('a trigger a rules module produces is granted by the caller, not left on the floor', async () => {
  const app = await readFile(appUrl, 'utf8');

  assert.match(
    app,
    /if \(result\.unlock\) grantSkinForTrigger\(result\.unlock\);/,
    'construction-rules produces an unlock that app.js must fire',
  );
});

test('a pending trigger is genuinely unwired, so the exemption cannot outlive its reason', async () => {
  const wiring = await readWiring();

  assert.deepEqual(
    PENDING_UNLOCK_TRIGGERS,
    ['ai-containment'],
    'a new pending trigger needs a recorded reason on its catalogue entry first',
  );

  // The point of the exemption is to let a frame be honestly locked before the
  // work that earns it exists. Once a grant site turns up the frame is
  // reachable and the flag is a lie, so this fails until `unlockPending` is
  // removed from that catalogue entry and the trigger rejoins the test above.
  for (const trigger of PENDING_UNLOCK_TRIGGERS) {
    assert.doesNotMatch(
      codeOnly(wiring),
      grantPattern(trigger),
      `'${trigger}' is wired now, so drop unlockPending from its catalogue entry`,
    );
  }
});

test('in-game unlocks are gated on devSandbox, not on isNormalSession', async () => {
  const app = await readFile(appUrl, 'utf8');
  // Sliced by the function's own braces. The indexOf-to-the-next-function form
  // this replaced ran to the end of the file if that next function ever moved
  // out, and then passed against everything. See test/app-source.js.
  const helper = requireFunctionBody(app, 'grantSkinForTrigger');

  assert.ok(helper.length > 0, 'the shared grant helper exists');
  assert.match(helper, /if \(gameData\.devSandbox\) return;/);
  // isNormalSession additionally demands a matching asteroid class and rejects
  // Disaster Mode, so gating cosmetics on it would mean the hardest ways to play
  // unlock nothing. Scores need that strictness; frames do not.
  assert.doesNotMatch(helper, /isNormalSession/);
  // Announced on the canvas too: the player is looking at the game when an
  // unlock fires, and a toast behind the console is easy to miss.
  assert.match(helper, /queueMessage\(`NEWS FLASH: \$\{skin\.label\} handheld issued/);
});

test('a forced storm from the dev panel cannot unlock a frame', async () => {
  const app = await readFile(appUrl, 'utf8');
  const apply = requireFunctionBody(app, 'applyMeteorStormResult');

  // The dev trigger sets gameData.devSandbox before starting the storm, so the
  // grant helper self-gates here with no knowledge of scripts/dev/.
  assert.match(apply, /grantSkinForTrigger\('meteor-storm'\)/);
});

test('lifetime earnings are recorded from the sale value, not the credit balance', async () => {
  const app = await readFile(appUrl, 'utf8');

  // The arithmetic moved into economy-rules.js in phase 6 and is covered there
  // ("a sale is worth its quantity times the day price"). What this test still
  // owns is the wiring: the value handed to recordDiridiumSale is the one the
  // sale produced.
  assert.match(app, /const sale = saleValue\(sellAmount, gameData\.sellPrice\);/);
  assert.match(app, /recordDiridiumSale\(localStorage, sale\)/);
  // The game starts the player with a large balance, so a balance threshold
  // would fire on day one.
  assert.doesNotMatch(app, /recordDiridiumSale\(localStorage, gameData\.credits\)/);
});

test('the Konami path cannot reach the development tooling', async () => {
  const siteControls = await readFile(siteControlsUrl, 'utf8');
  const konami = await readFile(konamiUrl, 'utf8');

  // The recorded project decision is that the player-facing Easter egg never
  // imports, triggers, aliases, or shares state with scripts/dev/. Keeping the
  // listener in site-controls.js -- a module with no path to that directory --
  // makes it structural rather than a rule someone has to remember.
  for (const [name, source] of [['site-controls.js', siteControls], ['konami.js', konami]]) {
    const code = codeOnly(source);
    assert.doesNotMatch(code, /from '\.\/dev\//, `${name} imports dev tooling`);
    assert.doesNotMatch(code, /dev-only/, `${name} carries a dev-only region`);
    assert.doesNotMatch(code, /devSandbox/, `${name} touches sandbox state`);
  }
  assert.match(siteControls, /grantUnlockForTrigger\(localStorage, 'konami'\)/);
});

test('the site chrome and the game stay separate entry points', async () => {
  const app = await readFile(appUrl, 'utf8');
  const siteControls = await readFile(siteControlsUrl, 'utf8');

  // They are loaded independently by index.html. Importing one from the other
  // would drag Pixi -- and in development the dev trigger -- into the site
  // chrome. The unlock event is the whole contract between them.
  assert.doesNotMatch(siteControls, /from '\.\/app\.js'/);
  assert.doesNotMatch(app, /from '\.\/site-controls\.js'/);
  assert.match(app, /dispatchEvent\(new CustomEvent\(SKIN_UNLOCK_EVENT/);
  assert.match(siteControls, /addEventListener\(SKIN_UNLOCK_EVENT/);
});
