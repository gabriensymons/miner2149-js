function hexStringToArrayBuffer(hexString) {

  // remove the leading 0x
  hexString = hexString.replace(/^0x/, '');

  // ensure even number of characters
  if (hexString.length % 2 != 0) {
      console.log('WARNING: expecting an even number of characters in the hexString');
  }

  // check for some non-hex characters
  var bad = hexString.match(/[G-Z\s]/i);
  if (bad) {
      console.log('WARNING: found non-hex characters', bad);
  }

  // split the string into pairs of octets
  var pairs = hexString.match(/[\dA-F]{2}/gi);

  // convert the octets to integers
  var integers = pairs.map(function(s) {
      return parseInt(s, 16);
  });

  var array = new Uint8ClampedArray(integers);
  return array;
}

// Create app
const app = new PIXI.Application({
  antialias: true,
  autoDensity: true,
  height: 640,
  width: 640,
  backgroundColor: 0x1099bb,
  resolution: devicePixelRatio,
});
document.body.appendChild(app.view);

// Install EventSystem, if not already
// // (PixiJS 6 doesn't add it by default)
// if (!('events' in app.renderer)) {
//     app.renderer.addSystem(PIXI.EventSystem, 'events');
// }
const infoWindow = new PIXI.Container();
infoWindow.zIndex = 1000;
infoWindow.width = app.screen.width;
infoWindow.height = app.screen.height;
const infog = new PIXI.Graphics()
  .beginFill(0xffffff)
  .drawRect(20, 20, app.screen.width-40, app.screen.height-40)
  .endFill();
  infoWindow.interactive = true;
  infoWindow.buttonMode = true;
infoWindow.addChild(infog);


const topBar = new PIXI.Container();
topBar.width = app.screen.width;
topBar.height = app.screen.height;
topBar.x = 0;
topBar.y = 0;
const g = new PIXI.Graphics()
  .beginFill(0x0000ff)
  .drawRect(0, 0, app.screen.width, 61)
  .endFill();

// Setup day text
let barText = new PIXI.TextStyle({
  fill: '#ffffff',
});
let day = 0;
let daysText = new PIXI.Text('Days: ' + day, barText);
daysText.x =  10;
daysText.y =  12;

// Setup credits text
let credits = 100;
let creditText = new PIXI.Text('Credit: ' + credits, barText);
creditText.x = 250;
creditText.y = 12;

// Setup info icon
let iconStyle = new PIXI.TextStyle({
  fontWeight: 'bold',
  fill: '#ffffff',
});
let infoIcon = new PIXI.Text('i', iconStyle);
infoIcon.x = app.screen.width - 30;
infoIcon.y = 12;

topBar.addChild(g);
topBar.addChild(daysText);
topBar.addChild(infoIcon);

topBar.addChild(creditText);
topBar.interactive = true;
topBar.buttonMode = true;
let modalOpen = false;
topBar.on('pointerdown', onTopBarClick);
app.stage.addChild(topBar);




function onTopBarClick() {
    console.log(infoWindow.width);
    console.log(infoWindow.height);
  if (modalOpen) {
      app.stage.removeChild(infoWindow);
      modalOpen = false;
  } else {
      app.stage.addChild(infoWindow);
      modalOpen = true;
  }
}

setInterval(() => {
  day+=1;
  daysText.text = 'Days: ' + day;
}, 500);
// const img = new ImageData(hexStringToArrayBuffer("310000000000000000000000000000000000000000000000000c00d76d9773b9eb00040603005e080001000013f100100190022d28048066004000095a8810575298200120820e080c00100840e000000200481c20000020050380000007ffffffc00001000007000000000080e0800"), 5, 30);
// Add a ticker callback to move the sprite back and forth
let elapsed = 0.0;


