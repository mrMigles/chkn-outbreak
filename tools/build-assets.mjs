// Builds every runtime texture into public/assets/gen + metadata into src/shared/generated.
//   node tools/build-assets.mjs
// Sources: vendor/kenney-topdown-shooter (CC0) + procedural art in tools/art/*.
import fs from 'node:fs';
import path from 'node:path';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { packAtlas } from './art/lib.mjs';
import { CHICKENS, drawChicken, drawHand, drawEgg } from './art/characters.mjs';
import { WEAPON_ART, PICKUP_ART } from './art/weapons.mjs';
import { FX_ART } from './art/fx.mjs';
import { buildWallSheet } from './art/walls.mjs';
import { KENNEY_PROPS, NEW_PROPS, cutKenney } from './art/props.mjs';
import { buildLpc } from './art/lpc.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const VENDOR = path.join(ROOT, 'vendor/kenney-topdown-shooter');
const OUT = path.join(ROOT, 'public/assets/gen');
const META_OUT = path.join(ROOT, 'src/shared/generated');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(META_OUT, { recursive: true });

const save = (name, canvas) => fs.writeFileSync(path.join(OUT, name), canvas.toBuffer('image/png'));
const writeAtlas = (name, items, maxW) => {
  const { canvas, json } = packAtlas(items, name + '.png', maxW);
  save(name + '.png', canvas);
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(json));
  console.log(`atlas ${name}: ${items.length} frames, ${canvas.width}x${canvas.height}`);
};

// 1) Kenney tilesheet (floors, decor tiles)
fs.copyFileSync(path.join(VENDOR, 'Tilesheet/tilesheet_complete.png'), path.join(OUT, 'tiles.png'));
const sheet = await loadImage(path.join(VENDOR, 'Tilesheet/tilesheet_complete.png'));

// 2) Walls
const walls = buildWallSheet();
save('walls.png', walls.canvas);

// 3) Characters atlas
const chars = [];
const KENNEY_CHARS = {
  survivor: 'Survivor 1/survivor1', soldier: 'Soldier 1/soldier1', hitman: 'Hitman 1/hitman1',
  womanGreen: 'Woman Green/womanGreen', manBlue: 'Man Blue/manBlue', manBrown: 'Man Brown/manBrown',
  manOld: 'Man Old/manOld', robot: 'Robot 1/robot1', zombie: 'Zombie 1/zoimbie1',
};
for (const [key, p] of Object.entries(KENNEY_CHARS)) {
  for (const pose of ['stand', 'hold', 'gun', 'machine', 'reload']) {
    const img = await loadImage(path.join(VENDOR, 'PNG', p + '_' + pose + '.png'));
    const c = createCanvas(img.width, img.height);
    c.getContext('2d').drawImage(img, 0, 0);
    chars.push({ name: `${key}_${pose}`, canvas: c });
  }
}
for (const [key, def] of Object.entries(CHICKENS)) {
  const poses = def.armed ? [['armed', 0], ['dead', 0]] : [['walk', 0], ['walk', 1], ['walk', 2], ['walk', 3], ['attack', 0], ['dead', 0]];
  for (const [pose, f] of poses) chars.push({ name: `ck_${key}_${pose}${pose === 'walk' ? f : ''}`, canvas: drawChicken(def, pose, f) });
}
const bossDef = { scale: 3.0, shirt: '#1f2a3a', head: '#d0532b', comb: 1.5, acc: 'tie', tie: '#d4af37', rooster: true, wide: 1.15 };
for (const [pose, f] of [['walk', 0], ['walk', 1], ['walk', 2], ['walk', 3], ['attack', 0], ['dead', 0]]) {
  chars.push({ name: `boss_${pose}${pose === 'walk' ? f : ''}`, canvas: drawChicken(bossDef, pose, f) });
}
for (const k of ['glove', 'skin', 'skin2', 'skin3', 'claw']) chars.push({ name: 'hand_' + k, canvas: drawHand(k) });
const weaponMeta = {};
for (const [k, fn] of Object.entries(WEAPON_ART)) {
  const { canvas, meta } = fn();
  chars.push({ name: 'w_' + k, canvas });
  weaponMeta[k] = meta;
}
for (const [k, fn] of Object.entries(PICKUP_ART)) chars.push({ name: 'pk_' + k, canvas: fn() });
chars.push({ name: 'egg', canvas: drawEgg() });
chars.push({ name: 'egg_big', canvas: drawEgg(26, 32) });
writeAtlas('chars', chars);

// 4) FX atlas
writeAtlas('fx', Object.entries(FX_ART).map(([name, fn]) => ({ name, canvas: fn() })));

// 5) Props atlas
const props = [];
const propSizes = {};
for (const [k, spec] of Object.entries(KENNEY_PROPS)) props.push({ name: k, canvas: cutKenney(sheet, spec) });
for (const [k, fn] of Object.entries(NEW_PROPS)) props.push({ name: k, canvas: fn() });
for (const p of props) propSizes[p.name] = [p.canvas.width, p.canvas.height];
writeAtlas('props', props);
const lpc = await buildLpc(ROOT);
writeAtlas('lpc', lpc.people, 4096);
writeAtlas('office25', lpc.props);
// tiles25: Kenney tile layout, every floor/rug index used by the maps replaced with LPC floors (×2)
const tiles25 = createCanvas(sheet.width, sheet.height), og = tiles25.getContext('2d');
og.imageSmoothingEnabled = false; og.drawImage(sheet, 0, 0);
for (const f of lpc.floors) { og.clearRect((f.index % 27) * 64, Math.floor(f.index / 27) * 64, 64, 64); og.drawImage(f.canvas, (f.index % 27) * 64, Math.floor(f.index / 27) * 64); }
save('tiles25.png', tiles25);

// 6) metadata for shared code
const meta = {
  wall: { cols: walls.cols, perTheme: walls.perTheme, lookup: walls.lookup, themes: ['office', 'lab', 'industrial'] },
  weapons: weaponMeta,
  props: propSizes,
  office25: lpc.meta,
  guns: lpc.gunMeta,
};
fs.writeFileSync(path.join(META_OUT, 'artMeta.json'), JSON.stringify(meta, null, 1));
console.log('done');
