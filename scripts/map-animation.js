function createRowRevealStates(row) {
  const targetRow = row.map(value => Math.abs(value));
  const animatedRow = targetRow.map(value => -value);
  const states = [animatedRow.slice()];

  for (let tile = 0; tile < targetRow.length; tile += 1) {
    animatedRow[tile] = targetRow[tile];
    states.push(animatedRow.slice());
  }

  return states;
}

export {
  createRowRevealStates,
};
