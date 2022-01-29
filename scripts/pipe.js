// export default pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

// same as above, with explanatory names
export default (...functions) =>
  (value) =>
    functions
      .reduce((currentValue, currentFunction) =>
        currentFunction(currentValue), value);

// Example usage
/*

pipe(
  function1,
  function2,
  function3, // etc.
)(myObject);

*/
