function random(radix, substringStart, subdtringEnd) {
  return Math.random().toString(radix).substring(substringStart, subdtringEnd).toUpperCase();
}

function randomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export {
  random,
  randomNum
}
