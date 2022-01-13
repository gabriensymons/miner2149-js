var specialKeys = [8, 32];
// 8 Backspace
// 9 Tab
// 46 Delete
// 32 Spacebar
// 35 End
// 36 Home
// 37 Left Arrow
// 39 Right Arrow

function IsAlphaNumeric(e) {
  var keyCode = e.keyCode == 0 ? e.charCode : e.keyCode;
  let bool =
    (keyCode >= 48 && keyCode <= 57) ||
    (keyCode >= 65 && keyCode <= 90) ||
    (keyCode >= 97 && keyCode <= 122) ||
    (specialKeys.indexOf(e.keyCode) != -1 && e.charCode != e.keyCode);
  return bool;
}

function addLetter(event, input, cursor) {
  // console.log(event.key);

  if (!IsAlphaNumeric(event)) return;

  if (event.key === 'Spacebar') {
    console.log('(Reminder to stop spacebar from scrolling screen)');
    event.key.stopPropagation();
  }

  if (event.key === 'Backspace') {
    input.text = input.text.substring(0, input.text.length - 1);
    // console.log(input.text);
    input.dirty = true;
    cursor.x = 6 + input.textWidth;
    return;
  }

  if (input.textWidth <= 75) {
    input.text += event.key;
    input.dirty = true;
    cursor.x = 6 + input.textWidth;
    // console.log('width:', input.textWidth);
  }
}

export {
  addLetter
}