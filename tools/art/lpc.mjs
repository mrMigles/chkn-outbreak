// Office prototype: public LPC layers, integer scaling, no generated AI artwork.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import path from 'node:path';

const PEOPLE = {
  survivor: '#658ca8', soldier: '#6f8060', womanGreen: '#a57165', hitman: '#53576d',
  manBlue: '#749ea1', manBrown: '#b59b74', manOld: '#a3a594', robot: '#797e91', zombie: '#73875d',
};
export const LPC_KINDS = Object.keys(PEOPLE);

function canvas(w, h) { const c = createCanvas(w, h); c.getContext('2d').imageSmoothingEnabled = false; return c; }
function cut(img, x, y, w, h, scale = 2) {
  if (x < 0 || y < 0 || x + w > img.width || y + h > img.height) throw new Error(`LPC crop outside source: ${x},${y},${w},${h} in ${img.width}x${img.height}`);
  const c = canvas(w * scale, h * scale);
  c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, c.width, c.height); return c;
}
function colour(c, hex) {
  const out = canvas(c.width, c.height), g = out.getContext('2d'); g.drawImage(c, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height), channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.data.length; i += 4) if (data.data[i + 3]) {
    const light = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / (3 * 255);
    channels.forEach((v, ch) => { data.data[i + ch] = Math.round(v * light); });
  }
  g.putImageData(data, 0, 0); return out;
}

export async function buildLpc(root) {
  const office = p => path.join(root, 'vendor/lpc-office', p);
  const source = p => path.join(root, 'vendor/lpc-characters/spritesheets', p);
  const layers = await Promise.all([
    'body/bodies/male/walk.png', 'legs/formal/male/walk.png', 'feet/shoes/basic/male/walk.png',
    'torso/clothes/longsleeve/formal/male/walk.png', 'head/heads/human/male/walk.png', 'hair/parted/adult/walk.png',
  ].map(p => loadImage(source(p))));
  const chicken = await loadImage(path.join(root, 'vendor/lpc-characters/chicken.png'));
  const people = [];
  const directions = ['n', 'w', 's', 'e']; // LPC walking row order
  const chickenRows = [0, 3, 2, 1];       // Stendhal N/E/S/W -> LPC N/W/S/E
  for (const [kind, shirt] of Object.entries(PEOPLE)) for (let row = 0; row < 4; row++) for (let frame = 0; frame < 9; frame++) {
    const person = canvas(64, 64), g = person.getContext('2d');
    for (let l = 0; l < layers.length; l++) {
      const crop = cut(layers[l], frame * 64, row * 64, 64, 64, 1);
      g.drawImage(l === 1 ? colour(crop, '#485366') : l === 2 ? colour(crop, '#34363c') : l === 3 ? colour(crop, shirt) : l === 5 ? colour(crop, kind === 'manOld' ? '#acaaaa' : '#674630') : crop, 0, 0);
    }
    const key = `${kind}_${directions[row]}_${frame}`;
    people.push({ name: key, canvas: person });
    const mutant = canvas(64, 64), mg = mutant.getContext('2d');
    // Retain actual coworker clothing/legs. Replace the head with the public bird's upper body.
    mg.drawImage(person, 0, 28, 64, 36, 0, 28, 64, 36);
    const headRect = [[9,0,14,17],[0,3,13,15],[9,0,14,17],[19,3,13,15]][row];
    const [hx,hy,hw,hh] = headRect;
    const bird = cut(chicken, (frame % 3) * 32 + hx, chickenRows[row] * 32 + hy, hw, hh, 2);
    mg.drawImage(bird, (64 - bird.width) / 2, 4 + (frame % 2));
    people.push({ name: 'mut_' + key, canvas: mutant });
  }
  const props = [], meta = {};
  const add = (name, c, feetY = c.height - 8, facing = ['s']) => {
    props.push({ name, canvas: c }); meta[name] = { feetX: c.width / 2, feetY, facing };
  };
  const deskSheet = await loadImage(office('source/Desk, Ornate.png'));
  const laptop = await loadImage(office('source/Laptop.png'));
  for (const key of ['desk', 'desk_b']) {
    const c = canvas(128, 96), g = c.getContext('2d');
    g.drawImage(cut(deskSheet, 0, 0, 32, 48), 0, 0);
    g.drawImage(cut(deskSheet, 64, 0, 32, 48), 64, 0);
    g.drawImage(cut(laptop, key === 'desk' ? 0 : 32, 0, 32, 32), 32, -5);
    add(key, c, 83);
  }
  const specs = [
    ['water_cooler','source/Water Cooler.png',[0,0,32,64]],
    ['printer','source/Copy Machine.png',[0,0,64,64]],
    ['plant','objects/Objects/Decoration/Planters.png',[128,32,32,54]],
    ['plant_small','objects/Objects/Decoration/Planters.png',[128,32,32,54]],
    ['cabinet','objects/Objects/Storage/Cabinets.png',[0,0,32,96]],
    ['office_chair','objects/Objects/Furniture/Chairs, Dining.png',[128,0,32,32]],
    ['bin','source/Bins.png',[0,0,32,32]],
  ];
  for (const [name, file, rect] of specs) add(name, cut(await loadImage(office(file)), ...rect));
  const floors = [];
  const wood = await loadImage(office('structure/Structure/Floor/Wood Floor A.png'));
  const tile = await loadImage(office('structure/Structure/Floor/Tile A.png'));
  for (let i = 0; i < 3; i++) floors.push({ name: 'floor_wood_' + i, canvas: cut(wood, 96 + i * 32, 96, 32, 32) });
  floors.push({ name: 'floor_tile', canvas: cut(tile, 0, 0, 32, 32) });
  const wall = await loadImage(office('structure/Structure/Walls/Painted Walls.png'));
  const panel = await loadImage(office('structure/Structure/Walls/Half-Wall Paneling A.png'));
  const face = canvas(64, 112), fg = face.getContext('2d');
  fg.drawImage(wall, 1152, 0, 96, 96, 0, 0, 64, 112);
  fg.drawImage(cut(panel, 0, 0, 32, 32), 0, 48);
  fg.fillStyle = '#43404a'; fg.fillRect(0, 0, 64, 8);
  fg.fillStyle = '#716674'; fg.fillRect(0, 0, 64, 2);
  fg.fillStyle = '#50423b'; fg.fillRect(0, 106, 64, 6);
  props.push({ name: 'wall_face', canvas: face });
  return { people, props: [...props, ...floors], meta, floors };
}
