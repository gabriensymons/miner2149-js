import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHitzone, buildHoverHitzone, buildSpriteButton, buildTextButton
} from '../scripts/button.js';

class EventTarget {
  constructor() {
    this.children = [];
    this.handlers = new Map();
    this.position = {
      set: (x, y) => {
        this.x = x;
        this.y = y;
      },
    };
  }

  addChild(child) {
    this.children.push(child);
    child.parent = this;
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter(candidate => candidate !== child);
    child.parent = null;
    return child;
  }

  on(event, callback) {
    this.handlers.set(event, callback);
    return this;
  }

  emit(event, ...args) {
    this.handlers.get(event)?.(...args);
  }
}

class Sprite extends EventTarget {
  constructor(texture) {
    super();
    this.texture = texture;
  }
}

class NineSlicePlane extends Sprite {
  constructor(texture, leftWidth, topHeight, rightWidth, bottomHeight) {
    super(texture);
    Object.assign(this, { leftWidth, topHeight, rightWidth, bottomHeight });
  }
}

class BitmapText extends EventTarget {
  constructor(text, style) {
    super();
    Object.assign(this, { text, style });
  }
}

class Container extends EventTarget {}

class Rectangle {
  constructor(x, y, width, height) {
    Object.assign(this, { x, y, width, height });
  }
}

class Graphics extends EventTarget {
  beginFill(color, alpha) {
    Object.assign(this, { fillColor: color, fillAlpha: alpha });
    return this;
  }

  drawRect(x, y, width, height) {
    this.rect = { x, y, width, height };
    return this;
  }

  endFill() {
    return this;
  }
}

globalThis.PIXI = { BitmapText, Container, Graphics, NineSlicePlane, Rectangle, Sprite };

test('buildHitzone uses transparent hit geometry without a rendered fill', () => {
  const parent = new Container();
  const zone = buildHitzone(parent, 14, 12, 6, 119, () => {});

  assert.deepEqual(zone.hitArea, new Rectangle(0, 0, 14, 12));
  assert.deepEqual(zone.children, []);
  assert.equal(zone.interactive, true);
});

test('buildTextButton preserves rounded caps when a button uses nine-slice scaling', () => {
  const parent = new Container();
  const texture = { id: 'menu-button' };
  const slices = {
    leftWidth: 6,
    topHeight: 6,
    rightWidth: 6,
    bottomHeight: 6,
  };

  const button = buildTextButton(
    parent,
    86,
    15,
    11,
    30,
    texture,
    { id: 'hover' },
    { id: 'down' },
    () => {},
    'Empty Slot 1',
    undefined,
    slices,
  );

  assert.ok(button instanceof NineSlicePlane);
  assert.deepEqual(
    {
      leftWidth: button.leftWidth,
      topHeight: button.topHeight,
      rightWidth: button.rightWidth,
      bottomHeight: button.bottomHeight,
    },
    slices,
  );
  assert.equal(button.width, 86);
  assert.equal(button.height, 15);
});

test('buildTextButton ignores pointerup unless pointerdown armed the button', () => {
  const parent = new Container();
  let activations = 0;
  const button = buildTextButton(
    parent,
    42,
    13,
    0,
    0,
    { id: 'normal' },
    { id: 'hover' },
    { id: 'down' },
    () => activations += 1,
    'Load Mine',
  );

  button.emit('pointerover');
  button.emit('pointerup');
  assert.equal(activations, 0);

  button.emit('pointerdown');
  button.emit('pointerup');
  assert.equal(activations, 1);
});

function createButton({ onCancel, onDown = () => true, onUp = () => {} } = {}) {
  const parent = new Container();
  const textures = {
    normal: { id: 'normal' },
    hover: { id: 'hover' },
    down: { id: 'down' },
  };

  const zone = buildSpriteButton(
    parent,
    { width: 12, height: 11, x: 1, y: 2 },
    { width: 14, height: 13, x: 0, y: 1 },
    textures.normal,
    textures.hover,
    textures.down,
    onDown,
    onUp,
    onCancel,
  );

  return { parent, sprite: parent.children[0], textures, zone };
}

test('buildSpriteButton uses transparent hit geometry without a rendered fill', () => {
  const { zone } = createButton();

  assert.deepEqual(zone.hitArea, new Rectangle(0, 0, 14, 13));
  assert.deepEqual(zone.children, []);
});

test('buildSpriteButton preserves pressed state across pointer exit and re-entry', () => {
  let activations = 0;
  const { sprite, textures, zone } = createButton({
    onUp: () => activations += 1,
  });

  zone.emit('pointerover');
  assert.equal(sprite.texture, textures.hover);

  zone.emit('pointerdown');
  assert.equal(sprite.texture, textures.down);

  zone.emit('pointerout');
  assert.equal(sprite.texture, textures.normal);

  zone.emit('pointerover');
  assert.equal(sprite.texture, textures.down);

  zone.emit('pointerup');
  assert.equal(sprite.texture, textures.hover);
  assert.equal(activations, 1);
});

test('buildSpriteButton clears hover when activation disables its parent', () => {
  let parent;
  const button = createButton({
    onUp: () => {
      parent.interactiveChildren = false;
    },
  });
  ({ parent } = button);

  button.zone.emit('pointerover');
  button.zone.emit('pointerdown');
  button.zone.emit('pointerup');

  assert.equal(button.sprite.texture, button.textures.normal);
});

test('buildSpriteButton cancels a press released outside without activating it', () => {
  let activations = 0;
  let cancellations = 0;
  const { sprite, textures, zone } = createButton({
    onUp: () => activations += 1,
    onCancel: () => cancellations += 1,
  });

  zone.emit('pointerover');
  zone.emit('pointerdown');
  zone.emit('pointerout');
  zone.emit('pointerupoutside');

  assert.equal(sprite.texture, textures.normal);
  assert.equal(activations, 0);
  assert.equal(cancellations, 1);
});

test('buildSpriteButton handles pointer cancellation like an outside release', () => {
  let cancellations = 0;
  const { sprite, textures, zone } = createButton({
    onCancel: () => cancellations += 1,
  });

  zone.emit('pointerover');
  zone.emit('pointerdown');
  zone.emit('pointercancel');

  assert.equal(sprite.texture, textures.normal);
  assert.equal(cancellations, 1);
});

test('buildHoverHitzone moves one shared overlay between hit zones', () => {
  const parent = new Container();
  const overlay = new Sprite({ id: 'hover' });
  overlay.visible = false;
  parent.addChild(overlay);
  let activations = 0;

  const first = buildHoverHitzone(
    parent,
    overlay,
    { width: 14, height: 12, x: 5, y: 119 },
    { width: 15, height: 12, x: 6, y: 119 },
    () => activations += 1,
  );
  const second = buildHoverHitzone(
    parent,
    overlay,
    { width: 14, height: 12, x: 20, y: 119 },
    { width: 14, height: 12, x: 22, y: 119 },
    () => activations += 1,
  );

  first.emit('pointerover');
  assert.equal(overlay.visible, true);
  assert.deepEqual(
    { width: overlay.width, height: overlay.height, x: overlay.x, y: overlay.y },
    { width: 14, height: 12, x: 5, y: 119 },
  );

  first.emit('pointerdown');
  assert.equal(activations, 1);
  assert.equal(overlay.visible, true);

  first.emit('pointerout');
  assert.equal(overlay.visible, false);

  second.emit('pointerover');
  assert.equal(overlay.visible, true);
  assert.deepEqual(
    { width: overlay.width, height: overlay.height, x: overlay.x, y: overlay.y },
    { width: 14, height: 12, x: 20, y: 119 },
  );
});

test('buildHoverHitzone clears the overlay when its action disables the parent', () => {
  const parent = new Container();
  const overlay = new Sprite({ id: 'hover' });
  overlay.visible = false;
  parent.addChild(overlay);
  const zone = buildHoverHitzone(
    parent,
    overlay,
    { width: 68, height: 15, x: 15, y: 51 },
    { width: 65, height: 11, x: 15, y: 53 },
    () => parent.interactiveChildren = false,
  );

  zone.emit('pointerover');
  zone.emit('pointerdown');

  assert.equal(overlay.visible, false);
});

test('buildHoverHitzone clears the overlay when its action removes the parent', () => {
  const stage = new Container();
  const parent = new Container();
  const overlay = new Sprite({ id: 'hover' });
  overlay.visible = false;
  stage.addChild(parent);
  parent.addChild(overlay);
  const zone = buildHoverHitzone(
    parent,
    overlay,
    { width: 68, height: 15, x: 15, y: 66 },
    { width: 65, height: 11, x: 15, y: 68 },
    () => stage.removeChild(parent),
  );

  zone.emit('pointerover');
  zone.emit('pointerdown');

  assert.equal(overlay.visible, false);
});

test('buildHoverHitzone clears the overlay after non-hover pointer endings', () => {
  const parent = new Container();
  const overlay = new Sprite({ id: 'hover' });
  overlay.visible = false;
  parent.addChild(overlay);
  const zone = buildHoverHitzone(
    parent,
    overlay,
    { width: 12, height: 12, x: 1, y: 14 },
    { width: 10, height: 10, x: 2, y: 15 },
    () => {},
  );

  zone.emit('pointerover');
  zone.emit('pointercancel');
  assert.equal(overlay.visible, false);

  zone.emit('pointerover');
  zone.emit('pointerupoutside');
  assert.equal(overlay.visible, false);

  zone.emit('pointerover');
  zone.emit('pointerup', { data: { pointerType: 'touch' } });
  assert.equal(overlay.visible, false);

  zone.emit('pointerover');
  zone.emit('pointerup', { data: { pointerType: 'mouse' } });
  assert.equal(overlay.visible, true);
});
