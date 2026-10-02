// Map data parsed from Tiled JSON + collision / raycast queries. Phaser-free (used by server too).
import { propDef } from './props';

export const TILE = 64;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Collider extends Rect { bullets: boolean; round: boolean; id: number; dynamic?: boolean; open?: boolean; door?: boolean; locked?: boolean }

export interface MapObject {
  id: number;
  type: string;        // prop | spawn | trigger | npc | pickup | door | light | barrel | zone | label | enemy
  name: string;
  x: number; y: number; w: number; h: number;   // Tiled rect (top-left) — point objects have w = h = 0
  cx: number; cy: number;                        // centre
  rot: number;                                   // custom property 'rot' in degrees (props)
  props: Record<string, any>;
}

export interface TiledLayer {
  name: string; type: string; width?: number; height?: number; data?: number[];
  objects?: any[]; properties?: any[]; visible?: boolean; opacity?: number;
}
export interface TiledMap {
  width: number; height: number; tilewidth: number; tileheight: number;
  layers: TiledLayer[]; tilesets: any[]; properties?: any[];
}

function propsOf(arr?: any[]): Record<string, any> {
  const o: Record<string, any> = {};
  for (const p of arr ?? []) o[p.name] = p.value;
  return o;
}

export class GameMap {
  id: string;
  w: number; h: number;
  pw: number; ph: number;
  solid: Uint8Array;
  colliders: Collider[] = [];
  objects: MapObject[] = [];
  props: Record<string, any>;
  private buckets: Collider[][];

  constructor(id: string, tm: TiledMap) {
    this.id = id;
    this.w = tm.width; this.h = tm.height;
    this.pw = this.w * TILE; this.ph = this.h * TILE;
    this.props = propsOf(tm.properties);
    this.solid = new Uint8Array(this.w * this.h);
    const walls = tm.layers.find((l) => l.name === 'walls');
    if (walls?.data) for (let i = 0; i < walls.data.length; i++) this.solid[i] = walls.data[i] ? 1 : 0;
    // void (no floor, no wall) is solid too
    const floor = tm.layers.find((l) => l.name === 'floor');
    if (floor?.data) for (let i = 0; i < floor.data.length; i++) if (!floor.data[i]) this.solid[i] = 1;
    this.buckets = Array.from({ length: this.w * this.h }, () => []);
    for (const l of tm.layers) {
      if (l.type !== 'objectgroup') continue;
      for (const o of l.objects ?? []) {
        const mo: MapObject = {
          id: o.id, type: o.type || o.class || '', name: o.name || '', x: o.x, y: o.y, w: o.width || 0, h: o.height || 0,
          cx: o.x + (o.width || 0) / 2, cy: o.y + (o.height || 0) / 2, rot: 0, props: propsOf(o.properties),
        };
        mo.rot = Number(mo.props.rot || 0);
        this.objects.push(mo);
        if (mo.type === 'prop') {
          const def = propDef(mo.name);
          if (def.solid) {
            const ins = def.inset ?? 0;
            // rect = rotated bounding box of the sprite
            const w = mo.w - ins * 2, h = mo.h - ins * 2;
            this.addCollider({ x: mo.cx - w / 2, y: mo.cy - h / 2, w, h, bullets: def.bullets, round: !!def.round, id: mo.id });
          }
        }
      }
    }
  }

  addCollider(c: Collider) {
    this.colliders.push(c);
    const x0 = Math.max(0, Math.floor(c.x / TILE)), x1 = Math.min(this.w - 1, Math.floor((c.x + c.w) / TILE));
    const y0 = Math.max(0, Math.floor(c.y / TILE)), y1 = Math.min(this.h - 1, Math.floor((c.y + c.h) / TILE));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.buckets[y * this.w + x].push(c);
    return c;
  }

  removeCollider(c: Collider) {
    this.colliders = this.colliders.filter((o) => o !== c);
    for (const b of this.buckets) { const i = b.indexOf(c); if (i >= 0) b.splice(i, 1); }
  }

  isWall(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    return this.solid[ty * this.w + tx] === 1;
  }
  isWallAt(px: number, py: number) { return this.isWall(Math.floor(px / TILE), Math.floor(py / TILE)); }

  /** Is the point blocked for walking (walls + solid props + closed doors). */
  blockedAt(px: number, py: number, pad = 0, nav = false) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (this.isWall(tx, ty)) return true;
    for (const c of this.buckets[ty * this.w + tx]) {
      if (c.open) continue;
      if (nav && c.door && !c.locked) continue; // closed but unlocked doors open for chickens
      if (px >= c.x - pad && px <= c.x + c.w + pad && py >= c.y - pad && py <= c.y + c.h + pad) return true;
    }
    return false;
  }

  /**
   * Move a circle with collision against walls, props and closed doors.
   * Returns new position (mutates nothing). Substeps large moves.
   */
  move(x: number, y: number, r: number, dx: number, dy: number): [number, number] {
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / (r * 0.5)));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      x += sx; [x, y] = this.resolve(x, y, r);
      y += sy; [x, y] = this.resolve(x, y, r);
    }
    return [x, y];
  }

  private resolve(x: number, y: number, r: number): [number, number] {
    const tx0 = Math.floor((x - r) / TILE), tx1 = Math.floor((x + r) / TILE);
    const ty0 = Math.floor((y - r) / TILE), ty1 = Math.floor((y + r) / TILE);
    for (let pass = 0; pass < 2; pass++) {
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (this.isWall(tx, ty)) [x, y] = pushOut(x, y, r, tx * TILE, ty * TILE, TILE, TILE);
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        for (const c of this.buckets[ty * this.w + tx]) {
          if (c.open) continue;
          if (c.round) [x, y] = pushOutCircle(x, y, r, c.x + c.w / 2, c.y + c.h / 2, Math.min(c.w, c.h) / 2);
          else [x, y] = pushOut(x, y, r, c.x, c.y, c.w, c.h);
        }
      }
    }
    return [x, y];
  }

  /**
   * Cast a ray, returns distance to first wall / bullet-blocking collider (<= maxDist)
   * plus hit normal. `forBullets` = ignore colliders that don't stop bullets.
   */
  raycast(x: number, y: number, ang: number, maxDist: number, forBullets = true): { d: number; nx: number; ny: number; what: 'wall' | 'prop' | 'none'; id: number } {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDeltaX = Math.abs(TILE / (dx || 1e-9)), tDeltaY = Math.abs(TILE / (dy || 1e-9));
    let tMaxX = dx > 0 ? ((tx + 1) * TILE - x) / dx : dx < 0 ? (x - tx * TILE) / -dx : Infinity;
    let tMaxY = dy > 0 ? ((ty + 1) * TILE - y) / dy : dy < 0 ? (y - ty * TILE) / -dy : Infinity;
    let best = maxDist, nx = 0, ny = 0, what: 'wall' | 'prop' | 'none' = 'none', id = -1;
    let t = 0, lastAxis = -1;
    const seen = new Set<Collider>();
    while (t <= best) {
      if (this.isWall(tx, ty)) {
        if (t < best) { best = t; what = 'wall'; nx = lastAxis === 0 ? -stepX : 0; ny = lastAxis === 1 ? -stepY : 0; }
        break;
      }
      for (const c of this.buckets[ty * this.w + tx] ?? []) {
        if (seen.has(c) || c.open || (forBullets && !c.bullets)) continue;
        seen.add(c);
        const h = rayRect(x, y, dx, dy, c);
        if (h && h.t < best && h.t >= 0) { best = h.t; nx = h.nx; ny = h.ny; what = 'prop'; id = c.id; }
      }
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; tx += stepX; lastAxis = 0; }
      else { t = tMaxY; tMaxY += tDeltaY; ty += stepY; lastAxis = 1; }
    }
    return { d: Math.max(0, best), nx, ny, what, id };
  }

  lineOfSight(x1: number, y1: number, x2: number, y2: number, forBullets = true) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    if (d < 1) return true;
    return this.raycast(x1, y1, Math.atan2(y2 - y1, x2 - x1), d, forBullets).d >= d - 1;
  }
}

function pushOut(x: number, y: number, r: number, rx: number, ry: number, rw: number, rh: number): [number, number] {
  const cx = Math.max(rx, Math.min(x, rx + rw)), cy = Math.max(ry, Math.min(y, ry + rh));
  let dx = x - cx, dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return [x, y];
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    return [cx + (dx / d) * r, cy + (dy / d) * r];
  }
  // centre inside rect: push out along smallest axis
  const l = x - rx, rr = rx + rw - x, t = y - ry, b = ry + rh - y;
  const m = Math.min(l, rr, t, b);
  if (m === l) return [rx - r, y];
  if (m === rr) return [rx + rw + r, y];
  if (m === t) return [x, ry - r];
  return [x, ry + rh + r];
}

function pushOutCircle(x: number, y: number, r: number, cx: number, cy: number, cr: number): [number, number] {
  const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), m = r + cr;
  if (d >= m) return [x, y];
  if (d < 1e-4) return [cx + m, y];
  return [cx + (dx / d) * m, cy + (dy / d) * m];
}

function rayRect(x: number, y: number, dx: number, dy: number, c: Rect) {
  let tmin = -Infinity, tmax = Infinity, nx = 0, ny = 0;
  if (Math.abs(dx) < 1e-9) { if (x < c.x || x > c.x + c.w) return null; }
  else {
    let t1 = (c.x - x) / dx, t2 = (c.x + c.w - x) / dx, n = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = n; ny = 0; }
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dy) < 1e-9) { if (y < c.y || y > c.y + c.h) return null; }
  else {
    let t1 = (c.y - y) / dy, t2 = (c.y + c.h - y) / dy, n = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = 0; ny = n; }
    tmax = Math.min(tmax, t2);
  }
  if (tmax < tmin || tmax < 0) return null;
  return { t: tmin, nx, ny };
}

/** Ray vs circle: distance along ray or -1. */
export function rayCircle(x: number, y: number, dx: number, dy: number, cx: number, cy: number, r: number) {
  const fx = x - cx, fy = y - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t = -b - s;
  if (t >= 0) return t;
  if (-b + s >= 0) return 0; // inside
  return -1;
}
