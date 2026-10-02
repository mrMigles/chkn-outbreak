import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadImage } from '@napi-rs/canvas';

const manifest = JSON.parse(fs.readFileSync('vendor/lpc-characters/manifest.json','utf8'));
for (const entry of manifest.assets) {
  const bytes=fs.readFileSync('vendor/lpc-characters/'+entry.file);
  if(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()!==entry.sha256) throw new Error('Source changed: '+entry.file);
}
const officeManifest = JSON.parse(fs.readFileSync('vendor/lpc-office/manifest.json','utf8'));
for (const entry of officeManifest.assets) {
  const bytes = fs.readFileSync('vendor/lpc-office/' + entry.file);
  if (crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase() !== entry.sha256) throw new Error('Archive changed: ' + entry.file);
}
if (crypto.createHash('sha256').update(fs.readFileSync('vendor/lpc-characters/chicken.png')).digest('hex').toUpperCase() !== '3570C9C136ACBD047FD84511AD4B0F77F662C88CA2F6467E4E76D072A0ACA9B6') throw new Error('Chicken source changed');
for(const atlas of ['people25','office25']) {
  const data=JSON.parse(fs.readFileSync(`public/assets/gen/${atlas}.json`,'utf8'));
  const image=await loadImage(`public/assets/gen/${atlas}.png`);
  if(image.width>4096 || image.height>4096) throw new Error('Atlas exceeds prototype texture budget');
  for(const [name,{frame}] of Object.entries(data.frames)) if(frame.x<0 || frame.y<0 || frame.x+frame.w>image.width || frame.y+frame.h>image.height) throw new Error('Invalid atlas frame: '+name);
  console.log(`PASS ${atlas}: ${Object.keys(data.frames).length} frames within ${image.width}x${image.height}`);
}
const frames=JSON.parse(fs.readFileSync('public/assets/gen/people25.json','utf8')).frames;
for(const kind of ['survivor','soldier','womanGreen','hitman','manBlue','manBrown','manOld','robot','zombie'])
  for(const dir of ['n','w','s','e']) for(let i=0;i<9;i++) for(const prefix of ['', 'mut_'])
    if(!frames[`${prefix}${kind}_${dir}_${i}`]) throw new Error('Missing character direction/frame');
console.log('PASS pinned source hashes, four directions, walking frames and mutant variants');
