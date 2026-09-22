import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { PENDING_UNLOCK_TRIGGERS, UNLOCK_TRIGGERS } from '../scripts/skin-catalogue.js';

const appUrl = new URL('../scripts/app.js', import.meta.url);
const siteControlsUrl = new URL('../scripts/site-controls.js', import.meta.url);
const konamiUrl = new URL('../scripts/konami.js', import.meta.url);

// These files explain in prose why they stay clear of the development tooling,
// so the prohibited strings appear in their own comments. Assert against code.
function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

test('every catalogue trigger is actually wired to a site that can fire it', async () => {
  const app = await readFile(appUrl, 'utf8');
  const siteControls = await readFile(siteControlsUrl, 'utf8');
  const wiring = `${app}\n${siteControls}`;

  for (const trigger of UNLOCK_TRIGGERS) {
    if (PENDING_UNLOCK_TRIGGERS.includes(trigger)) continue;
    assert.match(
      wiring,
      new RegExp(`grantUnlockForTrigger\\([^)]*'${trigger}'|grantSkinForTrigger\\('${trigger}'\\)`),
      `nothing grants the '${trigger}' unlock, so that frame is unreachable`,
    );
  }
});

test('a pending trigger is genuinely unwired, so the exemption cannot outlive its reason', async () => {
  const wiring = `${await readFile(appUrl, 'utf8')}\n${await readFile(siteControlsUrl, 'utf8')}`;

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
      new RegExp(`grantUnlockForTrigger\\([^)]*'${trigger}'|grantSkinForTrigger\\('${trigger}'\\)`),
      `'${trigger}' is wired now, so drop unlockPending from its catalogue entry`,
    );
  }
});

test('in-game unlocks are gated on devSandbox, not on isNormalSession', async () => {
  const app = await readFile(appUrl, 'utf8');
  const helper = app.slice(
    app.indexOf('function grantSkinForTrigger'),
    app.indexOf('function applyRandomEventResult'),
  );

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
  const apply = app.slice(
    app.indexOf('function applyMeteorStormResult'),
    app.indexOf('function checkEnding'),
  );

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
