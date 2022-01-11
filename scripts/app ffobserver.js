// import FontFaceObserver from '/node_modules/fontfaceobserver/fontfaceobserver.js';

// Create the font loader
let font = new FontFaceObserver('palm-os', {});
let fontBold = new FontFaceObserver('palm-os-bold', {});

// Start loading the font
font.load().then(() => {
  // Successful load, start up your PixiJS app as usual

  // Create app
  const app = new PIXI.Application({
    antialias: true,
    autoDensity: true,
    height: 160,
    width: 160,
    backgroundColor: 0x1099bb,
    resolution: devicePixelRatio
  });
  document.body.appendChild(app.view);

  const regular = new PIXI.TextStyle({
    fontFamily: "palm-os"
  });

  const bold = new PIXI.TextStyle({
    fontFamily: "palm-os-bold"
  });
  const text = new PIXI.Text('Hello World', bold);

  // Install EventSystem, if not already
  // (PixiJS 6 doesn't add it by default)
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
    .beginFill(0x000)
    .drawRect(0, 0, app.screen.width, 15)
    .endFill();

  // Setup day text
  let barText = new PIXI.TextStyle({
    fontFamily: 'palm-os-bold',
    fill: '#fff',
    fontSize: 7
  });
  let day = 0;
  let daysText = new PIXI.Text('Days: ' + day, barText);
  daysText.x =  2;
  daysText.y =  4;

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
      console.log(`infoWindow: ${infoWindow.width} x ${infoWindow.height}`);
    if (modalOpen) {
        app.stage.removeChild(infoWindow);
        modalOpen = false;
    } else {
        app.stage.addChild(infoWindow);
        modalOpen = true;
    }
  }

  // setInterval(() => {
    // day+=1;
    // daysText.text = 'Days: ' + day;
  // }, 500);


  // Add a ticker callback to move the sprite back and forth
  let elapsed = 0.0;

}, () => {
  // Failed load, log the error or display a message to the user
  alert('Unable to load required font!');
});
