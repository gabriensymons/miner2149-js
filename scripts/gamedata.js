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
const gameDataInit = {
  asteroid: '', // Class:2
  autosaveEnabled: true,
  credits: 1000000, // convert to string or it breaks
  day: 0,
  difficulty: 0,
  diridium: 0,
  gridlinesEnabled: false,
  level: 'level1',
  probes: '5',
  saveName: '', // Day:0 | Class:2 -OR- a custom string
  sellPrice: 12, // (need a price calculator)
  shopBtn: 'Bulldozer',
  shopPrice: 6500,
  multiplier: 65,
  wage: 400,
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
  }
};

/*
level=1;
oscroll=6;
occ=-1;
food=-1;
health=-1;
drate=0;
eff=100;
leff=100;
product=0;
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

const currentMap = {};
const newMap = {};
const animatedMap = {};

const buildingMap = {
  1: 'None', // Clear Area
  2: 'None', // Smooth Area
  3: 'None', // Rough Area
  4: 'None', // Ore Vein
  5: 'Mother Ship',
  6: 'Construction Site',
  7: 'Bulldozer',
  8: 'Diridium Mine',
  9: 'Hydroponics',
  10: 'Tube',
  11: 'Life Support',
  12: 'Quarters',
  13: 'Space Port',
  14: 'Power Plant',
  15: 'Processor',
  16: 'Sickbay',
  17: 'Storage',
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
    price: 100 // 100 * 65 = 6500
  },
  diridiumMine: {
    name: 'Diridium Mine',
    price: 700 // 700 * 65 = 45500
  },
  hydroponics: {
    name: 'Hydroponics',
    price: 1000
  },
  tube: {
    name: 'Tube',
    price: 200
  },
  lifeSupport: {
    name: 'Life Support',
    price: 1000
  },
  quarters: {
    name: 'Quarters',
    price: 900
  },
  spacePort: {
    name: 'Space Port',
    price: 1000
  },
  powerPlant: {
    name: 'Power Plant',
    price: 1500
  },
  processor: {
    name: 'Processor',
    price: 1500
  },
  sickbay: {
    name: 'Sickbay',
    price: 1200
  },
  storage: {
    name: 'Storage',
    price: 900
  }
};

const undoData = {};

export {
  gameDataInit,
  shopItems,
  buildingMap,
  constructionTimeMap,
  undoData
}