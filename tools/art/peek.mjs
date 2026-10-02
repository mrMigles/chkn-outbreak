// Dev helper: render a source PNG upscaled with a labelled grid for picking crop rects.
//   node tools/art/peek.mjs <in.png> <out.png> [scale=3] [grid=32]
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
const [, , input, output, s = '3', gr = '32'] = process.argv;
const scale = Number(s), grid = Number(gr);
const img = await loadImage(input);
const c = createCanvas(img.width * scale + 30, img.height * scale + 20), g = c.getContext('2d');
g.fillStyle = '#ff00ff40'; g.fillRect(0, 0, c.width, c.height);
g.fillStyle = '#556'; for (let y = 0; y < c.height; y += 8) for (let x = (y / 8) % 2 * 8; x < c.width; x += 16) g.fillRect(x, y, 8, 8);
g.imageSmoothingEnabled = false; g.drawImage(img, 30, 20, img.width * scale, img.height * scale);
g.strokeStyle = '#00ffff80'; g.fillStyle = '#ff0'; g.font = '10px sans-serif';
for (let x = 0; x <= img.width; x += grid) { g.beginPath(); g.moveTo(30 + x * scale + .5, 20); g.lineTo(30 + x * scale + .5, c.height); g.stroke(); g.fillText(String(x), 30 + x * scale + 2, 12); }
for (let y = 0; y <= img.height; y += grid) { g.beginPath(); g.moveTo(30, 20 + y * scale + .5); g.lineTo(c.width, 20 + y * scale + .5); g.stroke(); g.fillText(String(y), 2, 20 + y * scale + 10); }
fs.writeFileSync(output, c.toBuffer('image/png'));
