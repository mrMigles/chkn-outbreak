// D69: art for chapter 1's new floors (8: dark office, 11: executives, 12: cafe) and chapter 2 (the city).
// Sources: Skorpio's Sprite Pack (cars, street asphalt, glass facade, street lamp, trash can; CC-BY-SA 3.0 / GPL 3),
// [LPC] Trees by bluecarrot16 et al. (CC-BY-SA 3.0, vendor/lpc-trees/CREDITS-trees.txt), LPC office/structure
// sheets (fountain, rotary phones, bar stools, paintings, fence, brick, carpets; see docs/ASSETS.md) and small
// hand-made pixel pieces in the same palette (helicopter, kiosk, stall, bench, breaker, food, cone...).
// Everything is drawn at native pixel size and scaled ×2 (cars ×1.5) with nearest-neighbour, like lpc.mjs.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'node:path';

const canvas = (w, h) => { const c = createCanvas(w, h); c.getContext('2d').imageSmoothingEnabled = false; return c; };
function cut(img, x, y, w, h, scale = 2) {
  const c = canvas(Math.round(w * scale), Math.round(h * scale)), g = c.getContext('2d');
  g.imageSmoothingEnabled = false; g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height); return c;
}
const up = (c, s = 2) => cut(c, 0, 0, c.width, c.height, s);
/** Native-size drawing: fn(g, w, h) then ×2. */
function draw(w, h, fn, s = 2) { const c = canvas(w, h); fn(c.getContext('2d'), w, h); return up(c, s); }
function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
function recolor(c, fn) {
  const out = canvas(c.width, c.height), g = out.getContext('2d'); g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3]) { const [r, gg, b] = fn(d.data[i], d.data[i + 1], d.data[i + 2]); d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; }
  g.putImageData(d, 0, 0); return out;
}
/** Recolour the saturated yellow paint of Skorpio's taxi, keep glass/tyres/chrome. */
const repaint = (c, [tr, tg, tb]) => recolor(c, (r, g, b) => {
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (sat < 60 || r < 90 || b > r * 0.7) return [r, g, b];
  const l = (r + g) / 2 / 255; return [tr * l, tg * l, tb * l];
});
/** Deterministic noise for textured floors. */
function rng(seed) { let s = seed >>> 0 || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export async function buildCity(root, { add, floors, props }) {
  const sk = (p) => loadImage(path.join(root, 'vendor/skorpio', p));
  const lpc = (p) => loadImage(path.join(root, 'vendor/lpc-office', p));
  const cars = await sk('Cars_final.png'), street = await sk('Street.png'), building = await sk('Building.png');
  const lamp = await sk('Lamp_alternative.png'), trash = await sk('Trashcan.png'), sidewalk = await sk('Sidewalk_dark.png');
  const trees = await loadImage(path.join(root, 'vendor/lpc-trees/trees-green.png'));
  const fountain = await lpc('structure/Structure/Misc/Fountain A.png');
  const phones = await lpc('source/Rotary Phones.png');
  const stools = await lpc('objects/Objects/Furniture/Bar Stools.png');
  const paintings = await lpc('objects/Objects/Decoration/Paintings.png');
  const fence = await lpc('structure/Structure/Fences/Plain Fence A.png');
  const brick = await lpc('structure/Structure/Walls/Brick Wall A.png');
  const flowers = await lpc('objects/Objects/Decoration/Flowers.png');
  const cart = await lpc('source/Shopping Cart.png');
  const panel = await lpc('structure/Structure/Walls/Half-Wall Paneling A.png');
  const carpetB = await lpc('structure/Structure/Floor/Geometric Carpet B.png');
  const diamondB = await lpc('structure/Structure/Floor/Diamond Tile B.png');
  const cup = await lpc('source/Coffee Cup.png');

  // ---------------------------------------------------------------- cars (Skorpio, ×1.5): side views and nose-down/up
  // foot = collision footprint [w, h] in world units (the body on the ground), feetY = image row standing on it.
  const carSide = (x, y, w, h) => cut(cars, x, y, w, h, 1.5);
  const variants = { taxi: null, red: [196, 52, 44], blue: [52, 96, 170], white: [215, 215, 210], green: [70, 130, 70] };
  for (const [name, col] of Object.entries(variants)) {
    const paintC = (c) => (col ? repaint(c, col) : c);
    const h = paintC(carSide(12, 0, 169, 96)), hl = paintC(carSide(203, 0, 169, 96));
    add(`car_${name}`, h, h.height - 10, { foot: [230, 74] });
    add(`car_${name}_l`, hl, hl.height - 10, { foot: [230, 74] });
    const v = paintC(carSide(0, 101, 96, 152));
    add(`car_${name}_v`, v, v.height - 8, { foot: [118, 196] });
  }
  const sedan = carSide(6, 259, 181, 90), sedanL = carSide(198, 259, 181, 90), sedanV = carSide(196, 110, 88, 137);
  add('car_grey', sedan, sedan.height - 10, { foot: [244, 70] });
  add('car_grey_l', sedanL, sedanL.height - 10, { foot: [244, 70] });
  add('car_grey_v', sedanV, sedanV.height - 8, { foot: [112, 178] });
  // a burnt-out wreck: the sedan charred, windows dark
  const burnt = recolor(sedan, (r, g, b) => { const l = (r + g + b) / 3; return [l * 0.45 + 18, l * 0.38 + 10, l * 0.33 + 8]; });
  add('car_burnt', burnt, burnt.height - 10, { foot: [244, 70] });

  // ---------------------------------------------------------------- trees and bushes ([LPC] Trees)
  const tree = (x, y, w, h, foot) => { const c = cut(trees, x, y, w, h); return { c, foot }; };
  for (const [name, [x, y, w, h], foot, feet] of [
    ['tree_round', [129, 352, 94, 137], [44, 28], 18], ['tree_oak', [556, 356, 104, 138], [48, 28], 16],
    ['tree_pine', [64, 356, 63, 149], [36, 24], 14], ['tree_big', [418, 352, 125, 151], [60, 30], 20],
  ]) { const t = tree(x, y, w, h, foot); add(name, t.c, t.c.height - feet, { foot: t.foot }); }
  { const c = cut(trees, 224, 368, 94, 80, 1.5); add('hedge', c, c.height - 10, { foot: [118, 40] }); }

  // ---------------------------------------------------------------- street furniture
  add('street_lamp', cut(lamp, 2, 0, 28, 91), 178, { foot: [18, 18] });
  add('trash_can', cut(trash, 19, 31, 20, 28), 52, { foot: [32, 20] });
  add('fountain', cut(fountain, 0, 0, 64, 80), 150, { foot: [116, 62] });
  add('shopping_cart', cut(cart, 1, 1, 30, 30), 56, { foot: [44, 24] });
  add('fence', cut(fence, 11, 97, 74, 31), 58, { foot: [148, 16] });
  for (let i = 0; i < 3; i++) add('flowers_' + i, cut(flowers, [7, 103, 199][i], 34, 19, 15), 28, { foot: [32, 12] });
  add('bench', draw(56, 26, (g) => {
    rect(g, 2, 2, 52, 4, '#2a2328'); rect(g, 3, 3, 50, 2, '#9c6c45'); rect(g, 2, 8, 52, 4, '#2a2328'); rect(g, 3, 9, 50, 2, '#c3925e');
    rect(g, 1, 13, 54, 6, '#2a2328'); rect(g, 2, 14, 52, 3, '#c3925e'); rect(g, 2, 17, 52, 1, '#7a5236');
    for (const x of [5, 48]) { rect(g, x, 12, 3, 13, '#2a2328'); rect(g, x + 1, 13, 1, 11, '#5d5f6d'); }
  }), 48, { foot: [100, 20] });
  add('cone', draw(14, 18, (g) => {
    rect(g, 1, 15, 12, 3, '#2a2328'); rect(g, 2, 15, 10, 2, '#d8442f');
    for (let y = 1; y < 15; y++) { const w = 2 + Math.floor(y * 0.55); rect(g, 7 - w, y, w * 2, 1, y === 6 || y === 7 || y === 11 ? '#f3ecd6' : '#ef6a2f'); }
  }), 34, { foot: [20, 14] });
  add('hydrant', draw(14, 20, (g) => {
    rect(g, 3, 2, 8, 17, '#2a2328'); rect(g, 4, 3, 6, 15, '#d8442f'); rect(g, 5, 4, 2, 13, '#ef7a5f'); rect(g, 1, 8, 12, 3, '#2a2328'); rect(g, 2, 9, 10, 1, '#9e2b25'); rect(g, 4, 0, 6, 3, '#9e2b25');
  }), 38, { foot: [22, 16] });

  // ---------------------------------------------------------------- shawarma kiosk, market stall, bus stop, billboard
  const awning = (g, x, y, w, h, a, b) => { for (let i = 0; i < w; i += 6) rect(g, x + i, y, Math.min(6, w - i), h, (i / 6) % 2 ? a : b); rect(g, x, y + h, w, 1, '#2a2328'); for (let i = 0; i < w; i += 6) rect(g, x + i + 1, y + h + 1, 4, 2, (i / 6) % 2 ? a : b); };
  add('kiosk', draw(80, 76, (g) => {
    rect(g, 2, 14, 76, 60, '#2a2328'); rect(g, 3, 15, 74, 58, '#e8dcc4');
    rect(g, 6, 22, 68, 26, '#2a2328'); rect(g, 7, 23, 66, 24, '#7fd2e8'); rect(g, 8, 24, 30, 2, '#dde3ea');
    // a spit of meat behind the glass (definitely not chicken)
    rect(g, 50, 24, 8, 22, '#2a2328'); rect(g, 51, 25, 6, 20, '#b8652e'); rect(g, 52, 26, 2, 18, '#e09050');
    rect(g, 0, 48, 80, 6, '#2a2328'); rect(g, 1, 49, 78, 4, '#9c6c45'); rect(g, 1, 49, 78, 1, '#c3925e');
    rect(g, 3, 54, 74, 19, '#c43c30'); rect(g, 3, 54, 74, 1, '#e86a50');
    awning(g, 0, 2, 80, 10, '#d8442f', '#f3ecd6'); rect(g, 0, 0, 80, 2, '#2a2328');
  }), 146, { foot: [150, 56] });
  add('stall', draw(88, 66, (g) => {
    for (const x of [3, 82]) rect(g, x, 12, 3, 52, '#2a2328');
    rect(g, 0, 36, 88, 28, '#2a2328'); rect(g, 1, 37, 86, 26, '#9c6c45'); rect(g, 1, 37, 86, 2, '#c3925e');
    // crates of eggs, cabbages, carrots
    const crate = (x, fill) => { rect(g, x, 26, 22, 12, '#2a2328'); rect(g, x + 1, 27, 20, 10, '#7a5236'); for (let i = 0; i < 6; i++) rect(g, x + 2 + i * 3, 25 + (i % 2), 3, 3, fill[i % fill.length]); };
    crate(6, ['#f3ecd6', '#e0c590']); crate(33, ['#4f8f45', '#8fd16b']); crate(60, ['#ef6a2f', '#f6d77c']);
    awning(g, 0, 2, 88, 9, '#3c7f9a', '#f3ecd6'); rect(g, 0, 0, 88, 2, '#2a2328');
  }), 124, { foot: [170, 52] });
  add('bus_stop', draw(96, 70, (g) => {
    rect(g, 0, 0, 96, 6, '#2a2328'); rect(g, 1, 1, 94, 4, '#5d5f6d'); rect(g, 1, 1, 94, 1, '#a8b0bf');
    for (const x of [2, 92]) rect(g, x, 6, 3, 62, '#2a2328');
    rect(g, 6, 8, 84, 40, '#2a2328'); rect(g, 7, 9, 82, 38, '#7fd2e8'); rect(g, 8, 10, 40, 2, '#dde3ea');
    rect(g, 10, 50, 76, 6, '#2a2328'); rect(g, 11, 51, 74, 3, '#7a5236');
    rect(g, 70, 12, 14, 16, '#2a2328'); rect(g, 71, 13, 12, 14, '#e8b84a');
  }), 132, { foot: [180, 30] });
  add('billboard', draw(96, 60, (g) => {
    for (const x of [18, 74]) rect(g, x, 40, 4, 20, '#2a2328');
    rect(g, 0, 0, 96, 42, '#2a2328'); rect(g, 2, 2, 92, 38, '#f6d77c'); rect(g, 2, 2, 92, 3, '#fff3c0');
    // a happy cartoon chicken (the brand) and red stripe
    rect(g, 2, 30, 92, 10, '#d8442f');
    rect(g, 8, 8, 18, 18, '#2a2328'); rect(g, 9, 9, 16, 16, '#f3ecd6'); rect(g, 12, 5, 6, 4, '#d8442f'); rect(g, 22, 14, 6, 3, '#e8b84a'); rect(g, 18, 12, 2, 2, '#2a2328');
  }), 112, { foot: [150, 16] });

  // ---------------------------------------------------------------- helicopter: cutscene side view and the wreck
  const heli = (g, wreck) => {
    const body = wreck ? '#4a4f45' : '#c43c30', hi = wreck ? '#62685c' : '#ef6a50', dark = wreck ? '#2c302a' : '#9e2b25';
    rect(g, 70, 26, 70, 6, '#2a2328'); rect(g, 70, 27, 70, 3, dark); // tail boom
    rect(g, 134, 16, 8, 16, '#2a2328'); rect(g, 135, 17, 6, 14, body); // fin
    rect(g, 18, 18, 64, 30, '#2a2328'); rect(g, 19, 19, 62, 28, body); rect(g, 19, 19, 62, 4, hi); rect(g, 19, 40, 62, 7, dark);
    rect(g, 10, 24, 14, 20, '#2a2328'); rect(g, 11, 25, 13, 18, '#7fd2e8'); rect(g, 12, 26, 6, 3, '#dde3ea'); // nose glass
    rect(g, 30, 23, 14, 10, '#2a2328'); rect(g, 31, 24, 12, 8, '#7fd2e8');
    rect(g, 50, 26, 22, 4, '#f3ecd6'); // stripe
    rect(g, 22, 52, 56, 3, '#2a2328'); for (const x of [30, 64]) rect(g, x, 47, 3, 6, '#2a2328'); // skids
    rect(g, 46, 12, 8, 7, '#2a2328'); // mast
    if (!wreck) { rect(g, 4, 9, 92, 3, '#2a2328'); rect(g, 5, 10, 90, 1, '#7f8597'); }
    else { rect(g, 10, 6, 40, 3, '#2a2328'); rect(g, 60, 2, 3, 12, '#2a2328'); }
  };
  add('heli_side', draw(146, 58, (g) => heli(g, false)), 110);
  add('heli_wreck', draw(146, 58, (g) => { heli(g, true); for (let i = 0; i < 26; i++) rect(g, 20 + (i * 37) % 110, 18 + (i * 13) % 30, 3, 2, i % 3 ? '#1b1b1b' : '#e86a17'); }), 108, { foot: [250, 60] });

  // ---------------------------------------------------------------- floor 8: breaker, phones; floor 12: food; floor 11: paintings
  add('breaker', draw(26, 34, (g) => {
    rect(g, 0, 0, 26, 34, '#2a2328'); rect(g, 1, 1, 24, 32, '#7f8597'); rect(g, 1, 1, 24, 2, '#a8b0bf');
    rect(g, 4, 6, 18, 22, '#2a2328'); rect(g, 5, 7, 16, 20, '#3d3a45');
    rect(g, 11, 10, 4, 14, '#2a2328'); rect(g, 12, 8, 2, 8, '#a8b0bf'); rect(g, 9, 6, 8, 4, '#d8442f'); // lever (down)
    rect(g, 3, 29, 20, 3, '#e8b84a'); for (let x = 3; x < 23; x += 4) rect(g, x, 29, 2, 3, '#2a2328');
  }), 64, { wall: true });
  add('desk_phone', cut(phones, 40, 17, 15, 13), 26);
  add('bar_stool', cut(stools, 4, 0, 24, 32), 58);
  add('portrait_ceo', cut(paintings, 66, 8, 29, 49), 96, { wall: true });
  add('painting_wide', cut(paintings, 103, 69, 81, 25), 50, { wall: true });
  add('painting_sea', cut(paintings, 109, 33, 39, 31), 62, { wall: true });
  add('chicken_plate', draw(22, 14, (g) => {
    rect(g, 0, 6, 22, 7, '#2a2328'); rect(g, 1, 7, 20, 5, '#dde3ea'); rect(g, 1, 7, 20, 1, '#ffffff');
    rect(g, 5, 1, 12, 8, '#2a2328'); rect(g, 6, 2, 10, 6, '#c08a42'); rect(g, 7, 2, 5, 2, '#e8b84a'); // roast chicken
    rect(g, 3, 3, 3, 2, '#2a2328'); rect(g, 16, 3, 3, 2, '#2a2328'); rect(g, 3, 4, 2, 1, '#f3ecd6'); rect(g, 17, 4, 2, 1, '#f3ecd6'); // legs
    rect(g, 4, 9, 3, 2, '#4f8f45');
  }), 26);
  add('coffee_cup', cut(cup, 8, 8, 16, 16), 28);
  // panoramic windows of the 12th-floor cafe: sky, distant towers (three variants), drawn on the wall facade
  for (let v = 0; v < 3; v++) add('pano_' + v, draw(64, 50, (g, w, h) => {
    for (let y = 0; y < h; y++) rect(g, 0, y, w, 1, `rgb(${120 + y * 1.6 | 0},${170 + y * 1.1 | 0},${215 + y * 0.5 | 0})`);
    const r = rng(91 + v * 17);
    for (let i = 0; i < 7; i++) { const bw = 5 + (r() * 8 | 0), bh = 10 + (r() * 26 | 0), bx = (r() * (w - bw)) | 0; rect(g, bx, h - bh, bw, bh, i % 2 ? '#7d8a99' : '#90a0ae'); for (let y = h - bh + 2; y < h - 1; y += 3) for (let x = bx + 1; x < bx + bw - 1; x += 2) if (r() < 0.6) rect(g, x, y, 1, 1, '#c9dbe8'); }
    rect(g, 0, 0, w, 2, '#2a2328'); rect(g, 0, h - 2, w, 2, '#2a2328'); rect(g, 0, 0, 2, h, '#2a2328'); rect(g, w - 2, 0, 2, h, '#5d5f6d');
    rect(g, 2, 2, w - 4, 1, '#dde3ea'); rect(g, 30, 2, 2, h - 4, '#5d5f6d');
  }), 100, { wall: true });

  // ---------------------------------------------------------------- wall faces: dark office, executives, cafe, brick street, glass towers
  const face = (fn) => { const c = canvas(64, 112); fn(c.getContext('2d')); return c; };
  props.push({ name: 'wall_face_dark', canvas: face(g => {
    rect(g, 0, 0, 64, 112, '#20242c'); rect(g, 2, 8, 60, 96, '#353b47'); rect(g, 2, 8, 60, 3, '#454c5a');
    rect(g, 0, 104, 64, 6, '#1a1c22'); rect(g, 0, 110, 64, 2, '#0f1014');
    for (let x = 10; x < 64; x += 26) { rect(g, x, 40, 14, 10, '#1a1c22'); rect(g, x + 1, 41, 12, 8, '#262b36'); } // dead monitors / frames
  }) });
  props.push({ name: 'wall_face_exec', canvas: face(g => {
    rect(g, 0, 0, 64, 112, '#3b2a22'); rect(g, 0, 8, 64, 40, '#c9b79a'); rect(g, 0, 8, 64, 3, '#e2d3b8');
    g.drawImage(cut(panel, 0, 0, 32, 32), 0, 48); rect(g, 0, 46, 64, 3, '#5a3c2a');
    rect(g, 0, 104, 64, 6, '#3b2a22'); rect(g, 0, 0, 64, 8, '#2a2328'); rect(g, 0, 6, 64, 2, '#7a5236');
  }) });
  props.push({ name: 'wall_face_cafe', canvas: face(g => {
    rect(g, 0, 0, 64, 112, '#4a3a30'); rect(g, 2, 8, 60, 50, '#e9dcc2'); rect(g, 2, 8, 60, 2, '#f6ecd8');
    for (let y = 58; y < 104; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < 64; x += 16) rect(g, x, y, 8, 8, '#2f6d63');
    for (let y = 58; y < 104; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < 64; x += 16) rect(g, x, y, 8, 8, '#e9dcc2');
    rect(g, 0, 56, 64, 2, '#2a2328'); rect(g, 0, 104, 64, 8, '#2a2328');
  }) });
  props.push({ name: 'wall_face_street', canvas: face(g => {
    g.imageSmoothingEnabled = false; g.drawImage(brick, 96, 96, 32, 56, 0, 0, 64, 112);
    rect(g, 14, 22, 36, 44, '#2a2328'); rect(g, 16, 24, 32, 40, '#5a7f96'); rect(g, 31, 24, 2, 40, '#2a2328'); rect(g, 16, 43, 32, 2, '#2a2328');
    rect(g, 17, 25, 12, 3, '#9fc4d8'); rect(g, 12, 66, 40, 4, '#c8b8a4'); rect(g, 0, 0, 64, 6, '#3d2a24'); rect(g, 0, 104, 64, 8, '#2a2328');
  }) });
  props.push({ name: 'wall_face_glass', canvas: face(g => {
    g.imageSmoothingEnabled = false; g.drawImage(building, 0, 100, 32, 56, 0, 0, 64, 112);
    rect(g, 0, 0, 64, 4, '#2a2328'); rect(g, 0, 104, 64, 8, '#3d3a45');
  }) });

  // ---------------------------------------------------------------- floors (Kenney-index slots ≥ 502 hold our own tiles)
  const tile = (index, fn) => { const c = canvas(32, 32); fn(c.getContext('2d')); floors.push({ index, canvas: up(c) }); };
  const asphalt = (g, seed) => { g.drawImage(street, 300, 452, 32, 32, 0, 0, 32, 32); const r = rng(seed); for (let i = 0; i < 10; i++) rect(g, r() * 32 | 0, r() * 32 | 0, 1, 1, r() < 0.5 ? '#3e4446' : '#5a6163'); };
  tile(502, g => asphalt(g, 3));
  tile(503, g => { asphalt(g, 5); rect(g, 4, 15, 12, 2, '#e8c64a'); rect(g, 20, 15, 12, 2, '#e8c64a'); }); // dashed centre line, horizontal road
  tile(504, g => { asphalt(g, 7); rect(g, 15, 4, 2, 12, '#e8c64a'); rect(g, 15, 20, 2, 12, '#e8c64a'); }); // vertical road
  tile(505, g => { asphalt(g, 9); for (let x = 2; x < 32; x += 8) rect(g, x, 0, 4, 32, '#d9dcd6'); }); // crossing a horizontal road
  tile(506, g => { asphalt(g, 11); for (let y = 2; y < 32; y += 8) rect(g, 0, y, 32, 4, '#d9dcd6'); });
  tile(507, g => { rect(g, 0, 0, 32, 32, '#9a988f'); rect(g, 0, 0, 32, 1, '#7c7a72'); rect(g, 0, 0, 1, 32, '#7c7a72'); rect(g, 16, 0, 1, 32, '#86847c'); rect(g, 1, 1, 15, 1, '#aeaca3'); rect(g, 17, 1, 15, 1, '#aeaca3'); const r = rng(13); for (let i = 0; i < 8; i++) rect(g, r() * 32 | 0, r() * 32 | 0, 1, 1, '#8a887f'); }); // sidewalk slabs
  for (const [index, seed] of [[508, 21], [509, 23]]) tile(index, g => { rect(g, 0, 0, 32, 32, '#4f8f45'); const r = rng(seed); for (let i = 0; i < 70; i++) rect(g, r() * 32 | 0, r() * 32 | 0, 1, r() < 0.5 ? 2 : 1, r() < 0.5 ? '#3f7a38' : r() < 0.6 ? '#6aa857' : '#8fd16b'); });
  tile(510, g => g.drawImage(sidewalk, 40, 40, 32, 32, 0, 0, 32, 32)); // plaza cobbles
  tile(511, g => { rect(g, 0, 0, 32, 32, '#262a33'); const r = rng(31); for (let i = 0; i < 60; i++) rect(g, r() * 32 | 0, r() * 32 | 0, 1, 1, r() < 0.5 ? '#2d323d' : '#1f222a'); rect(g, 0, 0, 32, 1, '#20232b'); rect(g, 0, 0, 1, 32, '#20232b'); }); // dark carpet tiles
  tile(512, g => g.drawImage(carpetB, 32, 96, 32, 32, 0, 0, 32, 32)); // executive carpet
  tile(513, g => g.drawImage(diamondB, 0, 0, 32, 32, 0, 0, 32, 32)); // cafe tiles
  tile(514, g => { rect(g, 0, 0, 32, 32, '#7a6a52'); const r = rng(41); for (let i = 0; i < 40; i++) rect(g, r() * 32 | 0, r() * 32 | 0, 2, 1, r() < 0.5 ? '#6a5a44' : '#8a7a60'); }); // park path
}
