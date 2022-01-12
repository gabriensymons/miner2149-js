import { buildMessageButton } from './button.js';
import { addLetter } from './input.js';

/*
Usage:
showMessage(
  ...messageArgs, // <- predefined message arguments
  startScreen,    // <- parent to disable interactivity
  'Welcome to the Mining Colony. Enjoy your stay!'); // <- Message text
*/

function showMessage(app, messageTop, questionIcon, infoIcon, messageTitle, messageBottom, messageText, inputSubtitle, inputText, textureButton, textureButtonDown, underline, cursor, buttonText1, buttonText2, parent, mText, { b1text = 'OK', b2text = 'No', has2Buttons = false, isInput = false } = {}) {
  let buttonCallback;

  parent.interactiveChildren = false;

  // Add message top to stage
  app.stage.addChild(messageTop);

  // Message Title
  messageTitle.text = isInput ? 'Input' : has2Buttons ? 'Confirmation' : 'Message';

  // Determine message text
  if (!isInput) {
    messageText.text = mText;
    // Redraw the bitmap to update it's height info
    messageText.dirty = true;
  } else {
    setupInput();
  }

  // console.log('messageBottom.height: ', messageBottom.height );
  // console.log('messageText.textHeight: ', messageText.textHeight );
  // console.log('messageText.height: ', messageText.height );
  // console.log('messageText.maxLineHeight: ', messageText.maxLineHeight );
  // console.log('messageText.textWidth: ', messageText.textWidth );

  // Calculate Message height
  if (!isInput) {
    messageTop.y = app.stage.height - messageBottom.height - messageText.textHeight - 21;
  } else {
    messageTop.y = 78;
  }

  // Determine which icon shows
  if (!has2Buttons) messageTop.swapChildren(questionIcon, infoIcon);

  // Input message parts


  function setupInput() {
    let flashInterval;

    messageText.visible = false;
    inputSubtitle.visible = true;
    inputText.visible = true;
    questionIcon.visible = false;
    infoIcon.visible = false;
    underline.visible = true;
    cursor.visible = true;

    const flashCursor = () => {
      console.log('cursor.visible: ', cursor.visible);
      cursor.visible = cursor.visible ? false : true;
    }

    function startFlash() {
      if (!flashInterval)  flashInterval = setInterval(flashCursor, 500);
    }

    function stopFlash() {
      clearInterval(flashInterval);
      flashInterval = null;
      cursor.visible = false;
    }

    startFlash();

    window.addEventListener('keydown', (event) => addLetter(event, inputText, cursor));

    buttonCallback = function() {
      console.log('Save the text to memory');
      stopFlash();
    }

  }

  // Add Message to stage
  app.stage.addChild(messageBottom);


  // Build buttons
  buildMessageButton(app, parent, messageTop, messageBottom, textureButton, textureButtonDown, buttonText1, b1text, false, buttonCallback);

  if (has2Buttons)
    buildMessageButton(app, parent, messageTop, messageBottom, textureButton, textureButtonDown, buttonText2, b2text, true);
}


/*
Usage:
showConfirmation(
  ...messageArgs, // <- predefined message arguments
  startScreen,    // <- parent to disable interactivity
  'Do you want to bulldoze the Tube on this area?'); // <- Message text
*/

function showConfirmation (...args) {
  showMessage(...args, {b1text: 'Yes', has2Buttons: true});
}

function showInput(...args) {
  showMessage(...args, {isInput: true});
}



export {
  showMessage,
  showConfirmation,
  showInput
}
