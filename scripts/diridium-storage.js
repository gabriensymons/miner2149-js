function getDiridiumStorageState({ diridium, processorCount, storageCount }) {
  const capacity = (storageCount * 50000) + (processorCount * 500);
  const percentage = diridium === 0
    ? 0
    : Math.floor(100 * diridium / capacity);

  let fill = 'full';
  if (percentage < 33) fill = 'empty';
  else if (percentage < 66) fill = 'third';
  else if (percentage < 99) fill = 'twoThirds';

  return { capacity, fill, percentage };
}

export { getDiridiumStorageState };
