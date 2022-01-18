import { buildMessageButton } from './button.js';
import { addLetter } from './input.js';

/*
Usage:
showMessage(
  ...messageArgs, // <- predefined message arguments
  startScreen,    // <- parent to disable interactivity
  'Welcome to the Mining Colony. Enjoy your stay!'  // <- Message or Input text
  callback1,
  callback2);
*/

function showMessage(app, messageTop, questionIcon, infoIcon, messageTitle, messageBottom, messageText, inputSubtitle, inputText, textureButton, textureButtonDown, underline, cursor, buttonText1, buttonText2, parent, mText, mCallback1, mCallback2, { b1text = 'OK', b2text = 'No', has2Buttons = false, isInput = false } = {}) {
  let buttonCallback1;
  let buttonCallback2;

  parent.interactiveChildren = false;

  // Default these to true
  messageText.visible = true;
  questionIcon.visible = true;
  infoIcon.visible = true;

  // Default these to false
  inputSubtitle.visible = false;
  inputText.visible = false;
  underline.visible = false;
  cursor.visible = false;



  // Message Title
  messageTitle.text = isInput ? 'Input' : has2Buttons ? 'Confirmation' : 'Message';
  messageTitle.dirty = true;

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

  // Setup Confirmation callback
  if (!isInput) {
    buttonCallback1 = function() {
      // console.log('buttonCallback1 fired!');
      mCallback1();
    }

    if (has2Buttons) {
      buttonCallback2 = function() {
        // console.log('buttonCallback2 fired!');
        mCallback2();
      }
    }
  }



  // Setup Input message
  function setupInput() {
    // console.log('Inside setupInput');

    let flashInterval;

    // Prefill the input field and move the cursor
    if (mText) {
      inputText.text = mText;
      cursor.x = 6 + inputText.textWidth;
    } else {
      inputText.text = '';
      cursor.x = 6;
    }

    // Toggle visiblities
    messageText.visible = false;
    questionIcon.visible = false;
    infoIcon.visible = false;
    inputSubtitle.visible = true;
    inputText.dirty = true;
    inputText.visible = true;
    underline.visible = true;
    cursor.visible = true;

    // Add children
    messageBottom.addChild(underline);
    messageBottom.addChild(cursor);
    messageBottom.addChild(inputText);


    const flashCursor = () => {
      // console.log('cursor.visible: ', cursor.visible); // Helpful to check for clearInterval()
      cursor.visible = cursor.visible ? false : true;
    }

    function startFlash() {
      if (!flashInterval)  flashInterval = setInterval(flashCursor, 500);
    }

    function stopFlash() {
      // console.log('Stop flash called.');
      clearInterval(flashInterval);
      flashInterval = null;
      cursor.visible = false;
    }

    startFlash();

    const inputHandler = function(event) {
      addLetter(event, inputText, cursor)
    }

    window.addEventListener('keydown', inputHandler);

    buttonCallback1 = function() {
      // console.log('Save the text to memory:', inputText.text);
      cleanup();
      mCallback1();
    }

    buttonCallback2 = function() {
      cleanup();
      mCallback2();
    }

    function cleanup() {
      stopFlash();
      window.removeEventListener('keydown', inputHandler);
    }

  }

  // Add Message top to stage
  app.stage.addChild(messageTop);
  // Add Message to stage
  app.stage.addChild(messageBottom);


  // Build buttons
  buildMessageButton(app, parent, messageTop, messageBottom, textureButton, textureButtonDown, buttonText1, b1text, false, buttonCallback1);

  if (has2Buttons)
    buildMessageButton(app, parent, messageTop, messageBottom, textureButton, textureButtonDown, buttonText2, b2text, true, buttonCallback2);
}


/*
Usage:
showConfirmation(
  ...messageArgs, // <- predefined message arguments
  startScreen,    // <- parent to disable interactivity
  'Do you want to bulldoze the Tube on this area?'); // <- Message text
*/

function showConfirmation (...args) {
  showMessage(...args, {b1text: 'Yes', b2text: 'No', has2Buttons: true});
}

function showInput(...args) {
  showMessage(...args, {b1text: 'OK', b2text: 'Cancel', has2Buttons: true, isInput: true});
}



export {
  showMessage,
  showConfirmation,
  showInput
}
