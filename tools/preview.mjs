// Dev utility: render atlas frames onto a floor-tile background for visual review.
//   node tools/preview.mjs <atlas> <out.png> <scale> <frame|prefix*> ...
import fs from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const [atlas, out, scaleS, ...names] = process.argv.slice(2);
const sc = +scaleS || 2;
const json = JSON.parse(fs.readFileSync(`public/assets/gen/${atlas}.json`, 'utf8'));
const img = await loadImage(`public/assets/gen/${atlas}.png`);
const tiles = await loadImage('public/assets/gen/tiles.png');
const all = Object.keys(json.frames);
const list = names.flatMap((n) => (n.endsWith('*') ? all.filter((k) => k.startsWith(n.slice(0, -1))) : [n]));
const cell = Math.max(...list.map((n) => Math.max(json.frames[n].frame.w, json.frames[n].frame.h))) + 8;
const cols = Math.min(list.length, Math.max(1, Math.floor(1600 / (cell * sc))));
const rows = Math.ceil(list.length / cols);
const c = createCanvas(cols * cell * sc, rows * cell * sc);
const g = c.getContext('2d');
g.imageSmoothingEnabled = false;
// wood floor (tile 41) background
for (let y = 0; y < c.height; y += 64 * sc) for (let x = 0; x < c.width; x += 64 * sc) g.drawImage(tiles, (41 % 27) * 64, Math.floor(41 / 27) * 64, 64, 64, x, y, 64 * sc, 64 * sc);
list.forEach((n, i) => {
  const f = json.frames[n].frame;
  const cx = (i % cols) * cell * sc + (cell * sc - f.w * sc) / 2;
  const cy = Math.floor(i / cols) * cell * sc + (cell * sc - f.h * sc) / 2;
  g.drawImage(img, f.x, f.y, f.w, f.h, cx, cy, f.w * sc, f.h * sc);
});
fs.writeFileSync(out, c.toBuffer('image/png'));
console.log(list.length, 'frames');
