import Phaser from 'phaser';

/**
 * Lightweight pooled particle system (all frames from one atlas → batched draws).
 * Particles can "land": when they stop they get stamped into the decal layer.
 */
export interface PDef {
  frame: string;
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  drag?: number;          // per second exponential
  s0?: number; s1?: number;
  sx?: number;            // x stretch multiplier (sparks)
  a0?: number; a1?: number;
  rot?: number; vr?: number;
  tint?: number; tint1?: number;
  add?: boolean;
  alignVel?: boolean;
  land?: boolean;         // stamp to decals at end
  landAlpha?: number;
  flutter?: number;       // feathers: sideways sway
  grow?: number;
}

export function lerpColor(a: number, b: number, k: number) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * k);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * k);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * k);
  return (r << 16) | (g << 8) | (bl | 0);
}

interface P extends Required<Omit<PDef, 'tint1' | 'flutter' | 'grow'>> { img: Phaser.GameObjects.Image; t: number; tint1?: number; flutter: number; ph: number; grow: number }

export class Particles {
  private pool: Phaser.GameObjects.Image[] = [];
  private live: P[] = [];
  onLand?: (frame: string, x: number, y: number, rot: number, scale: number, tint: number, alpha: number) => void;
  max: number;

  constructor(private scene: Phaser.Scene, private texture: string, private depth: number, max = 2500) { this.max = max; }

  get count() { return this.live.length; }

  emit(d: PDef) {
    if (this.live.length >= this.max) {
      // recycle the oldest
      const old = this.live.shift()!;
      this.release(old.img);
    }
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, this.texture, d.frame);
    img.setActive(true).setVisible(true).setFrame(d.frame).setDepth(this.depth + (d.add ? 1 : 0));
    img.setBlendMode(d.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    img.setTint(d.tint ?? 0xffffff);
    const p: P = {
      img, t: 0, frame: d.frame, x: d.x, y: d.y, vx: d.vx, vy: d.vy, life: d.life, drag: d.drag ?? 0,
      s0: d.s0 ?? 1, s1: d.s1 ?? d.s0 ?? 1, sx: d.sx ?? 1, a0: d.a0 ?? 1, a1: d.a1 ?? 0, rot: d.rot ?? 0, vr: d.vr ?? 0,
      tint: d.tint ?? 0xffffff, tint1: d.tint1, add: !!d.add, alignVel: !!d.alignVel, land: !!d.land, landAlpha: d.landAlpha ?? 0.8,
      flutter: d.flutter ?? 0, ph: Math.random() * 6.28, grow: d.grow ?? 0,
    };
    this.live.push(p);
    this.apply(p, 0);
  }

  private apply(p: P, k: number) {
    const s = p.s0 + (p.s1 - p.s0) * k;
    p.img.setPosition(p.x, p.y);
    p.img.setScale(s * p.sx, s);
    p.img.setAlpha(p.a0 + (p.a1 - p.a0) * k);
    p.img.setRotation(p.alignVel ? Math.atan2(p.vy, p.vx) : p.rot);
    if (p.tint1 !== undefined) {
      p.img.setTint(lerpColor(p.tint, p.tint1, k));
    }
  }

  update(dt: number) {
    const live = this.live;
    let w = 0;
    for (let i = 0; i < live.length; i++) {
      const p = live[i];
      p.t += dt;
      if (p.t >= p.life) {
        if (p.land && this.onLand) this.onLand(p.frame, p.x, p.y, p.rot, p.s1, p.tint1 ?? p.tint, p.landAlpha);
        this.release(p.img);
        continue;
      }
      if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; }
      if (p.flutter) {
        p.ph += dt * 7;
        const sp = Math.hypot(p.vx, p.vy) + 25;
        p.x += -Math.sin(Math.atan2(p.vy, p.vx)) * Math.sin(p.ph) * p.flutter * dt * sp * 0.04;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.vr && p.drag) p.vr *= Math.exp(-p.drag * 0.6 * dt);
      this.apply(p, p.t / p.life);
      live[w++] = p;
    }
    live.length = w;
  }

  private release(img: Phaser.GameObjects.Image) {
    img.setActive(false).setVisible(false);
    this.pool.push(img);
  }
}

/**
 * Persistent decals (blood, feathers, casings, corpses, scorch marks) drawn into
 * chunked RenderTextures so the floor accumulates a battle history at zero per-frame cost.
 */
export class DecalLayer {
  private chunks = new Map<number, Phaser.GameObjects.RenderTexture>();
  private stamp: Phaser.GameObjects.Image;
  static CH = 1024;

  constructor(private scene: Phaser.Scene, private depth: number, private w: number, private h: number) {
    this.stamp = scene.make.image({ x: 0, y: 0, key: 'fx', frame: 'dot' }, false);
  }

  private chunk(cx: number, cy: number) {
    const k = cy * 1000 + cx;
    let rt = this.chunks.get(k);
    if (!rt) {
      const C = DecalLayer.CH;
      rt = this.scene.add.renderTexture(cx * C, cy * C, C, C).setOrigin(0, 0).setDepth(this.depth);
      this.chunks.set(k, rt);
    }
    return rt;
  }

  draw(texture: string, frame: string, x: number, y: number, rot = 0, scale = 1, tint = 0xffffff, alpha = 1, sx = 1) {
    if (x < -64 || y < -64 || x > this.w + 64 || y > this.h + 64) return;
    const img = this.stamp;
    img.setTexture(texture, frame).setRotation(rot).setScale(scale * sx, scale).setTint(tint).setAlpha(alpha).setOrigin(0.5);
    const r = Math.max(img.width * scale * sx, img.height * scale) * 0.75;
    const C = DecalLayer.CH;
    const cx0 = Math.floor((x - r) / C), cx1 = Math.floor((x + r) / C);
    const cy0 = Math.floor((y - r) / C), cy1 = Math.floor((y + r) / C);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0) continue;
      const rt = this.chunk(cx, cy);
      rt.draw(img, x - cx * C, y - cy * C);
    }
  }

  clear() { for (const rt of this.chunks.values()) rt.destroy(); this.chunks.clear(); }
}
