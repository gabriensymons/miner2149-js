import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function javaScriptFiles(directory) {
  const files = [];
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'vendor') {
      files.push(...await javaScriptFiles(relativePath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(relativePath);
    }
  }

  return files;
}

test('production JavaScript contains no debug console output or game-state globals', async () => {
  const files = await javaScriptFiles('scripts');
  const violations = [];

  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8');
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, '');
    executableSource.split('\n').forEach((line, index) => {
      const code = line.trim();
      if (code.startsWith('//')) return;
      if (/console\.(?:log|debug|info)\s*\(/.test(code) || /window\.gameData/.test(code)) {
        violations.push(`${file}:${index + 1}`);
      }
    });
  }

  assert.deepEqual(violations, []);
});

test('public documentation contains no private-network addresses', async () => {
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  const privateAddress = /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})\b/;

  assert.doesNotMatch(readme, privateAddress);
});
