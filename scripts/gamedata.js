import { randomNum } from './random.js';

/*
All of this is setup in the Startup() function
int a,b,c,d,play,screen,aloop,restart;
int mday,tday,level,iloop,diff,x,y;
int one[100],two[100],three[101],dl[6];
int llevel,lloc,lobject,hiscore,asave;
string object[17],oname[17],hiname,m[6],version;
int ocost[17],ocount[17],phrase,gamename;
int worker,credits,morale,life,jobs,wage,lost,day,oscroll,smax;
int product,meff,eff,lworker,lmorale,lproduct,leff,ljobs,drate,sellprice;
int occ,food,health,crdflg,loadflg;
*/


/*
level=1;
oscroll=6;
occ=-1;
food=-1;
health=-1;
drate=0;
eff=100;
leff=100;
product=0;   // diridium, see 1456
morale=100;
lmorale=100;
worker=20;
lworker=20;
jobs=100;
ljobs=100;
wage=400;
life=100;
sellprice=random(10)+15;
*/

const gameDataInit = {
  asteroid: '', // Class:2
  autosaveEnabled: true,
  credits: 1000000, //253100, //1000000, // use .toString() when displaying as text
  creditFlag: 0,
  day: 0,
  deathRate: 0,
  difficulty: 0,
  diridium: 0,
  efficiency: 100,
  food: -1,
  gridlinesEnabled: false,
  health: -1,
  jobs: 100,
  jobsPrev: 100,
  level: 'level1',
  lifeSupport: 100,
  get miningEfficiency() {
    return 110 - (this.difficulty * 10);
  },
  morale: 100,
  moralePrev: 100,
  multiplier: 65,
  occupancy: -1,
  probes: '5',
  saveName: '', // Day:0 | Class:2 -OR- a custom string
  sellPrice: 19, //randomNum(0,10) + 15, // (gets overwritten when stats update)
  sellToday: true, // can only sell once per day (a 'run once' varible)
  shopBtn: 'Bulldozer',
  shopPrice: 6500,
  wage: 400,
  workers: 20,
  workersPrev: 20,
  maps: {
    level1: {
      row0: [2,2,2,2,2,2,2,2,2,2],
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2]
    },
    level2: {
      row0: [2,2,2,2,2,2,2,2,2,2],
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2]
    },
    level3: {
      row0: [2,2,2,2,2,2,2,2,2,2],
      row1: [2,2,2,2,2,2,2,2,2,2],
      row2: [2,2,2,2,2,2,2,2,2,2],
      row3: [2,2,2,2,2,2,2,2,2,2],
      row4: [2,2,2,2,2,2,2,2,2,2],
      row5: [2,2,2,2,2,2,2,2,2,2],
      row6: [2,2,2,2,2,2,2,2,2,2],
      row7: [2,2,2,2,2,2,2,2,2,2],
      row8: [2,2,2,2,2,2,2,2,2,2],
      row9: [2,2,2,2,2,2,2,2,2,2]
    }
  },
};

const currentMap = {};
const newMap = {};
const animatedMap = {};

const buildingMap = {
  1: 'None', // Clear Area  oname[1] see line 1009
  2: 'None', // Smooth Area oname[2]
  3: 'None', // Rough Area  oname[3]
  4: 'None', // Ore Vein    oname[4]
  5: 'Mother Ship',       // oname[0]
  6: 'Construction Site', // oname[5]
  7: 'Bulldozer',         // oname[6]
  8: 'Diridium Mine',     // oname[7]
  9: 'Hydroponics',       // oname[8]
  10: 'Tube',             // oname[9]
  11: 'Life Support',     // oname[10]
  12: 'Quarters',         // oname[11]
  13: 'Space Port',       // oname[12]
  14: 'Power Plant',      // oname[13]
  15: 'Processor',        // oname[14]
  16: 'Sickbay',          // oname[15]
  17: 'Storage',          // oname[16]
};

const constructionTimeMap = {
  // Add 100 for each day
  7: 107,   // Bulldozer 1 day
  8: 708,   // Diridium Mine 7 days
  9: 1009,  // Hydroponics 10 days
  10: 210,  // Tube 2 days
  11: 1011, // Life Support 10 days
  12: 912,  // Quarters 9 days
  13: 1013, // Space Port 10 days
  14: 1514, // Power Plant 15 days
  15: 1515, // Processor 15 days
  16: 1216, // Sickbay 12 days
  17: 917,  // Storage 9 days
};

const shopItems = {
  bulldozer: {
    name: 'Bulldozer',
    price: 100, // 100 * 65 = 6500
  },
  diridiumMine: {
    name: 'Diridium Mine',
    price: 700, // 700 * 65 = 45500
  },
  hydroponics: {
    name: 'Hydroponics',
    price: 1000,
  },
  tube: {
    name: 'Tube',
    price: 200,
  },
  lifeSupport: {
    name: 'Life Support',
    price: 1000,
  },
  quarters: {
    name: 'Quarters',
    price: 900,
  },
  spacePort: {
    name: 'Space Port',
    price: 1000,
  },
  powerPlant: {
    name: 'Power Plant',
    price: 1500,
  },
  processor: {
    name: 'Processor',
    price: 1500,
  },
  sickbay: {
    name: 'Sickbay',
    price: 1200,
  },
  storage: {
    name: 'Storage',
    price: 900,
  },
};

const undoData = {
  hasUndo: false,
  undoLevel: '',
  undoNum: 0,
  undoX: 0,
  undoY: 0,
  undoPrice: 0,
};

export {
  gameDataInit,
  shopItems,
  buildingMap,
  constructionTimeMap,
  undoData,
}