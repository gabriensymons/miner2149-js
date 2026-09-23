import assert from 'node:assert/strict';
import test from 'node:test';

import { functionBody, requireFunctionBody } from './app-source.js';

const source = [
  'function first(a) {',
  '  return a + 1;',
  '}',
  '',
  'function second() {',
  '  const nested = () => {',
  '    return 2;',
  '  };',
  '  if (nested()) {',
  '    return 3;',
  '  }',
  '}',
  '',
  '// a comment between functions',
  'function third(',
  '  one,',
  '  two = 2,',
  ') {',
  '  return one + two;',
  '}',
  '',
  'async function fourth() {',
  '  await first(1);',
  '}',
].join('\n');

test('a function is sliced by its own braces', () => {
  assert.equal(functionBody(source, 'first'), '\n  return a + 1;');
});

test('the slice does not depend on which function comes next', () => {
  // The helper this replaced needed the successor named, and broke whenever a
  // phase moved it. Reordering must change nothing.
  const reordered = source.replace(/function first[\s\S]*?\n\}\n\n/, '') + '\n\nfunction first(a) {\n  return a + 1;\n}\n';

  assert.equal(functionBody(reordered, 'first'), functionBody(source, 'first'));
  assert.equal(functionBody(reordered, 'second'), functionBody(source, 'second'));
});

test('an indented closing brace inside the function does not end it', () => {
  const body = functionBody(source, 'second');

  assert.match(body, /const nested/);
  assert.match(body, /return 3;/, 'the slice runs past the nested closures');
  assert.doesNotMatch(body, /function third/, 'and stops at its own brace');
});

test('parameters spread over several lines are still found', () => {
  assert.equal(functionBody(source, 'third'), '\n  return one + two;');
});

test('an async function is found, and so is one that closes at end of file', () => {
  assert.equal(functionBody(source, 'fourth'), '\n  await first(1);');
});

test('a name that is only a prefix of another does not match it', () => {
  const prefixed = 'function checkEndingSoon() {\n  return 1;\n}\n\nfunction checkEnding() {\n  return 2;\n}\n';

  assert.equal(functionBody(prefixed, 'checkEnding'), '\n  return 2;');
});

// The failure the helper exists to remove. Slicing from indexOf(X) to
// indexOf(Y) runs to the end of the file when Y is gone, so an assertion meant
// for one function is checked against all of them and passes.
test('a missing function yields nothing, not the rest of the file', () => {
  assert.equal(functionBody(source, 'gone'), undefined);

  const oldStyle = source.slice(source.indexOf('function first'), source.indexOf('function gone'));
  assert.ok(oldStyle.length > source.length / 2, 'the form this replaced would have swallowed the file');
});

test('requiring a missing function fails the test and names it', () => {
  assert.throws(
    () => requireFunctionBody(source, 'gone'),
    /no top-level function gone\(\)/,
  );
  assert.equal(requireFunctionBody(source, 'first'), functionBody(source, 'first'));
});
