import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

import config from '../playwright.config.js';

// CI runs the browser suite as three jobs, one per project in
// playwright.config.js. Two ways that can quietly stop testing something: the
// workflow's matrix and the config's projects drift apart, so a project never
// runs on CI; or the projects' filters stop covering the suite between them, so
// a test runs nowhere -- or twice.

const root = new URL('../', import.meta.url);

test("the CI matrix runs exactly the config's browser projects", async () => {
  const workflow = await readFile(new URL('.github/workflows/ci.yml', root), 'utf8');
  const matrix = workflow.match(/^\s+project: \[([^\]]*)\]$/m);
  assert.ok(matrix, 'the workflow names its browser projects in a one-line matrix');

  const onCi = matrix[1].split(',').map((name) => name.trim());
  assert.deepEqual(onCi, config.projects.map(({ name }) => name));
  assert.match(workflow, /npm run test:smoke -- --project=\$\{\{ matrix\.project \}\}/,
    'and each job runs its own project');
});

test('every browser test belongs to exactly one project', async () => {
  // Playwright's own listing, which applies the projects' filters for real.
  // It needs no browser, so it runs wherever the Node suite does.
  const listing = JSON.parse(execFileSync(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', '--list', '--reporter=json'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ));
  const listed = [];
  (function walk(suite) {
    for (const spec of suite.specs ?? []) {
      for (const run of spec.tests) listed.push({ project: run.projectName, test: `${spec.file} > ${spec.title}` });
    }
    for (const child of suite.suites ?? []) walk(child);
  })(listing);

  // The universe, counted from the source rather than from the listing, so a
  // test that every project filters out is still counted. Every browser test is
  // a top-level `test(` call.
  const directory = new URL('test/browser/', root);
  let declared = 0;
  for (const file of (await readdir(directory)).filter((name) => name.endsWith('.spec.js'))) {
    declared += (await readFile(new URL(file, directory), 'utf8')).match(/^test\(/gm)?.length ?? 0;
  }
  assert.ok(declared > 0, 'the spec files were found and read');

  const names = listed.map(({ test: name }) => name);
  assert.equal(new Set(names).size, names.length, 'no test runs in two projects');
  assert.equal(listed.length, declared, 'and none runs in no project');
  for (const { name } of config.projects) {
    assert.ok(listed.some(({ project }) => project === name), `${name} runs something`);
  }
});
