import assert from 'node:assert/strict';
import test from 'node:test';

import { createStageManager } from '../scripts/stage-manager.js';

/**
 * A stand-in for a Pixi Container, with the two behaviours the game relies on
 * reproduced rather than assumed: adding a child that is already mounted moves
 * it to the top instead of mounting it twice, and removing one that is not
 * mounted does nothing. Pixi v6's `addChild` re-parents and `removeChild` returns
 * null for a stranger; a fake that did otherwise would test a different stage.
 */
class FakeStage {
  constructor() { this.children = []; }
  addChild(child) {
    const at = this.children.indexOf(child);
    if (at >= 0) this.children.splice(at, 1);
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const at = this.children.indexOf(child);
    if (at < 0) return null;
    this.children.splice(at, 1);
    return child;
  }
}

const screen = name => ({ name, interactiveChildren: true });

function setup() {
  const pixiStage = new FakeStage();
  return { pixiStage, stage: createStageManager({ stage: pixiStage }) };
}

test('showing a screen mounts it on top and stops the one beneath taking input', () => {
  const { pixiStage, stage } = setup();
  const mine = screen('mine');
  const report = screen('report');

  stage.show(mine);
  stage.show(report, mine);

  assert.deepEqual(pixiStage.children, [mine, report]);
  assert.equal(mine.interactiveChildren, false, 'the mine screen is behind a report now');
  assert.equal(report.interactiveChildren, true);
});

test('hiding a screen unmounts it and gives input back to the one beneath', () => {
  const { pixiStage, stage } = setup();
  const mine = screen('mine');
  const report = screen('report');

  stage.show(mine);
  stage.show(report, mine);
  stage.hide(report, mine);

  assert.deepEqual(pixiStage.children, [mine]);
  assert.equal(mine.interactiveChildren, true);
});

// The options menu relies on this: it mounts the load screen and then itself
// over it, so opening it a second time must restack rather than double-mount.
test('showing a screen that is already up moves it to the top, once', () => {
  const { pixiStage, stage } = setup();
  const a = screen('a');
  const b = screen('b');

  stage.show(a);
  stage.show(b);
  stage.show(a);

  assert.deepEqual(pixiStage.children, [b, a]);
});

// Kept exactly: the original re-enabled the screen beneath before trying to
// unmount, so a hide that finds nothing to unmount still restores input.
test('hiding a screen that is not up still gives input back beneath', () => {
  const { pixiStage, stage } = setup();
  const mine = screen('mine');
  mine.interactiveChildren = false;

  stage.hide(screen('never shown'), mine);

  assert.deepEqual(pixiStage.children, []);
  assert.equal(mine.interactiveChildren, true);
});

test('with nothing beneath, showing and hiding touch no one else', () => {
  const { stage } = setup();
  const bystander = screen('bystander');

  stage.show(bystander);
  stage.show(screen('overlay'));
  stage.hide(screen('overlay'));

  assert.equal(bystander.interactiveChildren, true);
});

test('the topmost screen is the last one shown, and there is none on an empty stage', () => {
  const { stage } = setup();
  const mine = screen('mine');
  const options = screen('options');

  assert.equal(stage.topmost(), null);

  stage.show(mine);
  stage.show(options, mine);
  assert.equal(stage.topmost(), options);

  stage.hide(options, mine);
  assert.equal(stage.topmost(), mine);
});

test('whether a screen is up is read from the stage, not remembered separately', () => {
  const { pixiStage, stage } = setup();
  const mine = screen('mine');

  assert.equal(stage.isShowing(mine), false);
  stage.show(mine);
  assert.equal(stage.isShowing(mine), true);

  // Mounted behind the manager's back -- as init() still does for the start
  // screen -- and seen anyway, because there is no second record to drift.
  const start = screen('start');
  pixiStage.addChild(start);
  assert.equal(stage.isShowing(start), true);
});
