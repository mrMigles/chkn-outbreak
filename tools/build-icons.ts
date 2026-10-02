// PWA icons (D61): a mutated office worker — the game's own LPC chicken-person — on the menu's dark panel.
//   npx tsx tools/build-icons.ts  → public/icons/icon-{192,512}.png, maskable-512.png, apple-touch-icon.png
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { LAYERS, layerFile } from './art/lpc-layers.mjs';
import { composeLook, SHEET_W, SHEET_H, type ComposeEnv } from '../src/client/render/compose';
import { LOOK_PRESETS, resolveLook } from '../src/shared/look';

const strips = new Map<string, any>();
for (const l of LAYERS) {
  const c = createCanvas(SHEET_W, SHEET_H), g = c.getContext('2d');
  g.drawImage(await loadImage('vendor/lpc-characters/spritesheets/' + layerFile(l, 'walk')), 0, 0);
  strips.set(l.id, c);
}
const env: ComposeEnv = { layer: (id) => strips.get(id) ?? null, canvas: (w, h) => createCanvas(w, h) as any };
const sheet = composeLook(env, resolveLook(LOOK_PRESETS[process.env.ICON_LOOK || 'oleg'] ?? 'oleg'), true) as any;
// south-facing standing frame, head and shoulders
const src = { x: 12, y: 128 + 6, w: 40, h: 40 };

function icon(size: number, safe: number, round: boolean) {
  const c = createCanvas(size, size), g = c.getContext('2d');
  g.fillStyle = '#1b1d21';
  if (round) { g.beginPath(); g.roundRect(0, 0, size, size, size * 0.22); g.fill(); } else g.fillRect(0, 0, size, size);
  const grd = g.createRadialGradient(size / 2, size * 0.5, size * 0.05, size / 2, size * 0.5, size * 0.5);
  grd.addColorStop(0, 'rgba(255,190,70,0.6)'); grd.addColorStop(1, 'rgba(255,190,70,0)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const k = Math.max(1, Math.floor(size * safe / src.w)), w = src.w * k, h = src.h * k;
  g.imageSmoothingEnabled = false;
  g.drawImage(sheet, src.x, src.y, src.w, src.h, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
  return c.toBuffer('image/png');
}
fs.mkdirSync('public/icons', { recursive: true });
fs.writeFileSync('public/icons/icon-192.png', icon(192, 0.8, true));
fs.writeFileSync('public/icons/icon-512.png', icon(512, 0.8, true));
fs.writeFileSync('public/icons/maskable-512.png', icon(512, 0.62, false));
fs.writeFileSync('public/icons/apple-touch-icon.png', icon(180, 0.75, false));
console.log('icons written to public/icons');
