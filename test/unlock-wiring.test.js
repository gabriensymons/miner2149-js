import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { UNLOCK_TRIGGERS } from '../scripts/skin-catalogue.js';

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
    assert.match(
      wiring,
      new RegExp(`grantUnlockForTrigger\\([^)]*'${trigger}'|grantSkinForTrigger\\('${trigger}'\\)`),
      `nothing grants the '${trigger}' unlock, so that frame is unreachable`,
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

  assert.match(app, /const saleValue = sellAmount \* gameData\.sellPrice;/);
  assert.match(app, /recordDiridiumSale\(localStorage, saleValue\)/);
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
