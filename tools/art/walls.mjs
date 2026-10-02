// Thick-wall autotiles reproducing the Kenney Top-down Shooter wall look:
// dark top (#4a4a4a) + coloured rim bands on every side that faces floor.
// 8-neighbour blob tileset: 47 canonical masks per theme.
import { createCanvas } from '@napi-rs/canvas';

export const T = 64;
export const WALL_THEMES = {
  office: { rim: '#c48647', dark: '#956536', bevel: '#d08e4a' },
  lab: { rim: '#a6c9cb', dark: '#648587', bevel: '#94b4b6' },
  industrial: { rim: '#e86a17', dark: '#a64a0f', bevel: '#565656' },
  office7: { rim: '#bfc2bb', dark: '#727b7c', bevel: '#d9dbd2', top: '#939891' },
  // D69
  dark: { rim: '#3d4554', dark: '#1d2129', bevel: '#4c5566', top: '#16181d' },
  exec: { rim: '#8a5a3a', dark: '#4a3022', bevel: '#b07a4e', top: '#3a2a22' },
  street: { rim: '#9a5240', dark: '#5e2f24', bevel: '#b8735a', top: '#55524f' },
  cafe: { rim: '#cdbb98', dark: '#7a6a52', bevel: '#e6d8bc', top: '#6a5a48' },
};
export const THEME_ORDER = ['office', 'lab', 'industrial', 'office7', 'dark', 'exec', 'street', 'cafe'];

// bits: N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128  (bit set = neighbour is wall)
export function canonical(mask) {
  let m = mask & 15;
  if ((mask & 16) && (mask & 1) && (mask & 2)) m |= 16;
  if ((mask & 32) && (mask & 2) && (mask & 4)) m |= 32;
  if ((mask & 64) && (mask & 4) && (mask & 8)) m |= 64;
  if ((mask & 128) && (mask & 8) && (mask & 1)) m |= 128;
  return m;
}

export function canonicalList() {
  const set = new Set();
  for (let m = 0; m < 256; m++) set.add(canonical(m));
  return [...set].sort((a, b) => a - b);
}

const DARK = 2, RIM = 8, BEV = 5; // band thickness from outside in

function drawTile(g, ox, oy, mask, th) {
  g.fillStyle = th.top || '#4a4a4a';
  g.fillRect(ox, oy, T, T);
  const open = { N: !(mask & 1), E: !(mask & 2), S: !(mask & 4), W: !(mask & 8) };
  const band = (side, from, size, col) => {
    g.fillStyle = col;
    if (side === 'N') g.fillRect(ox, oy + from, T, size);
    if (side === 'S') g.fillRect(ox, oy + T - from - size, T, size);
    if (side === 'W') g.fillRect(ox + from, oy, size, T);
    if (side === 'E') g.fillRect(ox + T - from - size, oy, size, T);
  };
  const sides = Object.keys(open).filter((k) => open[k]);
  for (const s of sides) band(s, DARK + RIM, BEV, th.bevel);
  for (const s of sides) band(s, DARK, RIM, th.rim);
  for (const s of sides) band(s, 0, DARK, th.dark);
  // inner corners: both cardinals are walls but the diagonal is floor
  const corner = (cx, cy, sx, sy) => {
    const sq = (size, col) => {
      g.fillStyle = col;
      g.fillRect(sx > 0 ? ox + T - size : ox, sy > 0 ? oy + T - size : oy, size, size);
    };
    sq(DARK + RIM + BEV, th.bevel);
    sq(DARK + RIM, th.rim);
    sq(DARK, th.dark);
  };
  if ((mask & 1) && (mask & 2) && !(mask & 16)) corner(0, 0, 1, -1);
  if ((mask & 2) && (mask & 4) && !(mask & 32)) corner(0, 0, 1, 1);
  if ((mask & 4) && (mask & 8) && !(mask & 64)) corner(0, 0, -1, 1);
  if ((mask & 8) && (mask & 1) && !(mask & 128)) corner(0, 0, -1, -1);
}

/** Returns {canvas, cols, perTheme, lookup: {canonicalMask: localIndex}} */
export function buildWallSheet() {
  const list = canonicalList(); // 47
  const cols = 16, perTheme = 48;
  const rows = (perTheme / cols) * THEME_ORDER.length;
  const c = createCanvas(cols * T, rows * T);
  const g = c.getContext('2d');
  THEME_ORDER.forEach((name, ti) => {
    list.forEach((mask, i) => {
      const idx = ti * perTheme + i;
      drawTile(g, (idx % cols) * T, Math.floor(idx / cols) * T, mask, WALL_THEMES[name]);
    });
  });
  const lookup = {};
  list.forEach((m, i) => { lookup[m] = i; });
  return { canvas: c, cols, perTheme, lookup };
}
