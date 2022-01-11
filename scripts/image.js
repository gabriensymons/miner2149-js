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

// Trying to get hex image buffer to work
// const img = new ImageData(hexStringToArrayBuffer("310000000000000000000000000000000000000000000000000c00d76d9773b9eb00040603005e080001000013f100100190022d28048066004000095a8810575298200120820e080c00100840e000000200481c20000020050380000007ffffffc00001000007000000000080e0800"), 5, 30);
