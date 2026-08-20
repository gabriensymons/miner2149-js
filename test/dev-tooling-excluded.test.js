import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = new URL('../', import.meta.url);

async function exists(url) {
  try {
    await stat(url);
    return true;
  } catch {
    return false;
  }
}

async function collectJavaScript(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScript(new URL(`${entry.name}/`, directory)));
    } else if (entry.name.endsWith('.js')) {
      files.push(url);
    }
  }
  return files;
}

// The build is the thing under test, so run it rather than trusting whatever
// dist/ happens to hold. It builds into a scratch directory so this cannot race
// the other build test, which runs in parallel and owns dist/.
test('the production build contains no development tooling', async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'miner-build-'));
  t.after(() => rm(scratch, { force: true, recursive: true }));
  execFileSync('node', ['tools/build-static.js'], {
    cwd: repoRoot.pathname,
    stdio: 'pipe',
    env: { ...process.env, MINER_BUILD_OUT: scratch },
  });
  const distRoot = pathToFileURL(`${scratch}/`);

  assert.equal(
    await exists(new URL('scripts/dev/', distRoot)),
    false,
    'scripts/dev/ must not be copied into the production build',
  );

  const built = await collectJavaScript(new URL('scripts/', distRoot));
  assert.ok(built.length > 10, 'the build produced scripts to inspect');

  for (const file of built) {
    const source = await readFile(file, 'utf8');
    const name = file.pathname.split('/scripts/').at(-1);
    assert.doesNotMatch(source, /dev-only:(start|end)/,
      `${name} still contains a dev-only region marker`);
    assert.doesNotMatch(source, /installMeteorTrigger/,
      `${name} still references the developer trigger`);
    assert.doesNotMatch(source, /['"]\.\/dev\//,
      `${name} still imports from scripts/dev/`);
  }
});

test('the development trigger is present in source and strippable', async () => {
  const app = await readFile(new URL('scripts/app.js', repoRoot), 'utf8');

  // Guards against the region silently disappearing from source, which would
  // make the exclusion test above pass for the wrong reason.
  assert.match(app, /installMeteorTrigger/,
    'app.js should still install the trigger for local development');

  const starts = app.match(/\/\* dev-only:start \*\//g) ?? [];
  const ends = app.match(/\/\* dev-only:end \*\//g) ?? [];
  assert.ok(starts.length >= 1, 'at least one dev-only region exists');
  assert.equal(starts.length, ends.length, 'every dev-only region is closed');

  assert.equal(
    await exists(new URL('scripts/dev/meteor-trigger.js', repoRoot)),
    true,
    'the developer trigger module exists in source',
  );
});
