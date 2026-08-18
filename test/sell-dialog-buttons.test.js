import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appPath = fileURLToPath(new URL('../scripts/app.js', import.meta.url));

function spriteButtonArguments(source, buttonVariable) {
  const call = source.match(new RegExp(
    `buildSpriteButton\\(\\s*sellDiridiumDialog,\\s*${buttonVariable},([\\s\\S]*?)\\);`,
  ));

  assert.ok(call, `missing buildSpriteButton call for ${buttonVariable}`);
  return call[1].split(',').map((argument) => argument.trim());
}

test('Sell dialog buttons map transparent, hover, and pressed textures', async () => {
  const source = await readFile(appPath, 'utf8');
  const buttons = [
    {
      button: 'sellDialogSellButton',
      hoverVariable: 'sellDialogSellHover',
      hoverSprite: 'sell-dialog-sell-hover.gif',
      downVariable: 'sellDialogSellInverted',
    },
    {
      button: 'cancelDialogSellButton',
      hoverVariable: 'sellDialogCancelHover',
      hoverSprite: 'sell-dialog-cancel-hover.gif',
      downVariable: 'sellDialogCancelInverted',
    },
  ];

  for (const button of buttons) {
    const hoverTexture = new RegExp(
      `const ${button.hoverVariable} = new PIXI\\.Texture\\.from\\('${button.hoverSprite}'\\);`,
    );
    assert.ok(hoverTexture.test(source), `missing ${button.hoverSprite} texture`);
    assert.deepEqual(
      spriteButtonArguments(source, button.button).slice(1, 4),
      ['emptySpace', button.hoverVariable, button.downVariable],
    );
  }
});
