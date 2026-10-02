// 2.5D art: public LPC / Skorpio pixel art, integer ×2 scaling, small documented hand-made pixel parts.
// No AI artwork. Outputs (via build-assets.mjs):
//   lpc        – Universal LPC layer strips for the runtime character compositor
//   office25   – furniture/props for every level, birds, weapons, wall faces
//   tiles25    – Kenney-index-compatible floor sheet whose used cells hold LPC floors
import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'node:path';
import fs from 'node:fs';
import { LAYERS, layerFile } from './lpc-layers.mjs';
import { buildCity } from './city.mjs';

function canvas(w, h) { const c = createCanvas(w, h); c.getContext('2d').imageSmoothingEnabled = false; return c; }
function cut(img, x, y, w, h, scale = 2) {
  if (x < 0 || y < 0 || x + w > img.width || y + h > img.height) throw new Error(`crop outside source: ${x},${y},${w},${h} in ${img.width}x${img.height}`);
  const c = canvas(w * scale, h * scale);
  c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, c.width, c.height); return c;
}
function hexRgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
/** Recolour light, low-saturation pixels (feathers, white plastic) keeping outline/comb. */
function colourKeep(c, hex, satMax = 40, minL = 90) {
  const out = canvas(c.width, c.height), g = out.getContext('2d'); g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), t = hexRgb(hex);
  for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3]) {
    const [r, gg, b] = [d.data[i], d.data[i + 1], d.data[i + 2]];
    if (Math.max(r, gg, b) - Math.min(r, gg, b) < satMax && r > minL) { const k = r / 255; d.data[i] = t[0] * k; d.data[i + 1] = t[1] * k; d.data[i + 2] = t[2] * k; }
  }
  g.putImageData(d, 0, 0); return out;
}
function tint(c, hex, k = 0.5) {
  const out = canvas(c.width, c.height), g = out.getContext('2d'); g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), t = hexRgb(hex);
  for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3]) for (let ch = 0; ch < 3; ch++) d.data[i + ch] = d.data[i + ch] * (1 - k) + t[ch] * k * d.data[i + ch] / 160;
  g.putImageData(d, 0, 0); return out;
}
function flipX(c) { const o = canvas(c.width, c.height), g = o.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return o; }
function stack(w, h, parts) { const c = canvas(w, h), g = c.getContext('2d'); for (const [img, x, y] of parts) g.drawImage(img, x, y); return c; }

// ------------------------------------------------------------------ tiny pixel painter (native px, ×2 on output)
// Hand-made pieces for objects no free LPC set provides (pods, machines, crates, signs, guns).
// Palette follows the Liberated Palette ramps used by the LPC furniture.
const PAL = {
  o: '#2a2328', d: '#3d3a45', g: '#5d5f6d', m: '#7f8597', l: '#a8b0bf', w: '#dde3ea', W: '#ffffff',
  b: '#5a3c2a', B: '#7a5236', t: '#9c6c45', T: '#c3925e', y: '#e8b84a', Y: '#f6d77c',
  r: '#9e2b25', R: '#d8442f', k: '#16141a', G: '#4f8f45', L: '#8fd16b', c: '#3c7f9a', C: '#7fd2e8', n: '#2f4d5a',
  e: '#f3ecd6', E: '#cfc4a5', s: '#e0c590', h: '#c08a42', p: '#6a4b8a', v: '#9be22e', V: '#d6ff7a', '.': null,
};
function paint(rows, scale = 2) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = canvas(w * scale, h * scale), g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { const col = PAL[ch]; if (col) { g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale); } }));
  return c;
}
/** Procedural box with LPC-style top face, front face, outline and highlight (native px). */
function box(w, h, top, opt = {}) {
  const { face = 'm', topC = 'l', dark = 'g', line = 'o', details } = opt;
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || x === w - 1 || y === 0 || y === h - 1;
      let ch = edge ? line : y < top ? (y === 1 ? 'w' : topC) : y === top ? dark : (x === 1 ? topC : x === w - 2 ? dark : face);
      if (details) ch = details(x, y, ch) ?? ch;
      r += ch;
    }
    rows.push(r);
  }
  return paint(rows);
}

// ------------------------------------------------------------------ weapons (native pixel art, facing +X)
// grip = pixel where the hand holds the gun, muzzle = barrel tip x (native).
export const GUNS = {
  pistol: { grip: [3, 4], muzzle: 11, rows: [
    '..oooooooooo',
    '.oggmmmmmmmo',
    '.ogddddddddo',
    '.oddoooooooo',
    '.oddo.......',
    '.oooo.......'] },
  smg: { grip: [5, 5], muzzle: 17, rows: [
    '....oooooooooooooo',
    'ooooggmmmmmmmmmmmo',
    'oddoddddddddddoooo',
    'oooodddoodddo.....',
    '....odddoddo......',
    '....ooooodo.......',
    '.........oo.......'] },
  shotgun: { grip: [6, 4], muzzle: 22, rows: [
    'ooo....................o',
    'otBoooooooooooooooooooo.',
    'otTBBBBgmmmmmmmmmmmmmmo.',
    'oBBBBBBdddddttttttddddo.',
    '.ooBBoooooooooooooooooo.',
    '...ooo..................'] },
  rifle: { grip: [8, 5], muzzle: 26, rows: [
    '..........oooo.............',
    'ooo.....oooddooooooooooooooo',
    'obBoooooogmmmmmmmmmmmmmmmmoo',
    'oBBBBBBBddddddddddddooooooo.',
    '.ooBBoooodddoodddo..........',
    '...ooo..odddoodddo..........',
    '........ooooo.ooo...........'] },
  machinegun: { grip: [10, 6], muzzle: 31, rows: [
    '...........oooooo...............',
    '..........ogmmmmgo..............',
    'oooo.....oooddddoooooooooooooooo',
    'oddoooooogmmmmmmmmmmmmmmmmmmmmmo',
    'odddddddddddddddddddddoooooooooo',
    '.ooddoooooddddodddo.............',
    '...ooo...odddoddddo.............',
    '.........oooooooooo.............'] },
  grenade: { grip: [7, 5], muzzle: 22, rows: [
    '.........oooooooooooooo',
    'oooo....oGGGGGGGGGGGGGo',
    'oddoooooGLLLLLLLLLLLLLo',
    'oddddddoGGGGGGGGGGGGGGo',
    '.oodddoogddddddddddddoo',
    '...odddo.oooooooooooo..',
    '...ooooo...............'] },
  flamethrower: { grip: [9, 6], muzzle: 26, rows: [
    '..ooooo....................',
    '.oRRRRRo...................',
    'oRYRRRRRooooooooooooooooo..',
    'oRRRRRRRgmmmmmmmmmmmmmmmmoo',
    'oRRRRRRRdddddddddddddddddoy',
    '.oRRRRRoodddoodddo.....ooo.',
    '..ooooo.odddoodddo.........',
    '........ooooo.ooo..........'] },
};

export async function buildLpc(root) {
  const office = p => path.join(root, 'vendor/lpc-office', p);
  const skorpio = p => path.join(root, "vendor/skorpio", p);
  const source = p => path.join(root, 'vendor/lpc-characters/spritesheets', p);
  const img = async (p) => loadImage(p);

  // -------- character layer strips: walk (rows 0–3 × 9) + hurt (row 4 × 6) + armed pose (row 5: thrust frame 4
  // for N/W/S/E, hands held forward), 576×384 each
  const people = [];
  for (const l of LAYERS) {
    const c = canvas(576, 384), g = c.getContext('2d');
    g.drawImage(await img(source(layerFile(l, 'walk'))), 0, 0);
    g.drawImage(await img(source(layerFile(l, 'hurt'))), 0, 256);
    const thrustFile = source(layerFile(l, 'thrust'));
    const thrust = fs.existsSync(thrustFile) ? await img(thrustFile) : null;
    for (let d = 0; d < 4; d++) {
      if (thrust) g.drawImage(thrust, 4 * 64, d * 64, 64, 64, d * 64, 320, 64, 64);
      else g.drawImage(c, 0, d * 64, 64, 64, d * 64, 320, 64, 64);
    }
    people.push({ name: l.id, canvas: c });
  }

  const props = [], meta = {};
  const add = (name, c, feetY = c.height - 8, extra = {}) => { props.push({ name, canvas: c }); meta[name] = { feetX: c.width / 2, feetY, ...extra }; };

  // -------- birds: LPC Chicken Rework, rows N/E/S/W → N/W/S/E
  const chicken = await img(path.join(root, 'vendor/lpc-characters/chicken.png'));
  for (const [prefix, colour] of [['hen', null], ['chick', '#f2cf3a']]) for (let row = 0; row < 4; row++) for (let f = 0; f < 3; f++) {
    const crop = cut(chicken, f * 32, [0, 3, 2, 1][row] * 32, 32, 32, 1);
    props.push({ name: `${prefix}_${['n', 'w', 's', 'e'][row]}_${f}`, canvas: colour ? colourKeep(crop, colour) : crop });
  }

  // -------- weapons
  const gunMeta = {};
  for (const [id, g] of Object.entries(GUNS)) {
    const c = paint(g.rows);
    props.push({ name: 'gun_' + id, canvas: c });
    gunMeta[id] = { gripX: g.grip[0] * 2, gripY: g.grip[1] * 2, muzzle: (g.muzzle - g.grip[0]) * 2, w: c.width, h: c.height };
  }

  // -------- office furniture (S01–S03)
  const deskSheet = await img(office('source/Desk, Ornate.png'));
  const laptop = await img(office('source/Laptop.png'));
  for (const key of ['desk', 'desk_b', 'desk_light']) {
    const c = canvas(128, 96), g = c.getContext('2d');
    g.drawImage(cut(deskSheet, 0, 0, 32, 48), 0, 0);
    g.drawImage(cut(deskSheet, 64, 0, 32, 48), 64, 0);
    if (key === 'desk_light') {
      const data = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < data.data.length; i += 4) {
        const [r, gg, b] = data.data.slice(i, i + 3);
        if (data.data[i + 3]) {
          const l = (r + gg + b) / 3;
          data.data[i] = l < 40 ? 67 : Math.min(232, l * .6 + 144); data.data[i + 1] = l < 40 ? 58 : Math.min(207, l * .55 + 117); data.data[i + 2] = l < 40 ? 51 : Math.min(160, l * .38 + 80);
        }
      }
      g.putImageData(data, 0, 0);
    }
    g.drawImage(cut(laptop, key === 'desk' ? 0 : 32, 0, 32, 32), 32, -5);
    add(key, c, 83);
  }
  // New small props use the same native pixel scale and outlines as adapted LPC furniture.
  {
    const c = canvas(80, 56), g = c.getContext('2d');
    g.fillStyle = '#29353b'; g.fillRect(5, 32, 6, 22); g.fillRect(68, 32, 6, 22);
    g.fillStyle = '#1b2933'; g.fillRect(0, 0, 80, 37);
    g.fillStyle = '#397983'; g.fillRect(2, 2, 76, 29);
    g.fillStyle = '#b5d6d4'; g.fillRect(4, 4, 72, 2); g.fillRect(4, 26, 72, 2); g.fillRect(39, 4, 2, 24);
    g.fillStyle = '#97b2b6'; g.fillRect(1, 15, 78, 3);
    g.fillStyle = '#384856'; for (let x = 3; x < 78; x += 4) g.fillRect(x, 13, 2, 5);
    g.fillStyle = '#edc95c'; g.fillRect(19, 21, 3, 3);
    g.fillStyle = '#b94b49'; g.fillRect(7, 5, 6, 6); g.fillRect(66, 22, 6, 6);
    add('table_tennis', cut(c, 0, 0, 80, 56), 100);
  }
  for (const [kind, color, mark] of [['invincible', '#ffd65c', '★'], ['damage', '#ff7568', '×3'], ['infinite', '#78baff', '∞'], ['sprint', '#8dffbd', '»'], ['achievement', '#ffd65c', 'R']]) {
    const c = canvas(32, 32), g = c.getContext('2d');
    g.fillStyle = '#242b35'; g.fillRect(3, 2, 26, 28); g.fillRect(2, 3, 28, 26);
    g.fillStyle = color; g.fillRect(4, 4, 24, 24);
    g.fillStyle = '#26323a'; g.fillRect(6, 6, 20, 20);
    g.fillStyle = color; g.font = 'bold 17px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(mark, 16, 17);
    props.push({ name: 'pk_' + kind, canvas: cut(c, 0, 0, 32, 32) });
  }
  const O = (p) => office('objects/Objects/' + p);
  const sheets = {
    cooler: await img(office('source/Water Cooler.png')), copy: await img(office('source/Copy Machine.png')),
    planters: await img(O('Decoration/Planters.png')), cabinets: await img(O('Storage/Cabinets.png')),
    chairs: await img(O('Furniture/Chairs, Dining.png')), bins: await img(office('source/Bins.png')),
    tables: await img(O('Furniture/Tables.png')), sofas: await img(O('Furniture/Sofas, Casual.png')),
    counters: await img(O('Furniture/Countertops.png')), sink: await img(office('source/Sink.png')),
    tv: await img(office('source/TV, Widescreen.png')), coffee: await img(office('source/Coffee Maker.png')),
    barrels: await img(O('Storage/Barrels.png')),
    sObj: await img(skorpio('Objects.png')), sFur: await img(skorpio('Interior-Furniture.png')),
    sPipes: await img(skorpio('Pipes-RustyWalls.png')), sWalls: await img(skorpio('Interior-Walls-Blue.png')),
  };
  const S = sheets;
  add('water_cooler', cut(S.cooler, 0, 0, 32, 64));
  add('printer', cut(S.copy, 0, 0, 64, 64));
  add('plant', cut(S.planters, 128, 32, 32, 54));
  add('plant_small', cut(S.planters, 96, 32, 32, 54));
  add('cabinet', cut(S.cabinets, 0, 0, 32, 96));
  add('shelf', cut(S.cabinets, 160, 96, 32, 64));
  add('office_chair', cut(S.chairs, 128, 0, 32, 32));
  add('bin', cut(S.bins, 0, 0, 32, 32));
  // dining chairs: 4 woods × facing (rot 0 faces viewer/S; 180 back; 90/270 side)
  for (let i = 0; i < 4; i++) {
    const x = [0, 64, 128, 192][i];
    const front = cut(S.chairs, x, 256, 32, 32), side = cut(S.chairs, x, 288, 32, 32), back = cut(S.chairs, x + 32, 256, 32, 32);
    add(`chair_${i}`, front, 56); add(`chair_${i}_180`, back, 56); add(`chair_${i}_90`, flipX(side), 56); add(`chair_${i}_270`, side, 56);
  }
  add('chair_blue', cut(S.chairs, 128, 192, 32, 32), 56);
  add('table_round', cut(S.tables, 0, 0, 32, 32));
  add('coffee_table', cut(S.tables, 64, 0, 32, 24));
  add('table_long', cut(S.tables, 16, 36, 72, 28));
  add('table_big', cut(S.tables, 16, 176, 80, 108), 208);
  add('table_small', cut(S.tables, 112, 128, 80, 48));
  for (const [n, x] of [['sofa_orange', 0], ['sofa_green', 192], ['sofa_dark', 320]]) add(n, cut(S.sofas, x, 0, 64, 32));
  // kitchen counters: worktop + cabinet front
  const top = cut(S.counters, 0, 0, 32, 18), drawers = cut(S.counters, 0, 160, 32, 26), doors = cut(S.counters, 32, 160, 32, 26);
  const counter = (front, extra) => { const c = stack(64, 88, [[front, 0, 24], [top, 0, 0]]); if (extra) extra(c.getContext('2d')); return c; };
  add('counter_a', counter(drawers)); add('counter_b', counter(doors)); add('counter_c', counter(doors)); add('counter_d', counter(drawers));
  add('stove', counter(doors, g => { g.drawImage(paint(['oooooooooooooooo', 'okkkkoowwookkkko', 'okggkoowwookggko', 'okkkkooooookkkko', 'oooooooooooooooo']), 16 * 0, 0); }));
  add('hob', counter(drawers, g => { g.drawImage(paint(['................', '..kkk......kkk..', '.kgggk....kgggk.', '..kkk......kkk..', '................', '..kkk......kkk..', '.kgggk....kgggk.', '..kkk......kkk..']), 0, 0); }));
  add('hob_dark', counter(doors));
  add('sink', counter(doors, g => g.drawImage(cut(S.sink, 96, 0, 32, 20), 0, -6)));
  add('reception', cut(S.counters, 96, 140, 96, 40), 76);
  add('tv', cut(S.tv, 100, 0, 88, 56), 104);
  add('vending', cut(S.sObj, 75, 0, 46, 64), 124);
  add('vending_b', cut(S.sObj, 75, 64, 46, 64), 124);
  add('poster', cut(S.sObj, 133, 65, 22, 29), 56, { wall: true });
  add('poster_b', cut(S.sObj, 165, 65, 22, 29), 56, { wall: true });
  add('barrel', cut(S.sObj, 130, 23, 26, 34));
  add('barrel_grey', tint(cut(S.sObj, 130, 23, 26, 34), '#8a8f99', 0.6));
  add('barrel_open', cut(S.sObj, 130, 23, 26, 34));
  add('hazard_barrel', tint(cut(S.sObj, 130, 23, 26, 34), '#d8442f', 0.55));
  add('pipe_h', cut(S.sPipes, 160, 36, 96, 28), 50);
  add('lab_bench', cut(S.sFur, 14, 8, 68, 80), 152);
  add('server_rack', cut(S.sFur, 353, 190, 32, 64), 120);
  add('lab_console', cut(S.sFur, 385, 190, 32, 64), 120);
  add('terminal', cut(S.sObj, 33, 190, 32, 64), 120);
  add('elevator', cut(S.sFur, 193, 290, 64, 64), 120, { wall: true });

  // -------- hand-made pieces (documented in docs/ASSETS.md)
  add('whiteboard', paint([
    'oooooooooooooooooooooooooooooooo',
    'ollllllllllllllllllllllllllllllo',
    'olwwwwwwwwwwwwwwwwwwwwwwwwwwwwlo',
    'olwRRRw.wwwwcccwwwwwwwwwwkkkwwlo',
    'olwwwwwwwRwwwwwccwwwkkwwwwwwwwlo',
    'olwwkkkkwwRwwwwwwwwwwwkkwwGGwwlo',
    'olwwwwwwwwwRRRRwwwwwwwwwkwwwwwlo',
    'olwwcccccwwwwwwwkkkkkwwwwwwwwwlo',
    'olwwwwwwwwwwwwwwwwwwwwwwwRRRwwlo',
    'olwwwwwwwwwwwwwwwwwwwwwwwwwwwwlo',
    'ollllllllllllllllllllllllllllllo',
    'oooooooooooooooooooooooooooooooo',
    '.oddo....................oddo...',
  ].map(r => r.replace(/\./g, '.'))), 22, { wall: true });
  add('sign_exit', paint(['oooooooooooo', 'oGGGGGGGGGGo', 'oGWWGWGWGWWo', 'oGWGGGWGGWGo', 'oGWWGWGWGWGo', 'oGWGGWGWGWGo', 'oGWWGWGWGWGo', 'oGGGGGGGGGGo', 'oooooooooooo']), 18, { wall: true });
  add('emergency_light', paint(['.oooooo.', 'oRRRRRRo', 'oRWRRRRo', '.oooooo.']), 8, { wall: true });
  add('ceiling_light', paint(['oooooooooo', 'owWWWWWWwo', 'oooooooooo']), 6);
  add('aquarium', box(48, 40, 6, { face: 'c', topC: 'C', dark: 'n', details: (x, y, ch) => {
    if (y > 30 && x > 0 && x < 47 && y < 39) return y === 31 ? 'o' : x % 9 === 3 ? 'B' : 'b';
    if (y > 8 && y < 30 && x > 1 && x < 46) { if ((x === 12 || x === 30) && y > 14 && y < 30) return 'G'; if ((x === 20 && y === 15) || (x === 36 && y === 21)) return 'y'; if ((x === 21 && y === 15) || (x === 37 && y === 21)) return 'R'; if (y > 25) return 's'; if ((x * 7 + y * 3) % 23 === 0) return 'W'; }
  } }), 76);
  const crate = (w, h) => box(w, h, Math.round(h * 0.28), { face: 't', topC: 'T', dark: 'b', details: (x, y, ch) => {
    const top = Math.round(h * 0.28);
    if (y > top && (x === 2 || x === w - 3 || y === top + 2 || y === h - 3)) return 'B';
    if (y > top && Math.abs((x - 2) - (y - top - 2) * (w - 4) / (h - top - 4)) < 1.2) return 'B';
    if (y > 1 && y < top && y % 3 === 0) return 't';
  } });
  add('crate', crate(32, 32)); add('crate_rot', crate(32, 32)); add('crate_small', crate(22, 22)); add('crate_small_rot', crate(22, 22));
  const pallet = () => { const c = canvas(64, 52), g = c.getContext('2d'); g.drawImage(crate(22, 22), 2, 4); g.drawImage(crate(22, 22), 20, 0); g.drawImage(paint(['oooooooooooooooooooooooooooooooo', 'oTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTo', 'obbobbbbbbobbbbbbbobbbbbbbobbbbo', 'oooooooooooooooooooooooooooooooo']), 0, 44); return c; };
  add('pallet', pallet());
  { const c = canvas(96, 96), g = c.getContext('2d'); g.drawImage(crate(32, 32), 0, 32); g.drawImage(crate(32, 32), 32, 32); g.drawImage(crate(32, 32), 16, 0); g.drawImage(paint(['oooooooooooooooooooooooooooooooooooooooooooooooo', 'oTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTo', 'obbobbbbbbbbobbbbbbbbbbbobbbbbbbbbbbobbbbbbbbbbo', 'oooooooooooooooooooooooooooooooooooooooooooooooo']), 0, 88); add('forklift', c); }
  const pod = (broken) => {
    const rows = [];
    for (let y = 0; y < 48; y++) {
      let r = '';
      for (let x = 0; x < 28; x++) {
        const cx = x - 13.5;
        let ch = '.';
        if (y < 6) ch = Math.abs(cx) < 13 ? (y === 0 || Math.abs(cx) > 12 ? 'o' : y < 3 ? 'l' : 'm') : '.';
        else if (y < 40) {
          if (Math.abs(cx) > 13) ch = '.'; else if (Math.abs(cx) > 12) ch = 'o';
          else if (broken && y < 22 + Math.abs(cx * 1.7) % 7) ch = Math.abs(cx) > 10 && (x + y) % 3 === 0 ? 'C' : '.';
          else { ch = broken ? (y > 33 ? 'v' : '.') : Math.abs(cx) < 2 && y > 8 ? 'V' : 'L'; if (!broken && cx * cx / 30 + (y - 25) * (y - 25) / 60 < 1) ch = (y < 22 ? 'e' : 'E'); if (!broken && Math.abs(cx) > 9) ch = 'C'; }
        } else ch = y === 47 || Math.abs(cx) > 13 ? 'o' : Math.abs(cx) > 12 ? 'o' : y < 42 ? 'm' : 'g';
        r += ch;
      }
      rows.push(r);
    }
    return paint(rows);
  };
  add('egg_pod', pod(false)); add('egg_pod_broken', pod(true));
  add('machine', box(48, 56, 14, { face: 'g', topC: 'm', dark: 'd', details: (x, y) => {
    if (y > 18 && y < 30 && x > 6 && x < 22) return x === 7 || x === 21 || y === 19 || y === 29 ? 'o' : (x + y) % 5 ? 'n' : 'C';
    if (y > 18 && y < 26 && x > 28 && x < 42) return (x % 4 === 1) ? (y % 4 ? 'y' : 'R') : 'd';
    if (y > 40 && y < 52 && x > 4 && x < 44) return (x + y) % 4 === 0 ? 'y' : 'k';
  } }), 104);
  add('generator', box(56, 44, 12, { face: 'G', topC: 'L', dark: 'g', details: (x, y) => {
    if (y > 16 && y < 38 && x > 6 && x < 30 && x % 3 === 0) return 'd';
    if (y > 18 && y < 26 && x > 36 && x < 50) return x === 37 || x === 49 ? 'o' : y < 22 ? 'R' : 'y';
    if (y > 30 && y < 36 && x > 36 && x < 50) return (x % 3) ? 'k' : 'y';
  } }), 80);
  add('conveyor', box(64, 24, 8, { face: 'd', topC: 'k', dark: 'o', details: (x, y) => {
    if (y > 1 && y < 8) return x % 6 < 1 ? 'g' : 'k';
    if (y > 9 && y < 22 && x % 12 === 6) return 'y';
    if (y > 15 && y < 20 && x > 1 && x < 62) return (x % 12 < 6) ? 'y' : 'k';
  } }), 40);
  add('lamp', paint(['..oooo..', '.oYYYYo.', 'oYYYYYYo', 'oooooooo', '...oo...', '...oo...', '...oo...', '...oo...', '..oooo..', '.oddddo.']), 18);

  // -------- floors (S01) and wall faces per theme
  const F = (p) => office('structure/Structure/Floor/' + p + '.png');
  const fl = { wood: await img(F('Wood Floor A')), tileA: await img(F('Tile A')), tileB: await img(F('Tile B')), tileC: await img(F('Tile C')),
    diamond: await img(F('Diamond Tile A')), herring: await img(F('Herringbone A')), dirt: await img(F('Gritty Dirt')), carpet: await img(F('Geometric Carpet A')) };
  // Kenney tile index → [sheet, x, y]
  const floorMap = {
    41: ['wood', 96, 96], 42: ['wood', 128, 96], 68: ['wood', 128, 96], 69: ['wood', 160, 96], 95: ['wood', 160, 96], 96: ['wood', 96, 96],
    11: ['tileA', 0, 0], 4: ['dirt', 0, 0], 5: ['dirt', 32, 0], 6: ['tileB', 32, 32],
    7: ['tileA', 32, 0], 8: ['tileA', 32, 32], 9: ['tileA', 32, 64], 10: ['tileA', 32, 96],
    12: ['herring', 64, 0], 13: ['herring', 64, 32],
    82: ['tileC', 32, 64], 85: ['tileC', 32, 96], 86: ['tileC', 32, 64], 87: ['tileC', 32, 160],
    270: ['tileB', 64, 0], 271: ['tileB', 64, 32], 297: ['tileB', 64, 64], 298: ['tileB', 64, 96],
    324: ['diamond', 0, 0], 325: ['diamond', 0, 32], 326: ['diamond', 32, 0], 351: ['diamond', 32, 32],
  };
  // rugs (Kenney 3×3 blocks) → 96×96 LPC carpet blocks
  for (const [base, cx] of [[369, 256], [372, 32]]) for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) floorMap[base + j * 27 + i] = ['carpet', cx + i * 32, 96 + j * 32];
  const floors = Object.entries(floorMap).map(([i, [s, x, y]]) => ({ index: Number(i), canvas: cut(fl[s], x, y, 32, 32) }));
  for (const [index, base] of [[500, '#b2afa3'], [501, '#cfcbc1']]) {
    const c = canvas(64, 64), g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 64, 64); g.fillStyle = '#9a998f'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64);
    g.fillStyle = index === 500 ? '#bab7ac' : '#d8d4ca'; g.fillRect(2, 2, 62, 2);
    floors.push({ index, canvas: c });
  }

  const wallSheet = await img(office('structure/Structure/Walls/Painted Walls.png'));
  const panel = await img(office('structure/Structure/Walls/Half-Wall Paneling A.png'));
  const face = (paintTop) => { const c = canvas(64, 112), g = c.getContext('2d'); paintTop(g); return c; };
  props.push({ name: 'wall_face_office7', canvas: face(g => {
    g.fillStyle = '#7d807d'; g.fillRect(0, 0, 64, 112);
    g.fillStyle = '#c7c9c2'; g.fillRect(2, 8, 60, 96);
    g.fillStyle = '#e0dfd7'; g.fillRect(2, 8, 60, 3);
    g.fillStyle = '#999c96'; g.fillRect(0, 104, 64, 6);
    g.fillStyle = '#555e62'; g.fillRect(0, 110, 64, 2);
  }) });
  props.push({ name: 'wall_face_office', canvas: face(fg => {
    fg.drawImage(wallSheet, 1152, 0, 96, 96, 0, 0, 64, 112);
    fg.drawImage(cut(panel, 0, 0, 32, 32), 0, 48);
    fg.fillStyle = '#43404a'; fg.fillRect(0, 0, 64, 8); fg.fillStyle = '#716674'; fg.fillRect(0, 0, 64, 2); fg.fillStyle = '#50423b'; fg.fillRect(0, 106, 64, 6);
  }) });
  props.push({ name: 'wall_face_lab', canvas: face(fg => {
    fg.drawImage(cut(S.sWalls, 16, 16, 64, 64, 1), 0, 0, 64, 112);
    fg.fillStyle = '#26323a'; fg.fillRect(0, 0, 64, 6); fg.fillStyle = '#7fb0b8'; fg.fillRect(0, 6, 64, 2);
    fg.fillStyle = '#1d2a30'; fg.fillRect(0, 104, 64, 8); fg.fillStyle = '#3fd27a'; fg.fillRect(6, 60, 4, 2);
  }) });
  props.push({ name: 'wall_face_industrial', canvas: face(fg => {
    // riveted steel panels (hand-made, LPC palette)
    fg.drawImage(box(32, 56, 0, { face: 'g', topC: 'm', dark: 'd', details: (x, y) => {
      if (y === 18 || y === 37) return 'd';
      if (y === 19 || y === 38) return 'm';
      if ((x === 3 || x === 28) && (y % 9 === 4)) return 'l';
      if (x > 8 && x < 23 && y > 23 && y < 32) return y === 24 ? 'k' : (y % 2 ? 'd' : 'g');
    } }), 0, 0);
    fg.fillStyle = '#2a2724'; fg.fillRect(0, 0, 64, 6);
    for (let x = -16; x < 64; x += 16) { fg.fillStyle = '#e0a51f'; fg.beginPath(); fg.moveTo(x, 112); fg.lineTo(x + 8, 112); fg.lineTo(x + 16, 100); fg.lineTo(x + 8, 100); fg.fill(); }
    fg.fillStyle = '#222'; fg.fillRect(0, 98, 64, 2);
  }) });
  // -------- doors: front facade (horizontal walls) and side jamb (vertical walls), per theme
  const doorFace = (face, panel, lit) => box(32, 52, 0, { face, topC: panel, dark: 'o', details: (x, y) => {
    if (y === 1 || x === 1 || x === 30) return 'o';
    if (x === 15 || x === 16) return 'o';
    if (y > 6 && y < 20 && (x > 3 && x < 13 || x > 18 && x < 28)) return y === 7 ? 'n' : 'C';
    if (y === 30 && (x === 13 || x === 18)) return 'y';
    if (lit && y > 2 && y < 5 && x > 13 && x < 18) return lit;
  } });
  const doorSide = (face, lit) => box(8, 56, 0, { face, topC: face, dark: 'o', details: (x, y) => (lit && y > 4 && y < 8 && x > 1 && x < 6 ? lit : y === 28 && x > 2 && x < 5 ? 'y' : undefined) });
  for (const [theme, face] of [['office', 't'], ['lab', 'm'], ['industrial', 'g'], ['dark', 'd'], ['exec', 'b'], ['street', 'g'], ['cafe', 't'], ['office7', 'l']]) {
    props.push({ name: `door_${theme}`, canvas: doorFace(face, face === 't' ? 'B' : 'l', null) });
    props.push({ name: `door_${theme}_side`, canvas: doorSide(face, null) });
  }
  props.push({ name: 'door_locked', canvas: doorFace('g', 'l', 'R') });
  props.push({ name: 'door_locked_side', canvas: doorSide('g', 'R') });
  await buildCity(root, { add, floors, props });
  return { people, props, meta, floors, gunMeta };
}

/** Writes credits for third-party sheets bundled from vendor/skorpio. */
export function skorpioPresent(root) { return fs.existsSync(path.join(root, 'vendor/skorpio/Objects.png')); }
