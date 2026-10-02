// Props: cut from the Kenney tilesheet + new props drawn in the same style.
// Every prop is a sprite placed via a Tiled object layer.
import { createCanvas } from '@napi-rs/canvas';
import { art, PAL, shade, box, circle, ellipse, poly, line, radial, rng } from './lib.mjs';

const T = 64, COLS = 27;

/** Kenney tilesheet crops: [firstTile, wTiles, hTiles] (pixel trimmed later) */
export const KENNEY_PROPS = {
  crate: [128, 1, 1], crate_small: [129, 1, 1], crate_rot: [155, 1, 1], crate_small_rot: [156, 1, 1],
  barrel: [315, 1, 1], barrel_grey: [316, 1, 1], barrel_open: [317, 1, 1], oil: [319, 1, 1],
  plant: [133, 1, 1], plant_small: [209, 1, 1], bush: [182, 1, 1], tree: [180, 2, 2],
  sofa_green: [446, 3, 1], armchair_green: [449, 1, 1], chair_blue: [450, 1, 1], coffee_table: [451, 1, 1],
  sofa_orange: [473, 3, 1], armchair_orange: [476, 1, 1], armchair_orange2: [477, 1, 1], stool: [478, 1, 1],
  sofa_dark: [500, 3, 1], armchair_dark: [503, 1, 1], armchair_dark2: [504, 1, 1], table_round: [505, 1, 1],
  chair_0: [527, 1, 1], chair_1: [528, 1, 1], chair_2: [529, 1, 1], chair_3: [530, 1, 1],
  tv: [531, 2, 1], table_small: [533, 1, 1], lamp: [534, 1, 1], bin: [535, 1, 1], speaker: [536, 1, 1],
  counter_a: [293, 1, 1], counter_b: [294, 1, 1], stove: [295, 1, 1], hob: [296, 1, 1],
  counter_c: [320, 1, 1], counter_d: [321, 1, 1], sink: [322, 1, 1], hob_dark: [323, 1, 1],
  table_long: [452, 3, 1], table_wide: [455, 1, 1], table_end: [456, 1, 1],
  table_big: [348, 3, 3], ceiling_light: [131, 1, 1], note: [132, 1, 1],
  aquarium: [158, 2, 1], rock_0: [236, 1, 1], rock_1: [237, 1, 1],
  plates: [214, 1, 1], tub: [242, 1, 1],
};

function trim(c) {
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return c;
  const o = createCanvas(x1 - x0 + 1, y1 - y0 + 1);
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

export function cutKenney(sheet, [first, tw, th]) {
  const c = createCanvas(tw * T, th * T);
  const sx = (first % COLS) * T, sy = Math.floor(first / COLS) * T;
  c.getContext('2d').drawImage(sheet, sx, sy, tw * T, th * T, 0, 0, tw * T, th * T);
  return trim(c);
}

const MON = '#2b2f36', SCREEN = '#5fb6ff';

/** New props in Kenney style. Facing: "front" of desks is +Y (towards the camera bottom). */
export const NEW_PROPS = {
  // office desk with monitor, keyboard, mug & papers (2x1 tiles)
  desk: () => art(120, 60, (g) => {
    box(g, 2, 4, 116, 52, 4, '#d9a066', '#9b6a3a', 2);
    box(g, 6, 8, 108, 6, 2, '#e8b47c', null);
    deskStuff(g, 0);
  }),
  desk_b: () => art(120, 60, (g) => {
    box(g, 2, 4, 116, 52, 4, '#e7e2d6', '#a9a292', 2);
    box(g, 6, 8, 108, 6, 2, '#f4f0e7', null);
    deskStuff(g, 1);
  }),
  office_chair: () => art(36, 36, (g) => {
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; line(g, 18, 18, 18 + Math.cos(a) * 15, 18 + Math.sin(a) * 15, '#2a2a2a', 3); circle(g, 18 + Math.cos(a) * 15, 18 + Math.sin(a) * 15, 2.4, '#3a3a3a', '#1c1c1c', 1); }
    circle(g, 18, 18, 11, '#3d4a5c', '#232b36', 2);
    box(g, 6, 5, 6, 26, 3, '#2c3644', '#1a2029', 1.6); // backrest
  }),
  server_rack: () => art(60, 60, (g) => {
    box(g, 2, 2, 56, 56, 3, '#2d3138', '#16181c', 2);
    for (let i = 0; i < 6; i++) {
      box(g, 6, 7 + i * 8.4, 48, 6, 1, '#3c424b', '#1d2025', 1);
      for (let k = 0; k < 6; k++) line(g, 10 + k * 3, 8.5 + i * 8.4, 10 + k * 3, 11.5 + i * 8.4, '#20242a', 1);
    }
  }),
  water_cooler: () => art(34, 34, (g) => {
    box(g, 3, 3, 28, 28, 4, '#e9edf0', '#a7b0b8', 2);
    circle(g, 17, 17, 11, '#7cc4f2', '#3f86b8', 2);
    circle(g, 14, 14, 4, '#b8e2ff', null);
    circle(g, 17, 17, 3, '#3f86b8', null);
  }),
  printer: () => art(56, 44, (g) => {
    box(g, 2, 2, 52, 40, 4, '#d6d9dc', '#8f969c', 2);
    box(g, 6, 6, 44, 16, 2, '#b6bcc2', '#8f969c', 1.4);
    box(g, 10, 26, 30, 12, 1.5, '#ffffff', '#c3c3c3', 1.2);
    circle(g, 46, 32, 2.5, '#5fd35f', null);
    circle(g, 46, 38, 2, '#e0332f', null);
  }),
  cabinet: () => art(52, 40, (g) => {
    box(g, 2, 2, 48, 36, 3, '#8d9aa6', '#56616b', 2);
    for (const x of [6, 22, 38]) { box(g, x, 6, 12, 28, 1.5, '#a5b2bd', '#6b7782', 1.2); line(g, x + 3, 30, x + 9, 30, '#56616b', 2); }
  }),
  vending: () => art(64, 44, (g) => {
    box(g, 2, 2, 60, 40, 4, '#c0392b', '#7d2219', 2);
    box(g, 6, 6, 38, 32, 2, '#2b2f36', '#151719', 1.4);
    const r = rng(9);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) circle(g, 11 + x * 7, 13 + y * 9, 2.6, ['#ffd84a', '#5fb6ff', '#5fd35f', '#ff8a3d'][Math.floor(r() * 4)], null);
    box(g, 48, 8, 10, 14, 1.5, '#e9edf0', '#9aa', 1.2);
    box(g, 48, 26, 10, 6, 1, '#151719', null);
  }),
  whiteboard: () => art(120, 16, (g) => {
    box(g, 2, 2, 116, 12, 2, '#ffffff', '#9aa7b0', 2);
    line(g, 12, 7, 40, 7, '#2e86c1', 1.4); line(g, 48, 6, 80, 9, '#e0332f', 1.4); line(g, 86, 8, 108, 6, '#3fae6a', 1.4);
  }),
  poster: () => art(48, 14, (g) => {
    box(g, 2, 2, 44, 10, 1.5, '#ffd84a', '#b8941c', 1.6);
    box(g, 6, 4, 10, 6, 1, '#e86a17', null);
    line(g, 20, 5, 42, 5, '#8a6d10', 1.2); line(g, 20, 8.5, 36, 8.5, '#8a6d10', 1.2);
  }),
  poster_b: () => art(48, 14, (g) => {
    box(g, 2, 2, 44, 10, 1.5, '#5fb6ff', '#2e6a99', 1.6);
    circle(g, 11, 7, 3.5, '#ffffff', null);
    line(g, 20, 5, 42, 5, '#ffffff', 1.2); line(g, 20, 8.5, 34, 8.5, '#ffffff', 1.2);
  }),
  reception: () => art(180, 70, (g) => {
    g.beginPath(); g.moveTo(4, 8); g.lineTo(176, 8); g.lineTo(176, 66); g.lineTo(150, 66); g.lineTo(150, 30); g.lineTo(30, 30); g.lineTo(30, 66); g.lineTo(4, 66); g.closePath();
    g.fillStyle = '#e7e2d6'; g.fill(); g.strokeStyle = '#a9a292'; g.lineWidth = 2; g.stroke();
    box(g, 8, 11, 164, 5, 2, '#c48647', null);
    box(g, 70, 12, 26, 14, 2, MON, '#16181c', 1.5); box(g, 72, 14, 22, 9, 1, SCREEN, null);
    box(g, 106, 14, 18, 12, 1, '#ffffff', '#c3c3c3', 1);
    circle(g, 46, 18, 5, '#c0392b', '#7d2219', 1.4); // bell
  }),
  // lab
  lab_bench: () => art(120, 56, (g) => {
    box(g, 2, 2, 116, 52, 3, '#d9e3e6', '#8ea5aa', 2);
    box(g, 6, 6, 108, 44, 2, '#eef4f5', null);
    const r = rng(21);
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * 17 + r() * 4, y = 18 + r() * 18;
      const col = ['#5fd35f', '#5fb6ff', '#ff6bd6', '#ffd84a'][Math.floor(r() * 4)];
      circle(g, x, y, 5.5, 'rgba(255,255,255,0.8)', '#8ea5aa', 1.2);
      circle(g, x, y, 3.6, col, null);
    }
    box(g, 84, 10, 26, 16, 2, '#9fb3b8', '#64787d', 1.4); // microscope base
    circle(g, 97, 18, 4, '#2b2f36', null);
  }),
  egg_pod: () => art(64, 64, (g) => {
    circle(g, 32, 32, 29, '#9fb3b8', '#566b70', 2.5);
    circle(g, 32, 32, 23, 'rgba(160,255,170,0.55)', '#4c8f5a', 2);
    ellipse(g, 32, 33, 10, 13, '#fbf6e9', '#cfc6b2', 1.6);
    ellipse(g, 29, 28, 3, 4, '#ffffff', null);
    radial(g, 24, 22, 10, [[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  }),
  egg_pod_broken: () => art(64, 64, (g) => {
    circle(g, 32, 32, 29, '#9fb3b8', '#566b70', 2.5);
    circle(g, 32, 32, 23, '#2f3d36', '#4c8f5a', 2);
    poly(g, [[22, 30], [27, 24], [31, 31], [36, 23], [42, 30], [40, 42], [24, 42]], '#fbf6e9', '#cfc6b2', 1.6);
    circle(g, 32, 37, 4, '#ffd84a', null);
  }),
  lab_console: () => art(64, 40, (g) => {
    box(g, 2, 2, 60, 36, 3, '#55606b', '#2f363d', 2);
    box(g, 6, 6, 52, 14, 2, '#0e2a1f', '#1c3a2e', 1.2);
    line(g, 9, 13, 20, 13, '#5fd35f', 1.4); line(g, 22, 10, 30, 16, '#5fd35f', 1.4); line(g, 32, 13, 54, 13, '#5fd35f', 1.4);
    for (let i = 0; i < 6; i++) circle(g, 10 + i * 8.5, 29, 2.4, ['#e0332f', '#ffd84a', '#5fd35f'][i % 3], null);
  }),
  hazard_barrel: () => art(44, 44, (g) => {
    circle(g, 22, 22, 19, '#f2d03b', '#a88d17', 2.4);
    circle(g, 22, 22, 13, '#e8c22a', '#a88d17', 1.4);
    for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28 - 1.57; poly(g, [[22, 22], [22 + Math.cos(a - 0.45) * 11, 22 + Math.sin(a - 0.45) * 11], [22 + Math.cos(a + 0.45) * 11, 22 + Math.sin(a + 0.45) * 11]], '#2b2b2b', null); }
    circle(g, 22, 22, 3.2, '#f2d03b', '#2b2b2b', 1.4);
  }),
  // industrial
  machine: () => art(120, 120, (g) => {
    box(g, 4, 4, 112, 112, 6, '#7d8790', '#4b535a', 2.5);
    box(g, 12, 12, 96, 96, 4, '#6a737b', '#4b535a', 1.6);
    circle(g, 60, 60, 30, '#5a636b', '#3a4147', 2);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; line(g, 60, 60, 60 + Math.cos(a) * 26, 60 + Math.sin(a) * 26, '#3a4147', 3); }
    circle(g, 60, 60, 8, '#e86a17', '#a64a0f', 2);
    for (const [x, y] of [[18, 18], [102, 18], [18, 102], [102, 102]]) circle(g, x, y, 3, '#3a4147', null);
    stripes(g, 12, 100, 96, 8);
  }),
  generator: () => art(110, 64, (g) => {
    box(g, 3, 3, 104, 58, 5, '#e86a17', '#a64a0f', 2.4);
    box(g, 10, 10, 50, 44, 3, '#c95a12', '#a64a0f', 1.4);
    for (let i = 0; i < 6; i++) line(g, 15, 15 + i * 7, 55, 15 + i * 7, '#a64a0f', 2);
    circle(g, 84, 32, 16, '#565656', '#2f2f2f', 2);
    circle(g, 84, 32, 6, '#3a3a3a', null);
  }),
  conveyor: () => art(64, 56, (g) => {
    box(g, 0, 2, 64, 52, 2, '#55606b', '#2f363d', 2);
    box(g, 0, 8, 64, 40, 1, '#2f343a', null);
    for (let x = 4; x < 64; x += 10) line(g, x, 9, x, 47, '#454c54', 3);
  }),
  pallet: () => art(60, 60, (g) => {
    box(g, 2, 2, 56, 56, 2, '#b58552', '#7a5530', 2);
    for (const y of [10, 27, 44]) box(g, 4, y, 52, 8, 1, '#c99a66', '#7a5530', 1);
  }),
  pipe_h: () => art(64, 24, (g) => {
    box(g, -4, 4, 72, 16, 7, '#8a959e', '#525b62', 2);
    box(g, -4, 7, 72, 4, 2, '#b3bdc5', null);
  }),
  shelf: () => art(124, 44, (g) => {
    box(g, 2, 2, 120, 40, 2, '#3e6d9c', '#24476a', 2);
    const r = rng(33);
    for (let i = 0; i < 6; i++) box(g, 6 + i * 19.5, 6 + r() * 4, 16, 28 - r() * 6, 1.5, ['#c99a66', '#b58552', '#d9b07c'][i % 3], '#7a5530', 1.2);
  }),
  forklift: () => art(70, 110, (g) => {
    box(g, 22, 0, 6, 30, 1, '#565656', '#2f2f2f', 1.2); box(g, 42, 0, 6, 30, 1, '#565656', '#2f2f2f', 1.2);
    box(g, 14, 26, 42, 8, 2, '#3a3a3a', null);
    box(g, 6, 32, 58, 72, 8, '#f2b134', '#b97d17', 2.4);
    box(g, 14, 44, 42, 34, 5, '#2b2f36', '#16181c', 1.6);
    circle(g, 35, 64, 8, '#3d4a5c', '#232b36', 1.6);
    for (const [x, y] of [[4, 44], [66, 44], [4, 92], [66, 92]]) box(g, x - 4, y - 8, 8, 16, 2, '#2b2b2b', null);
  }),
  // doors (closed slabs); open state = hidden/slid sprite
  door_office: () => doorSlab('#c48647', '#956536'),
  door_lab: () => doorSlab('#a6c9cb', '#648587', true),
  door_industrial: () => doorSlab('#e86a17', '#a64a0f', true),
  door_locked: () => doorSlab('#c0392b', '#7d2219', true),
  terminal: () => art(28, 28, (g) => {
    box(g, 2, 2, 24, 24, 3, '#3a3f45', '#1d2023', 2);
    box(g, 6, 6, 16, 10, 1.5, '#5fd35f', null);
    circle(g, 14, 21, 2.4, '#e0332f', null);
  }),
  elevator: () => art(128, 128, (g) => {
    box(g, 2, 2, 124, 124, 4, '#6a737b', '#3a4147', 3);
    box(g, 10, 10, 108, 108, 3, '#8a959e', '#525b62', 2);
    line(g, 64, 10, 64, 118, '#3a4147', 3);
    for (const [x, y] of [[22, 22], [106, 22], [22, 106], [106, 106]]) circle(g, x, y, 3, '#525b62', null);
    stripes(g, 10, 2, 108, 8);
  }),
  sign_exit: () => art(56, 22, (g) => {
    box(g, 2, 2, 52, 18, 3, '#2ecc71', '#1a7a43', 2);
    poly(g, [[38, 7], [48, 11], [38, 15]], '#ffffff', null);
    line(g, 8, 11, 36, 11, '#ffffff', 3);
  }),
  // light fixtures for the dark lab (emitters are added in-game)
  emergency_light: () => art(24, 24, (g) => { circle(g, 12, 12, 9, '#e0332f', '#7d2219', 2); circle(g, 10, 10, 3, '#ff9a8f', null); }),
  blood_trail: () => art(64, 30, (g) => {
    const r = rng(41); g.fillStyle = '#8d1216';
    for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(4 + i * 4.3, 15 + (r() - 0.5) * 8, 5 + r() * 3, 3 + r() * 3, 0, 0, 6.28); g.fill(); }
  }),
  feather_pile: () => art(48, 40, (g) => {
    const r = rng(3);
    for (let i = 0; i < 14; i++) { const x = 8 + r() * 32, y = 8 + r() * 24, a = r() * 6.28; g.save(); g.translate(x, y); g.rotate(a); ellipse(g, 0, 0, 7, 2.8, '#ffffff', '#c9c0aa', 1); g.restore(); }
  }),
};

function deskStuff(g, v) {
  // monitor (top-down: thin wide slab with a stand) facing the chair (+Y)
  box(g, 34, 14, 46, 8, 2, MON, '#16181c', 1.6);
  box(g, 50, 21, 14, 6, 1.5, '#3a3f45', null);
  box(g, 36, 30, 40, 11, 2, '#e9edf0', '#9aa7b0', 1.4); // keyboard
  for (let i = 0; i < 3; i++) line(g, 39, 33.5 + i * 3, 73, 33.5 + i * 3, '#b9c3cc', 1);
  box(g, 82, 32, 8, 11, 3, '#e9edf0', '#9aa7b0', 1.2); // mouse
  circle(g, 18, 22, 6, v ? '#c0392b' : '#2e86c1', v ? '#7d2219' : '#1b5a85', 1.6); // mug
  circle(g, 18, 22, 3.4, '#6b3e1f', null);
  g.save(); g.translate(100, 22); g.rotate(v ? 0.3 : -0.2); box(g, -8, -10, 16, 20, 1, '#ffffff', '#c3c3c3', 1); line(g, -5, -5, 5, -5, '#9ab', 1); line(g, -5, -1, 3, -1, '#9ab', 1); g.restore();
}

function doorSlab(c, d, metal) {
  return art(64, 16, (g) => {
    box(g, 1, 2, 62, 12, 2, c, d, 2);
    if (metal) { stripes(g, 4, 5, 56, 6, '#2b2b2b', c); }
    else { line(g, 32, 4, 32, 12, d, 1.6); circle(g, 26, 8, 1.6, '#ffd84a', null); circle(g, 38, 8, 1.6, '#ffd84a', null); }
  });
}

function stripes(g, x, y, w, h, a = '#2b2b2b', b = '#ffd84a') {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = b; g.fillRect(x, y, w, h);
  g.fillStyle = a;
  for (let i = -h; i < w + h; i += h * 1.6) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h * 0.8, y + h); g.lineTo(x + i + h * 1.6, y); g.lineTo(x + i + h * 0.8, y); g.closePath(); g.fill(); }
  g.restore();
}
