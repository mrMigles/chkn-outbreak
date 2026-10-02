import Phaser from 'phaser';
import type { Light } from './Fx';
import type { GameMap, MapObject } from '../../shared/map';

interface StaticLight { o: MapObject; x: number; y: number; r: number; color: number; flicker: number; kind: string; glow: Phaser.GameObjects.Image; beam?: Phaser.GameObjects.Image; ph: number }

/**
 * Darkness overlay: a screen-sized RenderTexture filled with ambient black, lights are erased out of it.
 * Coloured glows are separate additive sprites in the world so lights tint the scene in lit areas too.
 */
export class Lighting {
  rt: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  private cone: Phaser.GameObjects.Image;
  ambient = 0;
  target = 0;
  base = 0;
  blackout = false;
  alarm = false;
  statics: StaticLight[] = [];
  private zones: MapObject[];
  private t = 0;
  private shadowG: Phaser.GameObjects.Graphics;
  private map: GameMap;

  constructor(private scene: Phaser.Scene, map: GameMap) {
    this.rt = scene.add.renderTexture(0, 0, 64, 64).setOrigin(0, 0).setDepth(30).setVisible(false);
    this.stamp = scene.make.image({ key: 'fx', frame: 'light' }, false);
    this.cone = scene.make.image({ key: 'fx', frame: 'flashlight' }, false).setOrigin(0, 0.5);
    this.shadowG = scene.make.graphics({}, false);
    this.map = map;
    this.base = Number(map.props.ambient ?? 0);
    this.ambient = this.target = this.base;
    this.zones = map.objects.filter((o) => o.type === 'zone' && o.props.dark !== undefined);
    for (const o of map.objects) {
      if (o.type !== 'light') continue;
      const color = parseInt(String(o.props.color ?? 'ffe0a0').replace('#', ''), 16);
      const r = Number(o.props.radius ?? 260);
      const kind = String(o.props.kind ?? 'lamp');
      const glow = scene.add.image(o.cx, o.cy, 'fx', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(color).setDepth(19)
        .setScale(r / 64 * 0.9).setAlpha(kind === 'emergency' ? 0.5 : 0.22);
      const st: StaticLight = { o, x: o.cx, y: o.cy, r, color, flicker: Number(o.props.flicker ?? 0), kind, glow, ph: Math.random() * 10 };
      if (kind === 'alarm') {
        st.beam = scene.add.image(o.cx, o.cy, 'fx', 'flashlight').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setTint(color).setDepth(19).setAlpha(0.45).setScale(r / 512 * 1.4, 0.7);
      }
      this.statics.push(st);
    }
  }

  /**
   * Grow the darkness texture. NB: a WebGL RenderTexture that was resize()d stops accepting draw/erase
   * (only fill works) in Phaser 3.90, so we recreate it instead.
   */
  resize(w: number, h: number) {
    const old = this.rt;
    this.rt = this.scene.add.renderTexture(0, 0, Math.ceil(w) + 4, Math.ceil(h) + 4).setOrigin(0, 0).setDepth(30);
    old.destroy();
  }

  update(cam: Phaser.Cameras.Scene2D.Camera, dt: number, dyn: Light[], flashlights: { x: number; y: number; a: number }[]) {
    this.t += dt;
    // ambient from blackout / zones
    let tgt = this.blackout ? Math.max(0.9, this.base) : this.base;
    const cx = cam.midPoint.x, cy = cam.midPoint.y;
    for (const z of this.zones) if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) tgt = Number(z.props.dark);
    this.target = tgt;
    this.ambient += (this.target - this.ambient) * Math.min(1, dt * 3);

    // static light sprites (flicker, alarm rotation)
    for (const s of this.statics) {
      let on = 1;
      if (s.flicker) { s.ph += dt; on = Math.sin(s.ph * 23) + Math.sin(s.ph * 7.3) > -1.2 * (1 - s.flicker) ? 1 : 0.15; }
      if (s.kind === 'alarm') {
        on = this.alarm ? 1 : 0;
        if (s.beam) { s.beam.setRotation(this.t * 3 + s.ph).setVisible(on > 0); }
      }
      if (s.kind === 'emergency') on = this.blackout || this.alarm || this.base > 0.5 ? on * (0.6 + 0.4 * Math.abs(Math.sin(this.t * 2 + s.ph))) : 0;
      (s as any).on = on;
      s.glow.setVisible(on > 0.05).setAlpha((s.kind === 'emergency' ? 0.5 : 0.22) * on);
    }

    const vis = this.ambient > 0.02;
    this.rt.setVisible(vis);
    if (!vis) return;
    const view = cam.worldView;
    if (this.rt.width < view.width || this.rt.height < view.height) this.resize(view.width * 1.2, view.height * 1.2);
    this.rt.setPosition(view.x - 2, view.y - 2);
    this.rt.clear();
    this.rt.fill(0x05070a, this.ambient);
    const ox = view.x - 2, oy = view.y - 2;
    const erase = (x: number, y: number, r: number, a: number) => {
      if (x + r < view.x || y + r < view.y || x - r > view.right || y - r > view.bottom) return;
      this.stamp.setScale(r / 128).setAlpha(Math.min(1, a));
      this.rt.erase(this.stamp, x - ox, y - oy);
    };
    // flashlights first, then re-darken whatever is behind walls inside the cone
    for (const f of flashlights) {
      this.cone.setRotation(f.a).setScale(1.25, 1.1).setAlpha(1);
      this.rt.erase(this.cone, f.x - ox, f.y - oy);
      this.cone.setAlpha(0.5);
      this.rt.erase(this.cone, f.x - ox, f.y - oy);
    }
    if (flashlights.length && this.map) {
      const g = this.shadowG;
      g.clear();
      g.fillStyle(0x05070a, this.ambient);
      const R = 680, N = 36, half = 0.46;
      for (const f of flashlights) {
        let prev: { a: number; d: number } | null = null;
        for (let i = 0; i <= N; i++) {
          const a = f.a - half + (2 * half * i) / N;
          const d = Math.min(R, this.map.raycast(f.x, f.y, a, R, true).d + 6);
          if (prev && (prev.d < R || d < R)) {
            const p1x = f.x + Math.cos(prev.a) * prev.d - ox, p1y = f.y + Math.sin(prev.a) * prev.d - oy;
            const p2x = f.x + Math.cos(a) * d - ox, p2y = f.y + Math.sin(a) * d - oy;
            const q1x = f.x + Math.cos(prev.a) * (R + 80) - ox, q1y = f.y + Math.sin(prev.a) * (R + 80) - oy;
            const q2x = f.x + Math.cos(a) * (R + 80) - ox, q2y = f.y + Math.sin(a) * (R + 80) - oy;
            g.fillPoints([{ x: p1x, y: p1y }, { x: p2x, y: p2y }, { x: q2x, y: q2y }, { x: q1x, y: q1y }], true);
          }
          prev = { a, d };
        }
      }
      this.rt.draw(g, 0, 0);
    }
    for (const s of this.statics) {
      const on = (s as any).on ?? 1;
      if (on <= 0.05) continue;
      if (s.kind === 'alarm' && s.beam) {
        this.cone.setRotation(s.beam.rotation).setScale(s.r / 512 * 1.4, 0.7).setAlpha(0.8);
        this.rt.erase(this.cone, s.x - ox, s.y - oy);
        erase(s.x, s.y, 70, 0.8);
      } else erase(s.x, s.y, s.r, 0.9 * on);
    }
    for (const l of dyn) {
      const k = 1 - l.t / l.life;
      erase(l.x, l.y, l.r, l.a * k);
    }
    for (const f of flashlights) erase(f.x, f.y, 110, 0.75); // personal halo so the player always reads
  }
}
