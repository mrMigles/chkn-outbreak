// Character compositor: stacks recoloured Universal LPC layers into one sheet
// (rows 0–3: walk N/W/S/E × 9 frames, row 4: hurt × 6 frames, row 5: armed pose N/W/S/E; humans also get
// rows 6–9: armed walk = armed upper body over walking legs) and, for mutants, performs the
// "chicken surgery": feathered skin, comb, beak, wattle, red eyes, claws, collar tufts and a tail.
// Pure canvas code, shared by the browser runtime and node preview tools.
import type { Look } from '../../shared/look';
import { SKIN_TONES } from '../../shared/look';

export const SHEET_W = 576, SHEET_H = 384, CELL = 64;
/** Human sheets carry 4 extra rows of armed walking frames. */
export const ARMED_H = SHEET_H + 4 * CELL;
const ARMED_SPLIT = 46;
export const DIRS = ['n', 'w', 's', 'e'] as const;

type Ctx = CanvasRenderingContext2D;
export interface CanvasLike { width: number; height: number; getContext(t: '2d'): any }
export interface ComposeEnv {
  /** Returns a canvas holding the 576×384 layer strip, or null when the layer is missing. */
  layer(id: string): CanvasLike | null;
  canvas(w: number, h: number): CanvasLike;
}

const rgb = (hex: string) => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k);

/** The boss (Генеральный Петух): big body + red-hair look becomes a mega rooster (D71: no wings — a huge comb, wattles and sickle tail). */
export const isRooster = (l: Look) => l.body === 'big' && l.hairColor === 'c2452d';

/** Which concrete layer ids a look uses, back to front. */
export function layersOf(l: Look, mutant: boolean): { id: string; tint: 'skin' | 'hair' | 'top' | 'legs' | 'feet' | 'none'; part: string }[] {
  const big = l.body === 'big';
  const g = l.body === 'f' ? 'f' : 'm';
  const top = g === 'f'
    ? ({ shirt: 'blouse', jacket: 'long', vest: 'long', plate: 'long', leather: 'long', apron: 'long' } as Record<string, string>)[l.top] ?? l.top
    : l.top === 'blouse' ? 'shirt' : l.top === 'tank' ? 'tee' : l.top;
  const legs = g === 'm' && l.legs === 'skirt' ? 'formal' : l.legs;
  const head = big ? 'head_plump' : l.old ? `head_old_${g}` : `head_${g}`;
  const out: ReturnType<typeof layersOf> = [];
  const rooster = mutant && isRooster(l);
  if (l.hair === 'ponytail' && !mutant) out.push({ id: 'hair_ponytail_bg', tint: 'hair', part: 'hair' });
  out.push({ id: big ? 'body_big' : `body_${g}`, tint: 'skin', part: 'body' });
  // D72: a swimsuit (tank top + short shorts on a woman) is worn barefoot
  if (!(g === 'f' && legs === 'shorts' && top === 'tank') || mutant) out.push({ id: `feet_${g}`, tint: 'feet', part: 'feet' });
  out.push({ id: `legs_${legs}_${g}`, tint: 'legs', part: 'legs' });
  out.push({ id: `top_${top}_${g}`, tint: top === 'plate' ? 'none' : 'top', part: 'top' });
  if (l.top === 'apron' && g === 'm') out.push({ id: 'top_apron_m', tint: 'top', part: 'top' });
  out.push({ id: head, tint: 'skin', part: 'head' });
  if (!mutant && (l.acc === 'beard' || l.acc === 'mustache')) out.push({ id: 'acc_' + l.acc, tint: 'hair', part: 'hair' });
  if (!mutant) out.push({ id: 'hair_' + l.hair, tint: 'hair', part: 'hair' });
  if (l.acc === 'glasses') out.push({ id: 'acc_glasses', tint: 'none', part: 'acc' });
  return out;
}

/** Recolour preserving the layer's own shading: luminance is mapped onto a dark→base→light ramp. */
function ramp(data: Uint8ClampedArray, hex: string, contrast = 1.5) {
  const base = rgb(hex);
  const dark = mix(base, [16, 12, 22], 0.62), light = mix(base, [255, 255, 255], 0.38), outline = mix(base, [10, 8, 14], 0.82);
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) {
    const l = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
    if (l > 0.2) { sum += l; n++; }
  }
  const mean = n ? sum / n : 0.5;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const l = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
    let c: number[];
    if (l <= 0.2) c = outline;
    else {
      const t = Math.max(0, Math.min(1, 0.5 + (l - mean) * contrast));
      c = t < 0.5 ? mix(dark, base, t / 0.5) : mix(base, light, (t - 0.5) / 0.5);
    }
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
  }
}

const isEye = (d: Uint8ClampedArray, i: number) => d[i + 2] > d[i] + 25 && d[i + 2] > 90;
const isSkin = (d: Uint8ClampedArray, i: number) => d[i] > d[i + 2] + 18 && d[i] > 70;

/** Multiply skin-coloured pixels toward the chosen tone; eyes and outline stay. */
function skin(data: Uint8ClampedArray, hex: string) {
  const want = rgb(hex), ref = rgb(SKIN_TONES[0]);
  const k = want.map((v, i) => v / ref[i]);
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] && isSkin(data, i)) {
    data[i] = Math.min(255, data[i] * k[0]); data[i + 1] = Math.min(255, data[i + 1] * k[1]); data[i + 2] = Math.min(255, data[i + 2] * k[2]);
  }
}

const CLAW = 'e89a2c', COMB = 'd8302a', BEAK = 'f2a531';

/** Plumage of a chicken-person: base feather colour, tuft/tail highlights, quills/outline, optional speckles. */
export interface Plumage { base: string; light: string; lighter: string; mid: string; quill: string; dark: string; speck?: string }
export const PLUMAGES: Record<'white' | 'yellow' | 'speckled' | 'rooster' | 'plant' | 'gmo' | 'fat', Plumage> = {
  white: { base: 'efe9da', light: 'f6f1e4', lighter: 'fffdf4', mid: '9d927d', quill: 'b9ad95', dark: '7d7262' },
  yellow: { base: 'eac45a', light: 'f7dc84', lighter: 'fff0b0', mid: 'b98a2a', quill: 'c99a3a', dark: '7d5a1e' },
  // «рябая»: grey-brown with dark and light flecks
  speckled: { base: 'c9bca4', light: 'e8dfcc', lighter: 'f5efe2', mid: '85776a', quill: '8f8070', dark: '574b40', speck: '3e342c' },
  rooster: { base: 'd8603a', light: 'e98a5a', lighter: 'f4b080', mid: '8f3a22', quill: 'a64a2c', dark: '6a2a18' },
  // D72: Вершков's potato-plant chickens: leafy green with earthy flecks
  plant: { base: '7fae4a', light: '9fcc66', lighter: 'c8e890', mid: '4f7a2a', quill: '5f8a32', dark: '35521c', speck: '8a5a2a' },
  // D72: the lab's GMO roosters: toxic lime with violet flecks
  gmo: { base: 'c2dc44', light: 'd8ee72', lighter: 'f0ffac', mid: '7f9a22', quill: '96b030', dark: '4f5a12', speck: '7a34a6' },
  // D72: the fattened CEO: bright yellow
  fat: { base: 'f2c53d', light: 'f9dc6e', lighter: 'fff2b0', mid: 'b88a1e', quill: 'c99a2a', dark: '7a5612' },
};
/** Deterministic plumage per look: some chicken-people are white, some yellow, some speckled. */
export function plumageOf(l: Look): Plumage {
  if (l.mut === 'plant') return PLUMAGES.plant;
  if (l.mut === 'gmo') return PLUMAGES.gmo;
  if (isRooster(l)) return l.mut === 'fat' ? PLUMAGES.fat : PLUMAGES.rooster;
  const s = JSON.stringify(l);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return [PLUMAGES.white, PLUMAGES.yellow, PLUMAGES.speckled][h % 3];
}

/** Feathered skin: everything but eyes becomes feathers, eyes turn red; speckled plumage gets flecks. */
function feathers(data: Uint8ClampedArray, pl: Plumage) {
  const eyes: number[] = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] && isEye(data, i)) eyes.push(i);
  ramp(data, pl.base, 1.1);
  if (pl.speck) {
    const dk = rgb(pl.speck), lt = rgb(pl.lighter), out = rgb(pl.base).map((v) => v * 0.18);
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3] || data[i] < out[0] + 30) continue; // keep the outline
      const p = i >> 2, x = (p % SHEET_W) % CELL, y = Math.floor(p / SHEET_W) % CELL;
      const n = (x * 7 + y * 13 + ((x * y) % 7)) % 15;
      const c = n === 0 || n === 11 ? dk : n === 6 ? lt : null;
      if (c) { data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; }
    }
  }
  for (const i of eyes) { const dark = data[i] < 170; data[i] = dark ? 140 : 255; data[i + 1] = dark ? 10 : 50; data[i + 2] = dark ? 14 : 40; }
}

function recolor(env: ComposeEnv, src: CanvasLike, fn: (d: Uint8ClampedArray) => void) {
  const c = env.canvas(SHEET_W, SHEET_H), g: Ctx = c.getContext('2d');
  g.drawImage(src as any, 0, 0);
  const img = g.getImageData(0, 0, SHEET_W, SHEET_H);
  fn(img.data);
  g.putImageData(img, 0, 0);
  return c;
}

interface Box { x0: number; x1: number; y0: number; y1: number; eyes: [number, number][] }
/** Head bounding box + eye pixels inside one cell of the (un-recoloured) head layer. */
function headBox(d: Uint8ClampedArray, cx: number, cy: number): Box | null {
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
  const eyes: [number, number][] = [];
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const i = ((cy + y) * SHEET_W + cx + x) * 4;
    if (!d[i + 3]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (isEye(d, i)) eyes.push([x, y]);
  }
  return x1 < 0 ? null : { x0, x1, y0, y1, eyes };
}

function px(g: Ctx, hex: string, x: number, y: number, w = 1, h = 1) { g.fillStyle = '#' + hex; g.fillRect(x, y, w, h); }

/** Draws comb/beak/wattle/tufts/tail for one cell. dir: 0 n, 1 w, 2 s, 3 e. */
function chickenBits(g: Ctx, ox: number, oy: number, dir: number, b: Box, hurt: boolean, pl: Plumage, mega = false) {
  const cx = Math.round((b.x0 + b.x1) / 2);
  const top = b.y0;
  const eyeY = b.eyes.length ? Math.round(b.eyes.reduce((s, e) => s + e[1], 0) / b.eyes.length) : top + 13;
  const X = (x: number) => ox + x, Y = (y: number) => oy + y;
  const outline = '4a2a20';
  if (hurt) {
    // lying / collapsing: a comb tuft and a beak at the face is enough to read
    px(g, outline, X(cx - 3), Y(top - 1), 6, 2); px(g, COMB, X(cx - 2), Y(top - 1), 4, 1);
    if (b.eyes.length) { px(g, outline, X(cx - 2), Y(eyeY + 2), 4, 3); px(g, BEAK, X(cx - 1), Y(eyeY + 2), 2, 2); }
    return;
  }
  if (mega) { megaBits(g, X, Y, cx, top, eyeY, dir, b, pl, outline); return; }
  if (pl === PLUMAGES.plant) { leafBits(g, X, Y, cx, top, eyeY, dir, b, outline); return; }
  // comb: three serrations on top of the head
  const combX = dir === 1 ? cx + 1 : dir === 3 ? cx - 1 : cx;
  px(g, outline, X(combX - 4), Y(top - 3), 9, 4);
  px(g, COMB, X(combX - 3), Y(top - 2), 7, 3);
  px(g, outline, X(combX - 3), Y(top - 4), 2, 1); px(g, outline, X(combX), Y(top - 5), 2, 2); px(g, outline, X(combX + 2), Y(top - 4), 2, 1);
  px(g, COMB, X(combX - 2), Y(top - 3), 1, 1); px(g, COMB, X(combX), Y(top - 4), 1, 2); px(g, COMB, X(combX + 2), Y(top - 3), 1, 1);
  px(g, 'ff6a52', X(combX - 1), Y(top - 2), 2, 1);
  if (dir === 2) {
    // beak pointing at the viewer + wattle
    px(g, outline, X(cx - 3), Y(eyeY + 1), 6, 5);
    px(g, BEAK, X(cx - 2), Y(eyeY + 1), 4, 2); px(g, 'c97a1a', X(cx - 1), Y(eyeY + 3), 2, 1);
    px(g, COMB, X(cx - 1), Y(eyeY + 4), 2, 2);
  } else if (dir === 1 || dir === 3) {
    const s = dir === 3 ? 1 : -1;
    const edge = dir === 3 ? b.x1 : b.x0;
    const bx = edge + s * 1;
    // beak sticks out of the face
    for (let k = 0; k < 4; k++) px(g, outline, X(bx + s * k - (s < 0 ? 0 : 0)), Y(eyeY + 1 - (k < 3 ? 1 : 0)), 1, k < 3 ? 4 : 2);
    for (let k = 0; k < 3; k++) px(g, BEAK, X(bx + s * k), Y(eyeY + 1), 1, k < 2 ? 2 : 1);
    px(g, 'c97a1a', X(bx), Y(eyeY + 2), 1, 1);
    px(g, outline, X(edge - s * 1), Y(eyeY + 3), 3, 4); px(g, COMB, X(edge - s * 1 + (s < 0 ? 1 : 0)), Y(eyeY + 3), 2, 3);
  }
  // collar tufts: feathers bursting out of the shirt at the neck
  const neckY = b.y1 + 1;
  for (const [dx, dy, l] of [[-6, 0, 3], [-4, -1, 2], [4, -1, 2], [6, 0, 3]] as const) {
    if (dir === 1 && dx > 0 || dir === 3 && dx < 0) continue;
    px(g, pl.mid, X(cx + dx), Y(neckY + dy), 1, l + 1);
    px(g, pl.lighter, X(cx + dx), Y(neckY + dy), 1, l);
  }
}

/** D72: a potato-plant chicken: a crown of potato leaves with a small flower instead of a comb, leaves at the collar. */
function leafBits(g: Ctx, X: (x: number) => number, Y: (y: number) => number, cx: number, top: number, eyeY: number, dir: number, b: Box, outline: string) {
  const LEAF = '4f9a32', HI = '8fd16b', DK = '2a4a18';
  const leaf = (x: number, y: number, h: number, lean: number) => {
    for (let k = 0; k < h; k++) { const xx = x + Math.round(lean * k / h); px(g, DK, X(xx - 1), Y(y - k), 3, 1); px(g, k > h * 0.4 ? HI : LEAF, X(xx), Y(y - k), 1, 1); }
  };
  leaf(cx - 3, top, 7, -3); leaf(cx, top, 9, 0); leaf(cx + 3, top, 7, 3);
  // a potato flower: white petals, yellow heart
  px(g, outline, X(cx - 1), Y(top - 10), 3, 3); px(g, 'f3ecd6', X(cx - 1), Y(top - 10), 3, 1); px(g, 'e8b84a', X(cx), Y(top - 9), 1, 1);
  if (dir === 2) { px(g, outline, X(cx - 3), Y(eyeY + 1), 6, 4); px(g, BEAK, X(cx - 2), Y(eyeY + 1), 4, 2); }
  else if (dir === 1 || dir === 3) {
    const s = dir === 3 ? 1 : -1, edge = dir === 3 ? b.x1 : b.x0;
    for (let k = 0; k < 3; k++) { px(g, outline, X(edge + s * (1 + k)), Y(eyeY), 1, 3); px(g, BEAK, X(edge + s * (1 + k)), Y(eyeY + 1), 1, 1); }
  }
  // leaves sprouting from the collar
  const neckY = b.y1 + 1;
  for (const dx of [-6, 6]) { if (dir === 1 && dx > 0 || dir === 3 && dx < 0) continue; leaf(cx + dx, neckY + 2, 5, dx > 0 ? 3 : -3); }
}

/** D72: the fattened CEO: a round yellow belly bursting out of the suit (front and side views). */
function belly(g: Ctx, ox: number, oy: number, dir: number, b: Box, pl: Plumage) {
  if (dir === 0) return;
  const cx = Math.round((b.x0 + b.x1) / 2) + (dir === 3 ? 4 : dir === 1 ? -4 : 0), cy = b.y1 + 11;
  const rx = dir === 2 ? 10 : 8, ry = 8;
  for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
    const d = (x * x) / ((rx + 1) * (rx + 1)) + (y * y) / ((ry + 1) * (ry + 1));
    if (d > 1) continue;
    const inner = (x * x) / (rx * rx) + (y * y) / (ry * ry);
    const col = inner > 1 ? pl.dark : inner < 0.35 && y < 2 ? pl.lighter : y > ry * 0.45 ? pl.mid : pl.base;
    px(g, col, ox + cx + x, oy + cy + y);
  }
  // a navel-button that gave up and three belly feathers
  px(g, pl.dark, ox + cx, oy + cy + 2); px(g, pl.quill, ox + cx - 4, oy + cy - 3, 2, 1); px(g, pl.quill, ox + cx + 3, oy + cy - 4, 2, 1);
}

/** D71: the boss's mega-rooster head: a tall five-point comb, long double wattles, a hooked beak, a ruff of hackles. */
function megaBits(g: Ctx, X: (x: number) => number, Y: (y: number) => number, cx: number, top: number, eyeY: number, dir: number, b: Box, pl: Plumage, outline: string) {
  const combX = dir === 1 ? cx + 1 : dir === 3 ? cx - 1 : cx;
  const RED = 'e0302a', HI = 'ff6a52';
  // comb: a solid base and five tall points
  px(g, outline, X(combX - 6), Y(top - 4), 13, 5); px(g, RED, X(combX - 5), Y(top - 3), 11, 3);
  for (const [dx, h] of [[-5, 3], [-3, 5], [-1, 7], [1, 6], [3, 4]] as const) {
    px(g, outline, X(combX + dx - 1), Y(top - 3 - h), 3, h + 1); px(g, RED, X(combX + dx), Y(top - 3 - h + 1), 1, h);
  }
  px(g, HI, X(combX - 2), Y(top - 3), 3, 1); px(g, HI, X(combX - 1), Y(top - 8), 1, 2);
  if (dir === 2) {
    px(g, outline, X(cx - 4), Y(eyeY + 1), 8, 4); px(g, BEAK, X(cx - 3), Y(eyeY + 1), 6, 2); px(g, 'c97a1a', X(cx - 1), Y(eyeY + 3), 2, 1);
    // two long wattles
    for (const dx of [-3, 1]) { px(g, outline, X(cx + dx - 1), Y(eyeY + 4), 4, 7); px(g, RED, X(cx + dx), Y(eyeY + 4), 2, 6); px(g, HI, X(cx + dx), Y(eyeY + 4), 1, 2); }
  } else if (dir === 1 || dir === 3) {
    const s = dir === 3 ? 1 : -1, edge = dir === 3 ? b.x1 : b.x0;
    for (let k = 0; k < 5; k++) px(g, outline, X(edge + s * (1 + k)), Y(eyeY - (k < 4 ? 1 : 0)), 1, k < 4 ? 4 : 3);
    for (let k = 0; k < 4; k++) px(g, BEAK, X(edge + s * (1 + k)), Y(eyeY), 1, k < 3 ? 2 : 1);
    px(g, outline, X(edge - s * 1 - 1), Y(eyeY + 3), 4, 7); px(g, RED, X(edge - s * 1), Y(eyeY + 3), 2, 6);
  }
  // hackles: a golden-orange ruff around the neck
  const neckY = b.y1 + 1;
  for (let dx = -8; dx <= 8; dx += 2) {
    if (dir === 1 && dx > 2 || dir === 3 && dx < -2) continue;
    const l = 3 + ((dx + 8) % 4 === 0 ? 1 : 0);
    px(g, pl.mid, X(cx + dx), Y(neckY - 1), 2, l + 1); px(g, 'f2b24a', X(cx + dx), Y(neckY - 1), 1, l);
  }
}

/** D71: a rooster's sickle tail: long dark-green arcs rising behind the hips (seen around the body from the front). */
function megaTail(g: Ctx, ox: number, oy: number, dir: number, b: Box, golden = false) {
  const cx = Math.round((b.x0 + b.x1) / 2), y = b.y1 + 14;
  const X = (x: number) => ox + x, Y = (v: number) => oy + v;
  // D72: the fat yellow CEO wears a golden-orange tail
  const [DARK, GREEN, SHINE] = golden ? ['5a3a10', 'c8781e', 'f2b24a'] : ['14241f', '1f5a4a', '3f9a7a'];
  // a sickle feather: rises from the hips, bends outwards and droops at the tip
  const arc = (sx: number, dirX: number, len: number, spread: number) => {
    const n = len * 2;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = sx + dirX * Math.round(spread * Math.sin(t * Math.PI * 0.75));
      const yy = y - Math.round(len * Math.sin(t * Math.PI * 0.62));
      const w = t < 0.8 ? 3 : 2;
      px(g, DARK, X(x - 1), Y(yy - 1), w + 2, 3);
      px(g, t > 0.3 && t < 0.55 ? SHINE : GREEN, X(x), Y(yy), w, 1);
    }
  };
  if (dir === 2 || dir === 0) {
    for (const [dx, len, sp] of [[-4, 20, 16], [-2, 26, 11], [-1, 22, 6], [1, 22, 6], [2, 26, 11], [4, 20, 16]] as const) arc(cx + dx, Math.sign(dx), len, sp);
  } else {
    const s = dir === 3 ? -1 : 1;
    for (const [dx, len, sp] of [[6, 18, 14], [7, 24, 12], [8, 21, 8]] as const) arc(cx + s * dx, s, len, sp);
  }
}

/** Tail plume behind the hips; drawn before the body for S, after for N/side. */
function tail(g: Ctx, ox: number, oy: number, dir: number, b: Box, pl: Plumage) {
  const cx = Math.round((b.x0 + b.x1) / 2);
  const y = b.y1 + 13;
  const X = (x: number) => ox + x, Y = (v: number) => oy + v;
  if (dir === 0) {
    // fan of tail feathers: outline row by row, cream fill, a darker quill line
    for (let r = 0; r < 8; r++) {
      const half = 2 + Math.round(r * 0.6);
      px(g, pl.dark, X(cx - half - 1), Y(y - 8 + r), half * 2 + 3, 1);
      px(g, r === 0 ? pl.quill : pl.light, X(cx - half), Y(y - 8 + r), half * 2 + 1, 1);
    }
    px(g, pl.quill, X(cx), Y(y - 6), 1, 6); px(g, pl.quill, X(cx - 3), Y(y - 4), 1, 4); px(g, pl.quill, X(cx + 3), Y(y - 4), 1, 4);
  } else if (dir === 1 || dir === 3) {
    const s = dir === 3 ? -1 : 1;
    const bx = cx + s * 9;
    for (let k = 0; k < 3; k++) { px(g, pl.dark, X(bx + s * k * 2 - 1), Y(y - 7 - k * 2), 3, 7); px(g, pl.light, X(bx + s * k * 2), Y(y - 6 - k * 2), 1, 5); }
  }
}

/** Builds the full sheet for a look. */
export function composeLook(env: ComposeEnv, look: Look, mutant: boolean): CanvasLike {
  const out = env.canvas(SHEET_W, SHEET_H);
  const g: Ctx = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  let headRaw: Uint8ClampedArray | null = null;
  const layers = layersOf(look, mutant);
  const pl = plumageOf(look);
  const paint = (l: (typeof layers)[number]) => {
    const src = env.layer(l.id);
    if (!src) return;
    if (l.part === 'head') {
      const c = env.canvas(SHEET_W, SHEET_H), hg: Ctx = c.getContext('2d');
      hg.drawImage(src as any, 0, 0);
      headRaw = hg.getImageData(0, 0, SHEET_W, SHEET_H).data;
    }
    let img: CanvasLike = src;
    if (mutant && (l.part === 'head' || l.part === 'body')) img = recolor(env, src, (d) => feathers(d, pl));
    else if (l.part === 'wings') img = recolor(env, src, (d) => ramp(d, 'c84a2c', 1.2));
    else if (mutant && l.part === 'feet') img = recolor(env, src, (d) => ramp(d, CLAW, 1.2));
    else if (l.tint === 'skin') img = recolor(env, src, (d) => skin(d, SKIN_TONES[look.skin] ?? SKIN_TONES[0]));
    else if (l.tint === 'hair') img = recolor(env, src, (d) => ramp(d, look.hairColor, 1.3));
    else if (l.tint === 'top') img = recolor(env, src, (d) => ramp(d, mutant ? dirty(look.topColor) : look.topColor));
    else if (l.tint === 'legs') img = recolor(env, src, (d) => ramp(d, look.legsColor));
    else if (l.tint === 'feet') img = recolor(env, src, (d) => ramp(d, '34363c', 1.2));
    g.drawImage(img as any, 0, 0);
  };
  if (!mutant) {
    layers.forEach(paint);
    const legs = env.canvas(SHEET_W, SHEET_H), lg: Ctx = legs.getContext('2d');
    // Clothing supplies a precise mask; body walk frames also contain swinging hands at hip height.
    for (const l of layers.filter(l => l.part === 'legs' || l.part === 'feet')) {
      const im = env.layer(l.id); if (im) lg.drawImage(im as any, 0, 0);
    }
    return armedSheet(env, out, lg.getImageData(0, 0, SHEET_W, SHEET_H).data);
  }

  // mutants: tail behind (side/back views), body, then comb/beak/tufts on top
  const head = env.layer(layersOf(look, true).find((l) => l.part === 'head')!.id);
  if (head) {
    const hc = env.canvas(SHEET_W, SHEET_H), hg: Ctx = hc.getContext('2d');
    hg.drawImage(head as any, 0, 0);
    headRaw = hg.getImageData(0, 0, SHEET_W, SHEET_H).data;
  }
  const boxes: (Box | null)[] = [];
  for (let row = 0; row < 5; row++) for (let f = 0; f < 9; f++) boxes.push(headRaw && (row < 4 || f < 6) ? headBox(headRaw, f * CELL, row * CELL) : null);
  const mega = isRooster(look) || look.mut === 'gmo';
  for (let row = 0; row < 4; row++) for (let f = 0; f < 9; f++) {
    const b = boxes[row * 9 + f];
    if (b && isRooster(look) && row !== 0) megaTail(g, f * CELL, row * CELL, row, b, look.mut === 'fat');
    else if (b && row !== 0) tail(g, f * CELL, row * CELL, row, b, pl);
  }
  layers.forEach(paint);
  for (let row = 0; row < 5; row++) for (let f = 0; f < (row < 4 ? 9 : 6); f++) {
    const b = boxes[row * 9 + f];
    if (!b) continue;
    if (row === 0) { if (isRooster(look)) megaTail(g, f * CELL, row * CELL, 0, b, look.mut === 'fat'); else tail(g, f * CELL, row * CELL, 0, b, pl); }
    if (look.mut === 'fat' && row < 4) belly(g, f * CELL, row * CELL, row, b, pl);
    chickenBits(g, f * CELL, row * CELL, row < 4 ? row : 2, b, row === 4 && f >= 3, pl, mega);
  }
  return out;
}

/** Mutants wear their clothes a bit grimier. */
function dirty(hex: string) {
  const c = mix(rgb(hex), [110, 98, 80], 0.22);
  return c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** Upper body from the armed pose (hands forward, row 5) over the walking legs; stray walk hands below the seam are removed. */
function armedSheet(env: ComposeEnv, sheet: CanvasLike, legs: Uint8ClampedArray): CanvasLike {
  const out = env.canvas(SHEET_W, ARMED_H), g: Ctx = out.getContext('2d');
  g.drawImage(sheet as any, 0, 0);
  const src = (sheet.getContext('2d') as Ctx).getImageData(0, 0, SHEET_W, SHEET_H).data;
  const img = g.getImageData(0, SHEET_H, SHEET_W, 4 * CELL), d = img.data;
  const at = (x: number, y: number) => (y * SHEET_W + x) * 4;
  for (let row = 0; row < 4; row++) for (let f = 0; f < 9; f++) {
    const ox = f * CELL, oy = row * CELL;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      let i: number;
      if (y < ARMED_SPLIT) i = at(row * CELL + x, 5 * CELL + y);
      else {
        i = at(ox + x, oy + y);
        if (!legs[i + 3]) continue;
      }
      if (!src[i + 3]) continue;
      const o = ((row * CELL + y) * SHEET_W + ox + x) * 4;
      d[o] = src[i]; d[o + 1] = src[i + 1]; d[o + 2] = src[i + 2]; d[o + 3] = src[i + 3];
    }
  }
  g.putImageData(img, 0, SHEET_H);
  return out;
}
