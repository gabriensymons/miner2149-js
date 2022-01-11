// Zooms canvas while preserving pixel art
window.onload = () => {
  const slider = document.getElementById("zoom");
  const output = document.getElementById("zoom-output");
  // can I assign an id to the canvas from within pixie JS?
  const canvas = document.getElementsByTagName('canvas');

  // Check localStorage or use default
  let zoom = localStorage.getItem('minerZoom')
    ? JSON.parse(localStorage.getItem('minerZoom'))
    : 1;

  // console.log('Initial zoom:', zoom);
  // console.log('canvas:', canvas[0]);

  // Display the zoom value
  output.innerHTML = zoom;
  // Set slider position
  slider.value = zoom;
  // Assign zoom CSS variable - probably don't need this anymore
  // document.body.style.setProperty("--size", zoom * 50 + "px");
  // Resize canvas
  canvas[0].style.width = 110 + zoom * 50 + 'px';
  canvas[0].style.height = 110 + zoom * 50 + 'px';

  // Drag slider to update zoom level and resize image
  slider.addEventListener("input", function () {
    localStorage.minerZoom = this.value;
    output.innerHTML = this.value;
    // document.body.style.setProperty("--size", this.value * 50 + "px");
    canvas[0].style.width = 110 + this.value * 50 + 'px';
    canvas[0].style.height = 110 + this.value * 50 + 'px';
    // console.log('Listener zoom:', this.value);
    // console.log(`canvas: ${canvas[0].style.width} x ${canvas[0].style.height}`);
  });
}


