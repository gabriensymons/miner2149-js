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


function randomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default getDifficulty;
