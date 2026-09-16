function random(radix, substringStart, subdtringEnd) {
  return Math.random().toString(radix).substring(substringStart, subdtringEnd).toUpperCase();
}

function randomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pocketRandom(max, rng = Math.random) {
  return Math.floor(rng() * max);
}

export {
  pocketRandom,
  random,
  randomNum
}
