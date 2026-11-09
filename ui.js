/* Decorative wireframe-wave bands (hero + landing), drawn as stacked contour lines. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";

  function buildWave() {
    const W = 1200, H = 150, LINES = 16;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("class", "wave-svg");
    for (let l = 0; l < LINES; l++) {
      const y0 = 18 + l * 7.5;
      let d = "";
      for (let x = 0; x <= W; x += 20) {
        const a = Math.sin(x / 95 + l * 0.32) * (10 + l * 0.9);
        const b = Math.sin(x / 41 - l * 0.5) * 4;
        d += (x === 0 ? "M" : "L") + x + " " + (y0 + a + b).toFixed(1) + " ";
      }
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    return svg;
  }

  document.querySelectorAll(".wave-band").forEach((band) => band.appendChild(buildWave()));
})();
