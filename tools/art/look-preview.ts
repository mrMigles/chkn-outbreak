// Dev preview: composes looks from vendor layers into a contact sheet.
//   npx tsx tools/art/look-preview.ts out.png [scale]
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import { LAYERS, layerFile } from './lpc-layers.mjs';
import { composeLook, SHEET_W, SHEET_H, type ComposeEnv } from '../../src/client/render/compose';
import { LOOK_PRESETS, resolveLook, enemyLook } from '../../src/shared/look';

const strips = new Map<string, any>();
for (const l of LAYERS) {
  const c = createCanvas(SHEET_W, SHEET_H), g = c.getContext('2d');
  g.drawImage(await loadImage('vendor/lpc-characters/spritesheets/' + layerFile(l, 'walk')), 0, 0);
  g.drawImage(await loadImage('vendor/lpc-characters/spritesheets/' + layerFile(l, 'hurt')), 0, 256);
  const thrust = await loadImage('vendor/lpc-characters/spritesheets/' + layerFile(l, 'thrust'));
  for (let d = 0; d < 4; d++) g.drawImage(thrust, 256, d * 64, 64, 64, d * 64, 320, 64, 64);
  strips.set(l.id, c);
}
const env: ComposeEnv = { layer: (id) => strips.get(id) ?? null, canvas: (w, h) => createCanvas(w, h) as any };
const out = process.argv[2] ?? 'preview.png', scale = Number(process.argv[3] ?? 3);
const keys = (process.argv[4] ?? 'p0,p1,p2,p3,galina,arkady,petrovich,oleg').split(',');
const looks = keys.map((k) => k.startsWith('enemy:') ? enemyLook(k.split(':')[1] as any, 7) : LOOK_PRESETS[k] ?? k);
// S,E,N,W walk, S walk3, E walk5, hurt5; with ARMED=1: armed S,E,N,W idle + S walk3, E walk5, W walk2
const cols = (process.env.ARMED ? [[8, 0], [9, 0], [6, 0], [7, 0], [8, 3], [9, 5], [7, 2]] : [[2, 0], [3, 0], [0, 0], [1, 0], [2, 3], [3, 5], [4, 5]]) as [number, number][];
const sheet = createCanvas(cols.length * 2 * 64 * scale, looks.length * 64 * scale), sg = sheet.getContext('2d');
sg.fillStyle = '#6f6a62'; sg.fillRect(0, 0, sheet.width, sheet.height); sg.imageSmoothingEnabled = false;
looks.forEach((key, i) => {
  for (const [m, mutant] of (process.env.ARMED ? [[0, false]] : [[0, false], [1, true]]) as [number, boolean][]) {
    const c = composeLook(env, resolveLook(key), mutant) as any;
    cols.forEach(([row, f], j) => sg.drawImage(c, f * 64, row < 6 ? row * 64 : SHEET_H + (row - 6) * 64, 64, 64, (m * cols.length + j) * 64 * scale, i * 64 * scale, 64 * scale, 64 * scale));
  }
});
fs.writeFileSync(out, sheet.toBuffer('image/png'));
