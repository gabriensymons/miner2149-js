/**
 * Reading `app.js` as text, for the suites that assert on its source.
 *
 * Not a test file: `npm test` runs `test/*.test.js` only, so this is imported,
 * never executed on its own.
 *
 * ## Why this exists
 *
 * Two suites used to isolate a function by naming the one after it. One matched
 * `function X ... \n}\n\n function Y` and so required X and Y to be adjacent,
 * in that order, a blank line apart; the other sliced from `indexOf(X)` to
 * `indexOf(Y)`. Both coupled an assertion about what a function *does* to where
 * it happens to *sit*, and every decomposition phase that moved a neighbour
 * broke them.
 *
 * The second form was also unsafe. If Y moved out of the file, `indexOf`
 * returned -1, the slice ran to the end of the file, and an assertion meant for
 * one function was checked against nearly all of them -- and passed.
 *
 * This slices a function by its own boundaries instead: from its header to the
 * closing brace in column 0. Top-level functions in `app.js` close there and
 * nothing nested does, because nested code is indented.
 */

/**
 * The body of the top-level function `name`, between its braces, or `undefined`
 * if the file has no such function. Never a neighbour's body, and never the rest
 * of the file.
 */
export function functionBody(source, name) {
  const header = new RegExp(`^(?:async )?function ${name}\\([^)]*\\) \\{`, 'm');
  const match = header.exec(source);
  if (!match) return undefined;

  const start = match.index + match[0].length;
  const end = source.indexOf('\n}\n', start);

  // The last function in a file can close at end of file, with no newline after.
  if (end < 0) {
    const last = source.lastIndexOf('\n}');
    return last > start ? source.slice(start, last) : undefined;
  }

  return source.slice(start, end);
}

/**
 * `functionBody`, but failing the calling test when the function is missing.
 *
 * Every suite wants this rather than a silent `undefined`: an assertion that
 * runs `assert.match(undefined, ...)` fails with an unhelpful message, and one
 * that runs `assert.doesNotMatch(undefined, ...)` can pass.
 */
export function requireFunctionBody(source, name) {
  const body = functionBody(source, name);
  if (body === undefined) {
    throw new Error(`app.js has no top-level function ${name}(); it has moved, been renamed, or been removed`);
  }
  return body;
}
