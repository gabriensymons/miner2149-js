/**
 * The site's Records section, as data: which board, and its rows as they are
 * shown. Pure, so the Records section's wording and numbering are tested in
 * Node; site-controls.js only puts these into the page.
 */

/** "Class 3", or "Class 3 · Disaster Mode". */
export function boardTitle({ category, difficulty }) {
  return `Class ${difficulty}${category === 'disaster' ? ' · Disaster Mode' : ''}`;
}

/**
 * A board's rows: its place, the name -- a dash for one entered under no
 * name -- the score with thousands separated, and whether it is the archive's.
 */
export function boardRows(board) {
  return board.map(({ score, name, seeded }, index) => ({
    place: index + 1,
    name: name || '—',
    score: score.toLocaleString('en-US'),
    archive: seeded,
  }));
}
