import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
const [src, out, x, y, w, h, sc, bg] = process.argv.slice(2);
const im = await loadImage(src);
const c = createCanvas(w*sc, h*sc); const g = c.getContext('2d');
g.fillStyle = bg || '#c98948'; g.fillRect(0,0,c.width,c.height);
g.imageSmoothingEnabled = false;
g.drawImage(im, +x, +y, +w, +h, 0, 0, w*sc, h*sc);
fs.writeFileSync(out, c.toBuffer('image/png'));
