import Phaser from 'phaser';
import { settings } from '../settings';
import type { Light } from './Fx';
import type { GameMap, MapObject } from '../../shared/map';

interface StaticLight { o: MapObject; x: number; y: number; r: number; color: number; flicker: number; kind: string; glow: Phaser.GameObjects.Image; beam?: Phaser.GameObjects.Image; ph: number; on: number }

/** World units between darkness grid vertices. Light edges are soft at this resolution, which suits the mood. */
const CELL = 24;
const DARK = 0x05070a;

/**
 * Darkness overlay as a grid of quads with per-vertex alpha (one Graphics object, no render textures).
 * Light from lamps, muzzle flashes, explosions and flashlights is accumulated per vertex on the CPU;
 * flashlights are clipped by a 36-ray visibility fan so walls cast shadows.
 * (The previous RenderTexture erase approach stalled integrated GPUs for seconds per frame.)
 * Coloured glows remain separate additive sprites in the world.
 */
export class Lighting {
  private g: Phaser.GameObjects.Graphics;
  ambient = 0;
  target = 0;
  base = 0;
  /** the map's own darkness; scripts may override `base` (D69) */
  mapBase = 0;
  private flickerT = 0;
  blackout = false;
  alarm = false;
  statics: StaticLight[] = [];
  private zones: MapObject[];
  private t = 0;
  private map: GameMap;
  private L = new Float32Array(0);

  constructor(private scene: Phaser.Scene, map: GameMap) {
    this.g = scene.add.graphics().setDepth(30);
    this.map = map;
    this.base = this.mapBase = Number(map.props.ambient ?? 0);
    this.ambient = this.target = this.base;
    this.zones = map.objects.filter((o) => o.type === 'zone' && o.props.dark !== undefined);
    for (const o of map.objects) {
      if (o.type !== 'light') continue;
      const color = parseInt(String(o.props.color ?? 'ffe0a0').replace('#', ''), 16);
      const r = Number(o.props.radius ?? 260);
      const kind = String(o.props.kind ?? 'lamp');
      const glow = scene.add.image(o.cx, o.cy, 'fx', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setDepth(19)
        .setScale(r / 64 * 0.9).setAlpha(kind === 'emergency' ? 0.5 : 0.22);
      const st: StaticLight = { o, x: o.cx, y: o.cy, r, color, flicker: Number(o.props.flicker ?? 0), kind, glow, ph: Math.random() * 10, on: 1 };
      if (kind === 'alarm') {
        st.beam = scene.add.image(o.cx, o.cy, 'fx', 'flashlight').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(color).setDepth(19).setAlpha(0.45).setScale(r / 512 * 1.4, 0.7);
      }
      this.statics.push(st);
    }
  }

  resize(_w: number, _h: number) { /* grid follows the camera; nothing to reallocate */ }

  /** D69: a scripted override of the map's darkness (−1 = back to the map's own). */
  setOverride(v: number | undefined, snap = false) {
    this.base = v !== undefined && v >= 0 ? v : this.mapBase;
    if (snap) this.ambient = this.blackout ? Math.max(0.9, this.base) : this.base;
  }
  /** D69: lamps stutter for a moment and show the room (floor-8 scares). */
  flicker(t = 0.9) { this.flickerT = t; }

  update(cam: Phaser.Cameras.Scene2D.Camera, dt: number, dyn: Light[], flashlights: { x: number; y: number; a: number }[]) {
    this.t += dt;
    let tgt = this.blackout ? Math.max(0.9, this.base) : this.base;
    const cx = cam.midPoint.x, cy = cam.midPoint.y;
    for (const z of this.zones) if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) tgt = Number(z.props.dark);
    this.target = tgt;
    this.ambient += (this.target - this.ambient) * Math.min(1, dt * 3);
    if (this.flickerT > 0) {
      this.flickerT -= dt;
      const lit = Math.sin(this.flickerT * 38) + Math.sin(this.flickerT * 11) > 0.6;
      if (lit) this.ambient = Math.min(this.ambient, settings.reducedFlashes ? 0.5 : 0.18);
    }

    for (const s of this.statics) {
      let on = 1;
      if (s.flicker && !settings.reducedFlashes) { s.ph += dt; on = Math.sin(s.ph * 23) + Math.sin(s.ph * 7.3) > -1.2 * (1 - s.flicker) ? 1 : 0.15; }
      if (s.kind === 'alarm') { on = this.alarm ? 1 : 0; if (s.beam) s.beam.setRotation(settings.reducedFlashes ? s.ph : this.t * 3 + s.ph).setVisible(on > 0); }
      if (s.kind === 'emergency') on = this.blackout || this.alarm || this.base > 0.5 ? on * (settings.reducedFlashes ? .7 : .6 + .4 * Math.abs(Math.sin(this.t * 2 + s.ph))) : 0;
      // D73: deep darkness (a script sets ≥ 0.985): desk lamps die too, only emergency red stays
      if (this.base >= 0.985 && s.kind === 'lamp') on = 0;
      s.on = on;
      s.glow.setVisible(on > 0.05).setAlpha((s.kind === 'emergency' ? 0.5 : 0.22) * on);
    }

    const g = this.g;
    g.clear();
    if (this.ambient <= 0.02) { g.setVisible(false); return; }
    g.setVisible(true);
    const view = cam.worldView;
    const x0 = Math.floor((view.x - CELL) / CELL) * CELL, y0 = Math.floor((view.y - CELL) / CELL) * CELL;
    const cols = Math.ceil((view.width + CELL * 3) / CELL) + 1, rows = Math.ceil((view.height + CELL * 3) / CELL) + 1;
    const n = cols * rows;
    if (this.L.length < n) this.L = new Float32Array(n * 1.3 | 0);
    const L = this.L;
    L.fill(0, 0, n);

    // radial lights: scatter into the vertices inside each light's box
    const radial = (lx: number, ly: number, r: number, a: number) => {
      if (a <= 0.01 || lx + r < x0 || ly + r < y0 || lx - r > x0 + cols * CELL || ly - r > y0 + rows * CELL) return;
      const i0 = Math.max(0, Math.floor((lx - r - x0) / CELL)), i1 = Math.min(cols - 1, Math.ceil((lx + r - x0) / CELL));
      const j0 = Math.max(0, Math.floor((ly - r - y0) / CELL)), j1 = Math.min(rows - 1, Math.ceil((ly + r - y0) / CELL));
      const r2 = r * r;
      for (let j = j0; j <= j1; j++) {
        const dy = y0 + j * CELL - ly;
        for (let i = i0; i <= i1; i++) {
          const dx = x0 + i * CELL - lx, d2 = dx * dx + dy * dy;
          if (d2 >= r2) continue;
          const k = 1 - Math.sqrt(d2) / r;
          L[j * cols + i] += a * k * (2 - k);
        }
      }
    };
    for (const s of this.statics) {
      if (s.on <= 0.05) continue;
      if (s.kind === 'alarm' && s.beam) radial(s.x + Math.cos(s.beam.rotation) * s.r * 0.5, s.y + Math.sin(s.beam.rotation) * s.r * 0.5, s.r * 0.6, 0.8);
      radial(s.x, s.y, s.kind === 'alarm' ? 70 : s.r, 0.95 * s.on);
    }
    for (const l of dyn) radial(l.x, l.y, l.r, l.a * (1 - l.t / l.life));

    // flashlights: cone clipped by a ray fan (walls/crates cast shadows) + a personal halo
    const deep = this.base >= 0.985;
    const R = deep ? 430 : 680, N = 36, half = 0.46;
    const ray = new Float32Array(N + 1);
    for (const f of flashlights) {
      for (let k = 0; k <= N; k++) ray[k] = Math.min(R, this.map.raycast(f.x, f.y, f.a - half + (2 * half * k) / N, R, true).d + 10);
      const i0 = Math.max(0, Math.floor((f.x - R - x0) / CELL)), i1 = Math.min(cols - 1, Math.ceil((f.x + R - x0) / CELL));
      const j0 = Math.max(0, Math.floor((f.y - R - y0) / CELL)), j1 = Math.min(rows - 1, Math.ceil((f.y + R - y0) / CELL));
      for (let j = j0; j <= j1; j++) {
        const dy = y0 + j * CELL - f.y;
        for (let i = i0; i <= i1; i++) {
          const dx = x0 + i * CELL - f.x, d = Math.hypot(dx, dy);
          if (d > R) continue;
          let da = Math.atan2(dy, dx) - f.a;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) > half + 0.08) continue;
          const kf = (da + half) / (2 * half) * N, k0 = Math.max(0, Math.min(N, Math.floor(kf))), k1 = Math.min(N, k0 + 1);
          const lim = Math.min(ray[k0], ray[k1]);
          if (d > lim) continue;
          const edge = Math.max(0, 1 - Math.max(0, Math.abs(da) - half + 0.1) / 0.18);
          L[j * cols + i] += 1.1 * (1 - (d / R) ** 2) * edge;
        }
      }
      radial(f.x, f.y, deep ? 80 : 120, deep ? 0.6 : 0.8);
    }

    // emit quads
    const amb = this.ambient;
    const A = (i: number) => amb * (1 - Math.min(1, L[i]));
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const k = j * cols + i;
        const a = A(k), b = A(k + 1), c = A(k + cols), d = A(k + cols + 1);
        if (a < 0.01 && b < 0.01 && c < 0.01 && d < 0.01) continue;
        g.fillGradientStyle(DARK, DARK, DARK, DARK, a, b, c, d);
        g.fillRect(x0 + i * CELL, y0 + j * CELL, CELL, CELL);
      }
    }
  }
}
