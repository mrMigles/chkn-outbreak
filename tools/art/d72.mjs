// D72: hand-made pixel art for the feedback round — floor 7's «Уединение» (heart bed, posters, a rack of
// «office toys», fluffy cuffs, a pink lamp, the door button), floor 8's room 87 (potato beds, tomatoes, red grow
// lamps, a watering can, soil floor), floor 11's satisfaction form, street 1's sports cars (Skorpio's cars
// repainted) and the parking fence, street 2's beer crates, ashtray and the thrown bottle.
// Same palette and outline as city.mjs; drawn at native size and scaled ×2 (cars ×1.5).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'node:path';

const canvas = (w, h) => { const c = createCanvas(w, h); c.getContext('2d').imageSmoothingEnabled = false; return c; };
function cut(img, x, y, w, h, scale = 2) {
  const c = canvas(Math.round(w * scale), Math.round(h * scale)), g = c.getContext('2d');
  g.imageSmoothingEnabled = false; g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height); return c;
}
const up = (c, s = 2) => cut(c, 0, 0, c.width, c.height, s);
function draw(w, h, fn, s = 2) { const c = canvas(w, h); fn(c.getContext('2d'), w, h); return up(c, s); }
function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
function recolor(c, fn) {
  const out = canvas(c.width, c.height), g = out.getContext('2d'); g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3]) { const [r, gg, b] = fn(d.data[i], d.data[i + 1], d.data[i + 2]); d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; }
  g.putImageData(d, 0, 0); return out;
}
const repaint = (c, [tr, tg, tb]) => recolor(c, (r, g, b) => {
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (sat < 60 || r < 90 || b > r * 0.7) return [r, g, b];
  const l = (r + g) / 2 / 255; return [Math.min(255, tr * l * 1.15), Math.min(255, tg * l * 1.15), Math.min(255, tb * l * 1.15)];
});
function rng(seed) { let s = seed >>> 0 || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const O = '#2a2328';
/** Filled ellipse with an outline (native pixels). */
function oval(g, cx, cy, rx, ry, fill, outline = O) {
  for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
    const d = (x * x) / ((rx + 1) * (rx + 1)) + (y * y) / ((ry + 1) * (ry + 1));
    if (d > 1) continue;
    const inner = (x * x) / (rx * rx) + (y * y) / (ry * ry);
    rect(g, cx + x, cy + y, 1, 1, inner > 1 ? outline : fill);
  }
}

export async function buildD72(root, { add, floors }) {
  const cars = await loadImage(path.join(root, 'vendor/skorpio', 'Cars_final.png'));
  const carSide = (x, y, w, h) => cut(cars, x, y, w, h, 1.5);

  // ---------------------------------------------------------------- floor 7: «Уединение»
  add('heart_bed', draw(50, 34, (g) => {
    // a heart-shaped bed in red satin, two pink pillows, a leopard throw
    for (let y = 0; y < 30; y++) for (let x = 0; x < 50; x++) {
      const nx = (x - 25) / 23, ny = (y - 12) / 17;
      const v = (nx * nx + ny * ny - 1) ** 3 - nx * nx * (-ny) ** 3;
      if (v > 0.02) continue;
      rect(g, x, y, 1, 1, v > -0.02 ? O : y < 10 ? '#e04a5a' : y < 20 ? '#c43040' : '#9e2030');
    }
    oval(g, 16, 8, 6, 3, '#f7b7cf'); oval(g, 34, 8, 6, 3, '#f7b7cf');
    rect(g, 13, 7, 4, 1, '#ffe0ec'); rect(g, 31, 7, 4, 1, '#ffe0ec');
    for (let i = 0; i < 18; i++) rect(g, 15 + (i * 7) % 20, 15 + (i * 5) % 8, 2, 1, i % 3 ? '#d9a33a' : '#3a2a1e');
    rect(g, 6, 30, 38, 3, '#1f1a1e'); // shadow edge / frame
  }), 64, { foot: [100, 52] });
  add('kink_rack', draw(32, 30, (g) => {
    // a pegboard of «office toys»: coiled whip, riding crop, pink fluffy cuffs, a black mask
    rect(g, 0, 0, 32, 30, O); rect(g, 1, 1, 30, 28, '#5a3c46'); for (let y = 3; y < 28; y += 4) for (let x = 3; x < 30; x += 4) rect(g, x, y, 1, 1, '#3e2a32');
    for (let k = 0; k < 3; k++) oval(g, 7, 10 + k, 4 - k, 3 - k, '#1f1a1e', O); rect(g, 6, 4, 2, 4, '#1f1a1e'); rect(g, 6, 3, 2, 1, '#a8b0bf');
    rect(g, 14, 3, 1, 22, '#1f1a1e'); rect(g, 13, 3, 3, 2, '#d8442f'); rect(g, 13, 23, 3, 3, '#1f1a1e');
    oval(g, 21, 18, 3, 3, '#f7a8c8', '#c45a8a'); oval(g, 27, 18, 3, 3, '#f7a8c8', '#c45a8a'); rect(g, 23, 17, 3, 1, '#a8b0bf'); rect(g, 24, 4, 1, 11, '#a8b0bf');
    rect(g, 19, 5, 10, 5, O); rect(g, 20, 6, 8, 3, '#1f1a1e'); rect(g, 21, 7, 2, 1, '#e86a8a'); rect(g, 25, 7, 2, 1, '#e86a8a');
  }), 76, { wall: true });
  add('poster_kink', draw(24, 32, (g) => {
    // «50 оттенков серого кода»: fifty grey stripes and a silver tie
    rect(g, 0, 0, 24, 32, O);
    for (let y = 1; y < 31; y++) rect(g, 1, y, 22, 1, `rgb(${70 + y * 4},${72 + y * 4},${80 + y * 4})`);
    rect(g, 11, 6, 3, 2, '#dde3ea'); for (let y = 8; y < 22; y++) { const w = 1 + Math.min(3, (y - 8) >> 2); rect(g, 12 - (w >> 1), y, w + 1, 1, y % 3 ? '#a8b0bf' : '#dde3ea'); }
    rect(g, 3, 24, 18, 2, '#f3ecd6'); rect(g, 5, 27, 14, 1, '#f3ecd6'); rect(g, 3, 2, 6, 2, '#e8c64a'); rect(g, 10, 2, 2, 2, '#e8c64a');
  }), 74, { wall: true });
  add('poster_kink2', draw(22, 30, (g) => {
    // a pink poster: a big heart and «НЕ БЕСПОКОИТЬ» bars
    rect(g, 0, 0, 22, 30, O); rect(g, 1, 1, 20, 28, '#f29ac0');
    for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
      const nx = (x - 8) / 7, ny = (y - 6) / 7, v = (nx * nx + ny * ny - 1) ** 3 - nx * nx * (-ny) ** 3;
      if (v <= 0) rect(g, 3 + x, 4 + y, 1, 1, v > -0.03 ? '#9e2030' : '#d8304a');
    }
    rect(g, 3, 21, 16, 2, '#ffffff'); rect(g, 5, 24, 12, 2, '#ffffff');
  }), 72, { wall: true });
  add('fluffy_cuffs', draw(20, 9, (g) => { oval(g, 5, 4, 3, 3, '#f7a8c8', '#c45a8a'); oval(g, 14, 4, 3, 3, '#f7a8c8', '#c45a8a'); rect(g, 5, 4, 1, 1, '#2a2328'); rect(g, 14, 4, 1, 1, '#2a2328'); rect(g, 8, 3, 3, 1, '#a8b0bf'); }), 16, { foot: [30, 14] });
  add('disco_lamp', draw(12, 28, (g) => {
    rect(g, 3, 24, 6, 4, O); rect(g, 4, 25, 4, 2, '#5d5f6d');
    rect(g, 2, 2, 8, 22, O); rect(g, 3, 3, 6, 20, '#ff4fa8'); rect(g, 4, 5, 2, 4, '#ffd0e8'); rect(g, 5, 13, 2, 5, '#ffd0e8'); rect(g, 3, 3, 6, 1, '#ff9ccf');
  }), 54, { foot: [20, 14] });
  add('button_panel', draw(10, 20, (g) => {
    rect(g, 3, 6, 4, 14, O); rect(g, 4, 7, 2, 12, '#7f8597');
    rect(g, 0, 0, 10, 8, O); rect(g, 1, 1, 8, 6, '#a8b0bf'); oval(g, 5, 4, 2, 2, '#e04a3a'); rect(g, 4, 3, 1, 1, '#ff9a8a');
  }), 40, { foot: [16, 10] });

  // ---------------------------------------------------------------- floor 8: room 87
  add('potato_bed', draw(46, 22, (g) => {
    rect(g, 0, 8, 46, 14, O); rect(g, 1, 9, 44, 12, '#7a5236'); rect(g, 2, 10, 42, 10, '#4a3222');
    const r = rng(87);
    for (let i = 0; i < 30; i++) rect(g, 2 + r() * 42 | 0, 10 + r() * 10 | 0, 1, 1, r() < 0.5 ? '#5a3e2a' : '#3a2618');
    for (let k = 0; k < 6; k++) {
      const x = 4 + k * 7;
      rect(g, x + 1, 9, 1, 3, '#3f7a38'); // stem
      for (const [dx, dy] of [[-2, -1], [2, -1], [0, -3], [-1, 1], [2, 1]]) { rect(g, x + dx, 6 + dy, 3, 2, '#2a4a18'); rect(g, x + dx, 6 + dy, 2, 1, '#6aa857'); }
      rect(g, x, 3, 2, 1, k % 2 ? '#f3ecd6' : '#b88ad8'); // potato flowers
      rect(g, x - 1, 15, 3, 2, '#c8a060'); // a potato peeking out
    }
  }), 40, { foot: [88, 30] });
  add('tomato_plant', draw(14, 34, (g) => {
    rect(g, 6, 2, 2, 30, '#7a5236'); rect(g, 3, 28, 8, 6, O); rect(g, 4, 29, 6, 4, '#9c6c45');
    const r = rng(12);
    for (let i = 0; i < 16; i++) { const x = 2 + r() * 10 | 0, y = 3 + r() * 24 | 0; rect(g, x, y, 3, 2, '#2a4a18'); rect(g, x, y, 2, 1, '#4f8f45'); }
    for (const [x, y] of [[3, 8], [9, 12], [4, 17], [9, 21], [5, 24]]) { rect(g, x, y, 3, 3, '#7a1a14'); rect(g, x, y, 2, 2, '#d8302a'); rect(g, x, y, 1, 1, '#ff8a6a'); }
  }), 64, { foot: [26, 16] });
  add('grow_lamp', draw(16, 50, (g) => {
    rect(g, 4, 46, 8, 4, O); rect(g, 5, 47, 6, 2, '#5d5f6d'); rect(g, 7, 8, 2, 38, O);
    rect(g, 0, 2, 16, 7, O); rect(g, 1, 3, 14, 4, '#3d3a45');
    for (let x = 2; x < 14; x += 2) rect(g, x, 6, 1, 2, x % 4 ? '#ff2a5a' : '#8a3cff');
    rect(g, 1, 0, 14, 2, O);
  }), 98, { foot: [20, 18] });
  add('watering_can', draw(16, 11, (g) => { rect(g, 3, 3, 8, 8, O); rect(g, 4, 4, 6, 6, '#4f8f45'); rect(g, 4, 4, 6, 1, '#8fd16b'); rect(g, 10, 5, 5, 1, O); rect(g, 14, 3, 2, 2, O); rect(g, 4, 0, 6, 3, O); rect(g, 5, 1, 4, 1, '#3f7a38'); }), 22, { foot: [28, 14] });
  floors.push({ index: 515, canvas: up((() => { const c = canvas(32, 32), g = c.getContext('2d'); rect(g, 0, 0, 32, 32, '#2e2420'); const r = rng(515); for (let i = 0; i < 70; i++) rect(g, r() * 32 | 0, r() * 32 | 0, 1, 1, r() < 0.5 ? '#3a2e26' : '#241c18'); rect(g, 0, 0, 32, 1, '#221a16'); return c; })()) });

  // ---------------------------------------------------------------- floor 11: the satisfaction form (pickup)
  add('doc_form', draw(13, 16, (g) => {
    rect(g, 0, 0, 13, 16, O); rect(g, 1, 1, 11, 14, '#fffdf4'); rect(g, 1, 1, 11, 2, '#cf6f9f');
    for (let y = 5; y < 14; y += 3) { rect(g, 2, y, 2, 2, O); rect(g, 3, y, 1, 1, '#fffdf4'); rect(g, 5, y, 6, 1, '#7d8aa6'); }
    rect(g, 2, 8, 2, 1, '#d8302a'); rect(g, 3, 7, 1, 1, '#d8302a'); // a red tick
  }), 30);

  // ---------------------------------------------------------------- street 1: sports cars, the parking fence
  const coupe = carSide(12, 0, 169, 96), coupeL = carSide(203, 0, 169, 96), vert = carSide(0, 101, 96, 152);
  const stripes = (c, left) => { const g = c.getContext('2d'); for (const dy of [-6, 6]) { g.fillStyle = '#1f1a1e'; g.fillRect(left ? 40 : 30, c.height / 2 - 10 + dy, c.width - 70, 4); } return c; };
  const sport = stripes(repaint(coupe, [240, 196, 30]), false), sportL = stripes(repaint(coupeL, [240, 196, 30]), true);
  add('car_sport', sport, sport.height - 10, { foot: [230, 74] });
  add('car_sport_l', sportL, sportL.height - 10, { foot: [230, 74] });
  for (const [name, col] of [['black', [40, 40, 48]], ['yellow', [240, 196, 30]], ['lime', [150, 220, 40]]]) {
    const v = repaint(vert, col);
    add(`car_sport_${name}_v`, v, v.height - 8, { foot: [118, 196] });
  }
  add('fence_v', draw(12, 72, (g) => {
    // a chain-link panel seen edge-on along the lot's east side: posts, rails and the mesh
    for (const y of [0, 70]) { rect(g, 3, y, 6, 2, O); }
    rect(g, 4, 0, 4, 72, O); rect(g, 5, 1, 2, 70, '#8a8f99');
    for (let y = 2; y < 70; y += 4) { rect(g, 1, y, 10, 1, '#5d5f6d'); rect(g, 2 + (y % 8 ? 0 : 4), y + 1, 4, 1, '#a8b0bf'); }
    rect(g, 0, 34, 12, 3, O); rect(g, 1, 35, 10, 1, '#e8c64a');
  }), 140, { foot: [26, 128] });
  floors.push({ index: 516, canvas: up((() => {
    const c = canvas(32, 32), g = c.getContext('2d'); rect(g, 0, 0, 32, 32, '#4a5052'); const r = rng(516);
    for (let i = 0; i < 12; i++) rect(g, r() * 32 | 0, r() * 32 | 0, 1, 1, r() < 0.5 ? '#3e4446' : '#5a6163');
    rect(g, 0, 0, 2, 32, '#d9dcd6'); // a parking line
    for (let y = 10; y < 22; y++) for (let x = 10; x < 24; x++) if (((x - 17) ** 2) / 49 + ((y - 16) ** 2) / 25 < 1) rect(g, x, y, 1, 1, (x + y) % 3 ? '#2e3234' : '#353a3c'); // an oil stain
    return c;
  })()) });

  // ---------------------------------------------------------------- street 2: Толик's beer crates, ashtray, the bottle
  add('beer_crate', draw(20, 16, (g) => {
    rect(g, 0, 4, 20, 12, O); rect(g, 1, 5, 18, 10, '#c8781e'); rect(g, 1, 5, 18, 2, '#e8a04a'); rect(g, 7, 9, 6, 2, O);
    for (let x = 2; x < 18; x += 4) { rect(g, x, 0, 3, 6, O); rect(g, x + 1, 1, 1, 5, '#7a4a1a'); rect(g, x + 1, 0, 1, 1, '#e8c64a'); }
  }), 30, { foot: [40, 24] });
  add('ashtray', draw(12, 6, (g) => { oval(g, 6, 3, 5, 2, '#8a8f99'); rect(g, 3, 2, 4, 1, '#3a3a3a'); rect(g, 7, 1, 4, 1, '#f3ecd6'); rect(g, 10, 1, 1, 1, '#ff6a2a'); }), 12, { foot: [24, 12] });
  add('bottle', draw(6, 15, (g) => { rect(g, 2, 0, 2, 4, O); rect(g, 1, 4, 4, 11, O); rect(g, 2, 5, 2, 9, '#7a4a1a'); rect(g, 2, 8, 2, 3, '#e8c64a'); rect(g, 2, 5, 1, 2, '#c8884a'); rect(g, 2, 0, 2, 1, '#e8c64a'); }), 30);
}
