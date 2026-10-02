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
for(const atlas of ['lpc','office25']) {
  const data=JSON.parse(fs.readFileSync(`public/assets/gen/${atlas}.json`,'utf8'));
  const image=await loadImage(`public/assets/gen/${atlas}.png`);
  if(image.width>4096 || image.height>4096) throw new Error('Atlas exceeds texture budget');
  for(const [name,{frame}] of Object.entries(data.frames)) if(frame.x<0 || frame.y<0 || frame.x+frame.w>image.width || frame.y+frame.h>image.height) throw new Error('Invalid atlas frame: '+name);
  console.log(`PASS ${atlas}: ${Object.keys(data.frames).length} frames within ${image.width}x${image.height}`);
}
// every compositor layer is in the lpc atlas
const { LAYERS } = await import('./art/lpc-layers.mjs');
const lpcFrames = JSON.parse(fs.readFileSync('public/assets/gen/lpc.json','utf8')).frames;
for (const l of LAYERS) if (!lpcFrames[l.id] || lpcFrames[l.id].frame.w !== 576 || lpcFrames[l.id].frame.h !== 384) throw new Error('Missing/invalid LPC layer strip: ' + l.id);
// every standing prop placed on a map has 2.5D art (flat floor details may keep legacy art)
const FLAT = new Set(['oil', 'note', 'blood_trail', 'feather_pile', 'plates']);
const office = JSON.parse(fs.readFileSync('public/assets/gen/office25.json','utf8')).frames;
const missing = new Set();
for (const f of fs.readdirSync('public/assets/maps')) {
  const m = JSON.parse(fs.readFileSync('public/assets/maps/' + f, 'utf8'));
  for (const layer of m.layers) for (const o of layer.objects ?? []) if (o.type === 'prop' && !FLAT.has(o.name) && !office[o.name]) missing.add(f + ':' + o.name);
}
if (missing.size) throw new Error('Props without 2.5D art: ' + [...missing].join(', '));
for (const id of ['pistol','smg','shotgun','rifle','machinegun','grenade','flamethrower']) if (!office['gun_' + id]) throw new Error('Missing gun art ' + id);
for (const t of ['office','lab','industrial']) if (!office['wall_face_' + t] || !office['door_' + t] || !office['door_' + t + '_side']) throw new Error('Missing wall/door art for ' + t);
console.log('PASS pinned source hashes, ' + LAYERS.length + ' LPC layers, all map props / guns / walls / doors have 2.5D art');
