// Compiles tools/levels/*.ts (ASCII level sources) into Tiled JSON maps in public/assets/maps.
//   npx tsx tools/build-maps.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { LevelSource, ObjSpec, Theme } from './levels/types';
import { canonical } from './art/walls.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const META = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/shared/generated/artMeta.json'), 'utf8'));
const OUT = path.join(ROOT, 'public/assets/maps');
fs.mkdirSync(OUT, { recursive: true });

const T = 64;
const KENNEY_GID = 1, KENNEY_COUNT = 27 * 20;
const WALL_GID = KENNEY_GID + KENNEY_COUNT;
const THEMES: Theme[] = META.wall.themes;

function rnd(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function prop(name: string, v: unknown) {
  const type = typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float') : typeof v === 'boolean' ? 'bool' : 'string';
  return { name, type, value: v };
}

export function compile(src: LevelSource) {
  const H = src.grid.length;
  const W = Math.max(...src.grid.map((r) => r.length));
  const r = rnd(src.id.length * 7919 + W * 31 + H);
  const floor = new Array(W * H).fill(0);
  const decor = new Array(W * H).fill(0);
  const wallTheme: (Theme | null)[] = new Array(W * H).fill(null);
  const isWall = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || wallTheme[y * W + x] !== null || floor[y * W + x] === 0;
  const objects: any[] = [];
  let oid = 1;
  const doorCells = new Map<string, { x: number; y: number; spec: NonNullable<LevelSource['legend'][string]['door']> }[]>();

  const addObj = (o: ObjSpec) => {
    const base: any = { id: oid++, name: o.name ?? '', type: o.type, rotation: 0, visible: true };
    const props = { ...(o.props ?? {}) };
    if (o.type === 'prop') {
      const size = META.props[o.name!];
      if (!size) throw new Error(`${src.id}: unknown prop ${o.name}`);
      const rot = ((o.rot ?? 0) % 360 + 360) % 360;
      const [w, h] = rot % 180 === 90 ? [size[1], size[0]] : size;
      base.x = o.at[0] * T - w / 2; base.y = o.at[1] * T - h / 2; base.width = w; base.height = h;
      if (rot) props.rot = rot;
    } else if (o.size) {
      base.x = o.at[0] * T; base.y = o.at[1] * T; base.width = o.size[0] * T; base.height = o.size[1] * T;
    } else {
      base.x = o.at[0] * T; base.y = o.at[1] * T; base.width = 0; base.height = 0; base.point = true;
    }
    const pl = Object.entries(props).map(([k, v]) => prop(k, v));
    if (pl.length) base.properties = pl;
    objects.push(base);
  };

  const placeCell = (ch: string, x: number, y: number, legend: Record<string, any>) => {
    const c = legend[ch];
    if (!c) throw new Error(`${src.id}: no legend for '${ch}' at ${x},${y}`);
    const i = y * W + x;
    if (c.floor !== undefined) {
      const f = Array.isArray(c.floor) ? c.floor[Math.floor(r() * c.floor.length)] : c.floor;
      floor[i] = f + KENNEY_GID;
    }
    if (c.wall) { wallTheme[i] = c.wall === true ? src.theme : c.wall; if (!floor[i]) floor[i] = 1; }
    if (c.decor !== undefined) decor[i] = c.decor + KENNEY_GID;
    if (c.obj) addObj({ ...c.obj, at: [x + 0.5 + (c.obj.dx ?? 0), y + 0.5 + (c.obj.dy ?? 0)] });
    if (c.door) {
      const key = ch + ':' + c.door.id;
      if (!doorCells.has(key)) doorCells.set(key, []);
      doorCells.get(key)!.push({ x, y, spec: c.door });
    }
  };

  src.grid.forEach((row, y) => [...row.padEnd(W, ' ')].forEach((ch, x) => { if (ch !== ' ') placeCell(ch, x, y, src.legend); }));
  src.overlay?.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ' ' || ch === '.') return;
    placeCell(ch, x, y, src.overlayLegend ?? {});
  }));

  // doors: group cells per id → one rect, thin slab oriented across the opening
  for (const cells of doorCells.values()) {
    const xs = cells.map((c) => c.x), ys = cells.map((c) => c.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const horizontal = isWall(x0 - 1, y0) && isWall(x1 + 1, y0); // walls left/right → slab spans X
    const spec = cells[0].spec;
    const props: Record<string, string | number | boolean> = { theme: spec.theme ?? src.theme };
    if (spec.locked) props.locked = spec.locked;
    if (horizontal) addObj({ type: 'door', name: spec.id, at: [x0, y0 + 0.5 - 0.125], size: [x1 - x0 + 1, 0.25], props: { ...props, dir: 'h' } });
    else addObj({ type: 'door', name: spec.id, at: [x0 + 0.5 - 0.125, y0], size: [0.25, y1 - y0 + 1], props: { ...props, dir: 'v' } });
  }

  for (const [x, y, w, h, col] of src.rugs ?? []) {
    const base = col === 'orange' ? 369 : 372;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const cx = xx === 0 ? 0 : xx === w - 1 ? 2 : 1;
      const cy = yy === 0 ? 0 : yy === h - 1 ? 2 : 1;
      decor[(y + yy) * W + x + xx] = base + cy * 27 + cx + KENNEY_GID;
    }
  }
  for (const o of src.objects ?? []) addObj(o);

  // walls autotile
  const walls = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const th = wallTheme[y * W + x];
    if (!th) continue;
    let m = 0;
    if (isWall(x, y - 1)) m |= 1;
    if (isWall(x + 1, y)) m |= 2;
    if (isWall(x, y + 1)) m |= 4;
    if (isWall(x - 1, y)) m |= 8;
    if (isWall(x + 1, y - 1)) m |= 16;
    if (isWall(x + 1, y + 1)) m |= 32;
    if (isWall(x - 1, y + 1)) m |= 64;
    if (isWall(x - 1, y - 1)) m |= 128;
    walls[y * W + x] = WALL_GID + THEMES.indexOf(th) * META.wall.perTheme + META.wall.lookup[canonical(m)];
    // walls have no floor (keeps the solid map simple)
    floor[y * W + x] = 0;
  }
  // keep a floor tile under walls for rendering gaps? no: walls fully cover their tile.

  const layer = (name: string, data: number[], id: number) => ({ id, name, type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data });
  // walls cells must stay solid even with floor 0 → GameMap treats walls layer as solid first
  return {
    type: 'map', version: '1.10', tiledversion: '1.11.0', orientation: 'orthogonal', renderorder: 'right-down',
    width: W, height: H, tilewidth: T, tileheight: T, infinite: false, nextlayerid: 5, nextobjectid: oid,
    properties: Object.entries({ theme: src.theme, ...(src.mapProps ?? {}) }).map(([k, v]) => prop(k, v)),
    tilesets: [
      { firstgid: KENNEY_GID, name: 'kenney', image: '../gen/tiles.png', imagewidth: 1728, imageheight: 1280, tilewidth: T, tileheight: T, tilecount: KENNEY_COUNT, columns: 27, margin: 0, spacing: 0 },
      { firstgid: WALL_GID, name: 'walls', image: '../gen/walls.png', imagewidth: META.wall.cols * T, imageheight: (THEMES.length * META.wall.perTheme / META.wall.cols) * T, tilewidth: T, tileheight: T, tilecount: THEMES.length * META.wall.perTheme, columns: META.wall.cols, margin: 0, spacing: 0 },
    ],
    layers: [
      layer('floor', floor, 1),
      layer('decor', decor, 2),
      layer('walls', walls, 3),
      { id: 4, name: 'objects', type: 'objectgroup', draworder: 'topdown', opacity: 1, visible: true, x: 0, y: 0, objects },
    ],
  };
}

const dir = path.join(ROOT, 'tools/levels');
const only = process.argv[2];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.ts') || f === 'types.ts' || f.startsWith('_')) continue;
  if (only && !f.startsWith(only)) continue;
  const mod = await import(pathToFileURL(path.join(dir, f)).href);
  const src: LevelSource = mod.default;
  const map = compile(src);
  fs.writeFileSync(path.join(OUT, src.id + '.tmj'), JSON.stringify(map));
  console.log(`map ${src.id}: ${map.width}x${map.height}, ${map.layers[3].objects!.length} objects`);
}
