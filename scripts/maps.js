import pipe from './pipe.js';
import { randomNum } from './random.js';

/*
m[1]="Class 1-Easiest";
m[2]="Class 2-Smooth";
m[3]="Class 3-Few Mines";
m[4]="Class 4-Rocky";
m[5]="Class 5-Dangerous";
*/

const getDifficulty = () => {
  const num = randomNum(1,5);

  switch (num) {
    case 1:
      return 'Class 1-Easiest';
    case 2:
      return 'Class 2-Smooth';
    case 3:
      return 'Class 3-Few Mines';
    case 4:
      return 'Class 4-Rocky';
    case 5:
      return 'Class 5-Dangerous';
  }
}
/*
  Usage:
  fillMap(1) returns:
{
  row1: [1,1,1,1,1,1,1,1,1,1],
  row2: [1,1,1,1,1,1,1,1,1,1],
  row3: [1,1,1,1,1,1,1,1,1,1],
  row4: [1,1,1,1,1,1,1,1,1,1],
  row5: [1,1,1,1,1,1,1,1,1,1],
  row6: [1,1,1,1,1,1,1,1,1,1],
  row7: [1,1,1,1,1,1,1,1,1,1],
  row8: [1,1,1,1,1,1,1,1,1,1],
  row9: [1,1,1,1,1,1,1,1,1,1],
  row10: [1,1,1,1,1,1,1,1,1,1]
};
*/

function fillMap(num) {
  let map = {};

  // Add 10 rows
  for (let r=0; r<10; r++) {
    map[`row${r}`] = [];

    // Add 10 tiles
    for (let t=0; t<10; t++) {
      map[`row${r}`].push(num);
    }
  }

  return map;
}

function generateMaps(difficulty) {
  // Take into account difficulty: class of asteroid
  /*
  console.log(`>> Generating map for difficulty ${difficulty}! (coming soon)`);

  let newMaps = {
    level1: {
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2],
      row10: [2,2,2,2,2,2,2,2,2,2]
    },
    level2: {
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2],
      row10: [2,2,2,2,2,2,2,2,2,2]
    },
    level3: {
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2],
      row10: [2,2,2,2,2,2,2,2,2,2]
    }
  }
  */

  let newMaps = {};

  // Make every level full of smooth areas
  for (let l=1; l<4; l++) {
    newMaps[`level${l}`] = fillMap(2);
  }

  function addMotherShip(maps) {
    // console.log('Gabrien inside addMotherShip');

    // const coords = randomCoordinates();
    // Testing changing levels
    const coords = {x: 0, y: 0};
    // console.log('Gabrien mothership coords: ', coords);

    maps.level1[`row${coords.y}`][coords.x] = 5;
    // Testing changing levels
    maps.level2['row0'][1] = 5;
    maps.level3['row0'][2] = 5;

    // console.log(`level1 map:`, maps['level1']);
    // console.log(`level2 map:`, maps['level2']);
    // console.log(`level3 map:`, maps['level3']);

    return maps;
  }

  // Rough area is 3
  function addRoughAreas(maps) {

    // short circuit for testing
    // return maps;

    // console.log('inside addRoughAreas');

    // Add 0-3 plus difficulty rough areas per level
    for (let l=1; l<4; l++) {
      // console.log('Gabrien inside first for loop, l: ', l);
      // console.log(`level ${l} map:`, maps[`level${l}`]);
      // console.log(`level1 map:`, maps['level1']);
      // console.log(`level2 map:`, maps['level2']);
      // console.log(`level3 map:`, maps['level3']);

      let roughAreas = randomNum(0,3) + Number(difficulty) - 1;
      // console.log(`level: ${l}, difficulty: ${difficulty}, roughAreas: ${roughAreas}`);
      // console.log('Gabrien roughAreas: ', roughAreas);
      // console.log('Gabrien difficulty: ', difficulty);

      for (let r=0; r<roughAreas; r++) {
        // console.log('Gabrien inside second for loop, r: ', r);
        // console.log('Gabrien roughAreas: ', roughAreas);

        // if (r === 0) return;
        // Short circuit if no rough areas
        if (roughAreas === 0) return;

        let coords = findSmoothTile(maps[`level${l}`], l, maps);
        // console.log('Gabrien coords: ', coords);

        maps[`level${l}`][`row${coords.y}`][coords.x] = 3;
      }
    }
    // console.log('Gabrien maps: ', maps);

    return maps;
  }

  // Ore vein is 4
  function addOreVeins(maps) {

    return maps;
  }

  pipe(
    addMotherShip,
    addRoughAreas,
    addOreVeins
  )(newMaps);
  // newMaps = addMotherShip(newMaps);
  // newMaps = addRoughAreas(newMaps, difficulty);

  // console.log('generateMaps newMaps: ', newMaps);
  return newMaps;
}

let count = 0;
function findSmoothTile(level, l, maps, prevCoords = {}) {
  // count += 1;
  // console.log('---------------------');
  // console.log('inside findSmoothTile count:', count);
  // console.log('level is: ', level);
  // console.log('maps is: ', maps[`level${l}`]);
  // console.log('l is: ', l);
  // console.log('prevCoords: ', prevCoords);



  let coords = {};
  if (l === 1 && count === 1) {
    coords.x = 0;
    coords.y = 0;
  } else coords = randomCoordinates();
  // const coords = randomCoordinates();
  const location = level[`row${coords.y}`][coords.x];
  // check if space is unoccupied
  // console.log('coords: ', coords);
  // console.log('location: ', location);


  if (location === 2) {
    // console.log(`inside if: location ${location} === 2 ? ${location === 2}`);

    return coords;
  } else {
    // console.log(`inside else: location ${location} === 2 ? ${location === 2}`);

    // Assign return value of recursive call to update the value of 'coords'
    coords = findSmoothTile(level, l, maps, coords);
  }
  return coords;
}

function randomCoordinates() {
  const x = randomNum(0,9); // columns
  const y = randomNum(0,9); // rows
  return {x, y,};
}

export {
  fillMap,
  generateMaps,
  getDifficulty,
};
