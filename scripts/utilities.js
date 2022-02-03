
/*
  Clones an object and its nested levels

  Usage:
  const newObj = deepClone(obj);
*/
const deepClone = obj => JSON.parse(JSON.stringify(obj));

export {
  deepClone
};