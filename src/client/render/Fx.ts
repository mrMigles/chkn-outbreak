import Phaser from 'phaser';
import { DecalLayer, Particles } from './Particles';
import { sfx } from '../audio/Sfx';
import { WEAPONS, WeaponId } from '../../shared/weapons';
import type { EnemyType } from '../../shared/enemies';
import { rand, pick } from '../../shared/math';
import type { GameMap } from '../../shared/map';

export interface Light { x: number; y: number; r: number; color: number; a: number; life: number; t: number; follow?: () => { x: number; y: number } | null }

interface Tracer { img: Phaser.GameObjects.Image; x1: number; y1: number; x2: number; y2: number; len: number; d: number; head: number; speed: number; L: number; w: number; tail: number; alive: boolean }

const FEATHER_TINT: Record<string, number> = { fast: 0xffe27a, chick: 0xffe27a, spitter: 0xe3f5c8, exploder: 0xffd2bd, boss: 0xe8a24a, player: 0xf0c060 };

export class Fx {
  low: Particles;     // under characters (blood drops, casings)
  private falling: { spr: Phaser.GameObjects.Sprite; t: number; frames: string[]; vx: number; vy: number; tint: number }[] = [];
  high: Particles;    // above characters (sparks, flashes, fire, smoke, flying feathers)
  decals: DecalLayer;
  lights: Light[] = [];
  trauma = 0;
  kickX = 0; kickY = 0;
  shakeScale = 1;
  private tracers: Tracer[] = [];
  private tracerPool: Phaser.GameObjects.Image[] = [];
  map!: GameMap;

  constructor(private scene: Phaser.Scene, w: number, h: number) {
    this.decals = new DecalLayer(scene, 3, w, h);
    this.decals.prewarm();
    this.low = new Particles(scene, 'fx', 6, 1500);
    this.high = new Particles(scene, 'fx', 20, 3000);
    const land = (tex: string) => (frame: string, x: number, y: number, rot: number, scale: number, tint: number, alpha: number) =>
      this.decals.draw(tex, frame, x, y, rot, scale, tint, alpha);
    this.low.onLand = land('fx');
    this.high.onLand = land('fx');
  }

  shake(t: number) { this.trauma = Math.min(1, this.trauma + t * this.shakeScale); }
  kick(a: number, amount: number) { this.kickX -= Math.cos(a) * amount; this.kickY -= Math.sin(a) * amount; }

  light(x: number, y: number, r: number, color: number, a: number, life: number, follow?: Light['follow']) {
    this.lights.push({ x, y, r, color, a, life, t: 0, follow });
    if (this.lights.length > 300) this.lights.shift();
  }

  glow(x: number, y: number, r: number, color: number, a: number, life: number) {
    this.high.emit({ frame: 'glow', x, y, vx: 0, vy: 0, life, s0: r / 64, s1: r / 64 * 1.1, a0: a, a1: 0, tint: color, add: true });
  }

  // ------------------------------------------------------------------ weapons
  muzzle(w: WeaponId, x: number, y: number, a: number, vx = 0, vy = 0, ejectX = x, ejectY = y, quiet = false) {
    const def = WEAPONS[w];
    const cos = Math.cos(a), sin = Math.sin(a);
    if (def.kind === 'flame') return;
    // flash sprite
    const big = w === 'shotgun' || w === 'grenade' || w === 'machinegun';
    const sc = def.flashScale * rand(0.8, 1.2);
    this.high.emit({ frame: def.flash, x, y, vx: vx, vy: vy, life: big ? 0.08 : 0.065, s0: sc, s1: sc * 1.15, a0: 1, a1: 0.7, rot: a + rand(-0.08, 0.08), add: true, sx: rand(0.85, 1.25) });
    if (w === 'machinegun' && Math.random() < 0.5) this.high.emit({ frame: 'flash_star', x, y, vx, vy, life: 0.04, s0: 0.7, s1: 0.8, a0: 1, a1: 0, rot: rand(0, 6), add: true });
    // light flash around the weapon
    this.glow(x, y, def.light * 0.75, 0xffc46b, big ? 0.75 : 0.55, big ? 0.12 : 0.08);
    this.light(x, y, def.light * 1.6, 0xffd08a, 1, big ? 0.12 : 0.07);
    // sparks forward
    const ns = w === 'shotgun' ? 10 : w === 'grenade' ? 6 : 3;
    for (let i = 0; i < ns; i++) {
      const aa = a + rand(-0.35, 0.35) * (w === 'shotgun' ? 1.4 : 1);
      const sp = rand(500, 1300);
      this.high.emit({ frame: 'spark', x, y, vx: Math.cos(aa) * sp + vx, vy: Math.sin(aa) * sp + vy, life: rand(0.05, 0.14), drag: 8, s0: rand(0.5, 0.9), s1: 0.2, sx: 1.6, a0: 1, a1: 0, alignVel: true, add: true, tint: 0xffe2a0 });
    }
    // smoke
    const puffs = w === 'shotgun' || w === 'grenade' ? 4 : Math.random() < 0.6 ? 1 : 0;
    for (let i = 0; i < puffs; i++) {
      const sp = rand(30, 140);
      const aa = a + rand(-0.5, 0.5);
      this.high.emit({ frame: 'smoke', x: x + cos * 6, y: y + sin * 6, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.5, 1.1), drag: 2.5, s0: 0.25, s1: rand(0.8, 1.4), a0: 0.35, a1: 0, rot: rand(0, 6), vr: rand(-1, 1), tint: 0xd8d2c8 });
    }
    // casings eject to the right side of the gun
    if (def.casing) {
      const ea = a + Math.PI / 2 + rand(-0.4, 0.3);
      const eject = () => {
        const sp = rand(140, 260);
        this.low.emit({ frame: def.casing!, x: ejectX, y: ejectY, vx: Math.cos(ea) * sp + vx * 0.5, vy: Math.sin(ea) * sp + vy * 0.5, life: rand(0.45, 0.7), drag: 5.5, s0: 1.3, s1: 1, rot: rand(0, 6), vr: rand(-30, 30), land: true, landAlpha: 0.9 });
        if (!quiet && Math.random() < 0.45) setTimeout(() => sfx.play(def.casing === 'shell' ? 'shell' : 'casing', { x: ejectX, y: ejectY, vol: 0.5, max: 4 }), 320 + Math.random() * 200);
      };
      if (w === 'shotgun') setTimeout(eject, 260); else eject();
    }
  }

  tracer(x1: number, y1: number, x2: number, y2: number, color: number, width: number, speed = 4200, L = 110) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    if (d < 4) return;
    const img = this.tracerPool.pop() ?? this.scene.add.image(0, 0, 'fx', 'tracer').setOrigin(1, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(19);
    img.setVisible(true).setActive(true).setTint(color).setRotation(Math.atan2(y2 - y1, x2 - x1));
    this.tracers.push({ img, x1, y1, x2, y2, len: d, d, head: 0, speed, L, w: width, tail: 0, alive: true });
  }

  // ------------------------------------------------------------------ impacts
  impact(kind: 'wall' | 'prop' | 'armor' | 'flesh' | 'player' | 'npc', x: number, y: number, a: number, featherTint = 0xffffff, big = false) {
    if (kind === 'wall' || kind === 'prop') {
      // a = normal angle
      for (let i = 0; i < 7; i++) {
        const aa = a + rand(-1.1, 1.1), sp = rand(200, 650);
        this.high.emit({ frame: 'spark', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.08, 0.22), drag: 6, s0: rand(0.5, 0.8), s1: 0.1, sx: 1.4, a0: 1, a1: 0.2, alignVel: true, add: true, tint: 0xffd27a });
      }
      this.high.emit({ frame: 'smoke', x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: rand(0.35, 0.6), drag: 3, s0: 0.15, s1: 0.5, a0: 0.4, a1: 0, rot: rand(0, 6), tint: kind === 'wall' ? 0xbab3a6 : 0xd9b98c });
      this.glow(x, y, 40, 0xffd27a, 0.6, 0.06);
      for (let i = 0; i < 2; i++) {
        const aa = a + rand(-0.9, 0.9), sp = rand(60, 200);
        this.low.emit({ frame: kind === 'prop' && Math.random() < 0.5 ? 'paper' : 'chunk', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.3, 0.6), drag: 6, s0: rand(0.5, 0.9), s1: rand(0.5, 0.8), rot: rand(0, 6), vr: rand(-12, 12), land: true, landAlpha: 0.8 });
      }
      this.decals.draw('fx', 'bullet_hole', x - Math.cos(a) * 3, y - Math.sin(a) * 3, 0, rand(0.6, 0.9), 0xffffff, 0.6);
      sfx.play('wallhit', { x, y, vol: 0.45, max: 5 });
      return;
    }
    if (kind === 'armor') {
      for (let i = 0; i < 10; i++) {
        const aa = a + Math.PI + rand(-1.3, 1.3), sp = rand(250, 750);
        this.high.emit({ frame: 'spark', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.08, 0.2), drag: 6, s0: 0.8, s1: 0.1, sx: 1.6, a0: 1, a1: 0, alignVel: true, add: true, tint: 0xd6ecff });
      }
      this.glow(x, y, 50, 0xbfe3ff, 0.9, 0.07);
      sfx.play('armor', { x, y, vol: 0.55, max: 4 });
      return;
    }
    // flesh: blood spray along the bullet + feathers
    const n = big ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const aa = a + rand(-0.6, 0.6), sp = rand(120, big ? 600 : 420);
      this.low.emit({ frame: 'blood_drop', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.18, 0.4), drag: 7, s0: rand(0.6, 1.3), s1: rand(0.5, 1.1), land: true, landAlpha: 0.9 });
    }
    this.high.emit({ frame: 'soft', x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.22, s0: 0.6, s1: 1.6, a0: 0.55, a1: 0, tint: 0xb3161b });
    if (kind === 'flesh') {
      const nf = big ? 4 : Math.random() < 0.5 ? 1 : 0;
      for (let i = 0; i < nf; i++) this.feather(x, y, a + rand(-1.2, 1.2), rand(60, 220), featherTint);
      sfx.play('flesh', { x, y, vol: 0.55, max: 6 });
    } else sfx.play('hurt', { x, y, vol: 0.6, max: 3 });
  }

  /** A destructible prop breaks: debris by material, dust, a thud. */
  propBreak(x: number, y: number, mat: string) {
    const top = y - 30;
    const pal: Record<string, { frame: string; tint: number; n: number; snd: string }> = {
      wood: { frame: 'chunk', tint: 0xa8743f, n: 14, snd: 'wallhit' },
      plant: { frame: 'chunk', tint: 0x4f8a3a, n: 14, snd: 'splat' },
      glass: { frame: 'shard', tint: 0xcfefff, n: 16, snd: 'armor' },
      tech: { frame: 'shard', tint: 0x9aa3ad, n: 12, snd: 'armor' },
      metal: { frame: 'chunk', tint: 0x8d949b, n: 10, snd: 'armor' },
    };
    const p = pal[mat] ?? pal.wood;
    for (let i = 0; i < p.n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(80, 320);
      this.low.emit({ frame: i % 3 === 0 ? 'paper' : p.frame, x: x + rand(-10, 10), y: top + rand(-14, 10), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 60, life: rand(0.35, 0.7), drag: 4, s0: rand(0.7, 1.3), s1: rand(0.6, 1), rot: rand(0, 6), vr: rand(-14, 14), tint: p.tint, land: true, landAlpha: 0.85 });
    }
    if (mat === 'tech') for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(200, 600);
      this.high.emit({ frame: 'spark', x, y: top, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.1, 0.3), drag: 5, s0: 0.8, s1: 0.1, sx: 1.6, a0: 1, a1: 0, alignVel: true, add: true, tint: 0xbfe3ff });
    }
    if (mat === 'glass') for (let i = 0; i < 6; i++) this.low.emit({ frame: 'goo_0', x: x + rand(-14, 14), y: y + rand(-6, 6), vx: rand(-40, 40), vy: rand(-20, 20), life: 0.4, drag: 6, s0: 0.6, s1: 1.4, a0: 0.6, a1: 0.5, tint: 0x8fd0ff, land: true, landAlpha: 0.45 });
    for (let i = 0; i < 4; i++) this.high.emit({ frame: 'smoke', x: x + rand(-16, 16), y: top + rand(-10, 10), vx: rand(-40, 40), vy: rand(-50, -10), life: rand(0.5, 0.9), drag: 2, s0: 0.3, s1: 0.9, a0: 0.45, a1: 0, rot: rand(0, 6), tint: 0xc9bca8 });
    this.shake(0.05);
    sfx.play(p.snd as any, { x, y, vol: 0.8 });
    sfx.play('wallhit', { x, y, vol: 0.6 });
  }

  feather(x: number, y: number, a: number, sp: number, tint = 0xffffff) {
    this.high.emit({
      frame: Math.random() < 0.5 ? 'feather_0' : 'feather_1', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.9, 2.0), drag: 2.6, s0: rand(0.8, 1.3), s1: rand(0.75, 1.0), rot: rand(0, 6), vr: rand(-6, 6), tint, tint1: tint === 0xffffff ? 0xd6cfbf : tint, land: true, landAlpha: 0.62, flutter: 1,
    });
  }

  kill(t: EnemyType | 'player', x: number, y: number, a: number, gib: boolean, burn: boolean, body?: { tex: string; frame: string; frames: string[]; scale: number }, elev = 0) {
    const big = t === 'fat' || t === 'boss';
    const ft = FEATHER_TINT[t] ?? 0xffffff;
    const sc = t === 'boss' ? 2.4 : big ? 1.6 : t === 'chick' ? 0.6 : 1;
    // splat decal
    this.decals.draw('fx', pick(['splat_0', 'splat_1', 'splat_3']), x + Math.cos(a) * 14, y + Math.sin(a) * 14, rand(0, 6), sc * rand(0.9, 1.4), 0xffffff, 0.92);
    // blood burst
    for (let i = 0; i < (gib ? 26 : 16); i++) {
      const aa = Math.random() < 0.6 ? a + rand(-0.8, 0.8) : rand(0, 6.28), sp = rand(80, gib ? 700 : 480);
      this.low.emit({ frame: 'blood_drop', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.2, 0.5), drag: 6, s0: rand(0.7, 1.6), s1: rand(0.6, 1.3), land: true, landAlpha: 0.9 });
    }
    this.high.emit({ frame: 'soft', x, y: y - elev, vx: 0, vy: 0, life: 0.3, s0: 1, s1: 2.6 * sc, a0: 0.5, a1: 0, tint: 0xb3161b });
    // feather explosion
    const nf = Math.round((gib ? 22 : 12) * Math.min(sc, 1.8));
    for (let i = 0; i < nf; i++) this.feather(x + rand(-8, 8), y - elev * rand(0.3, 1) + rand(-8, 8), rand(0, 6.28), rand(60, gib ? 420 : 300), ft);
    // white puff
    this.high.emit({ frame: 'smoke', x, y: y - elev * 0.7, vx: 0, vy: 0, life: 0.5, s0: 0.4, s1: 1.4 * sc, a0: 0.6, a1: 0, rot: rand(0, 6), tint: burn ? 0x444444 : 0xffffff });
    if (gib) {
      for (const g of ['gib_leg', 'gib_leg', 'gib_badge']) {
        const aa = a + rand(-1, 1), sp = rand(200, 520);
        this.low.emit({ frame: g, x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.5, 0.8), drag: 4, s0: 1.2, s1: 1, rot: rand(0, 6), vr: rand(-18, 18), land: true, landAlpha: 1 });
      }
      this.decals.draw('fx', 'splat_3', x, y, rand(0, 6), sc * 1.2, 0xffffff, 0.9);
    } else if (body) this.corpse(body, x, y, a, burn);
    if (burn) for (let i = 0; i < 5; i++) this.high.emit({ frame: 'smoke', x, y, vx: rand(-40, 40), vy: rand(-40, 40), life: rand(0.8, 1.6), drag: 1.5, s0: 0.3, s1: 1.4, a0: 0.5, a1: 0, rot: rand(0, 6), tint: 0x333333 });
    sfx.play('death', { x, y, vol: 0.7, max: 5, rate: t === 'fat' || t === 'boss' ? 0.6 : t === 'fast' || t === 'chick' ? 1.35 : 1 });
    sfx.play('splat', { x, y, vol: 0.5, max: 4 });
  }

  /** Plays the LPC collapse (hurt) frames sliding along the hit, then stamps the body into the floor decals. */
  corpse(body: { tex: string; frame: string; frames: string[]; scale: number }, x: number, y: number, a: number, burn: boolean) {
    const tint = burn ? 0x4a3a30 : 0xffffff;
    if (!body.frames.length) { this.decals.draw(body.tex, body.frame, x, y - 6, rand(-0.3, 0.3) + Math.PI / 2, body.scale, tint, 0.95); return; }
    const spr = this.scene.add.sprite(x, y, body.tex, body.frames[0]).setOrigin(0.5, 62 / 64).setScale(body.scale).setDepth(8 + y / 100000).setTint(tint);
    const sp = 90;
    this.falling.push({ spr, t: 0, frames: body.frames, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, tint });
    if (this.falling.length > 24) this.finishFall(this.falling.shift()!);
  }

  private finishFall(f: { spr: Phaser.GameObjects.Sprite; frames: string[]; tint: number }) {
    const s = f.spr;
    // stamp centred on the sprite's visible body (origin at the feet)
    this.decals.draw(s.texture.key, f.frames[f.frames.length - 1], s.x, s.y - 30 * s.scaleY, 0, s.scaleX, f.tint, 1);
    s.destroy();
  }

  boom(x: number, y: number, r: number, kind: string) {
    const s = r / 150;
    this.high.emit({ frame: 'glow', x, y, vx: 0, vy: 0, life: 0.35, s0: r / 30, s1: r / 24, a0: 1, a1: 0, tint: 0xffd27a, add: true });
    this.high.emit({ frame: 'flash_star', x, y, vx: 0, vy: 0, life: 0.12, s0: 2.5 * s, s1: 4 * s, a0: 1, a1: 0, rot: rand(0, 6), add: true });
    this.high.emit({ frame: 'ring', x, y, vx: 0, vy: 0, life: 0.32, s0: 0.3, s1: r / 52, a0: 0.8, a1: 0, add: true, tint: 0xfff0c0 });
    this.light(x, y, r * 4, 0xffb060, 1, 0.45);
    for (let i = 0; i < 34 * s; i++) {
      const aa = rand(0, 6.28), sp = rand(40, 340) * s;
      this.high.emit({ frame: 'fire', x: x + rand(-10, 10), y: y + rand(-10, 10), vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.35, 0.8), drag: 3.5, s0: rand(0.8, 1.4) * s, s1: rand(1.8, 3) * s, a0: 1, a1: 0, tint: 0xfff3b0, tint1: 0xff3a00, add: true, rot: rand(0, 6) });
    }
    for (let i = 0; i < 18 * s; i++) {
      const aa = rand(0, 6.28), sp = rand(30, 220) * s;
      this.high.emit({ frame: 'smoke', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(1.0, 2.2), drag: 1.8, s0: 0.6 * s, s1: rand(2.0, 3.0) * s, a0: 0.42, a1: 0, rot: rand(0, 6), vr: rand(-0.6, 0.6), tint: kind === 'exploder' ? 0x8fbf5a : 0x6b655e });
    }
    for (let i = 0; i < 30; i++) {
      const aa = rand(0, 6.28), sp = rand(300, 1100);
      this.high.emit({ frame: 'spark', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.15, 0.5), drag: 4, s0: 1, s1: 0.2, sx: 2, a0: 1, a1: 0, alignVel: true, add: true, tint: 0xffc060 });
    }
    for (let i = 0; i < 10; i++) {
      const aa = rand(0, 6.28), sp = rand(150, 500);
      this.low.emit({ frame: 'chunk', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.4, 0.8), drag: 4, s0: rand(0.8, 1.4), s1: 1, rot: rand(0, 6), vr: rand(-20, 20), land: true, landAlpha: 0.9, tint: 0x555555 });
    }
    if (kind === 'exploder') {
      this.decals.draw('fx', 'goo_0', x, y, rand(0, 6), r / 40, 0xffffff, 0.85);
      for (let i = 0; i < 20; i++) this.feather(x, y, rand(0, 6.28), rand(100, 450), 0xffd2bd);
    }
    this.decals.draw('fx', 'scorch', x, y, rand(0, 6), r / 95, 0xffffff, 0.6);
    sfx.play('explosion', { x, y, vol: 1, max: 4 });
  }

  /** Flamethrower jet, called every frame while firing. */
  flame(x: number, y: number, a: number, dt: number, vx = 0, vy = 0) {
    const range = this.map ? Math.min(WEAPONS.flamethrower.range + 20, this.map.raycast(x, y, a, 300, true).d) : 260;
    const n = Math.max(1, Math.round(dt * 110));
    for (let i = 0; i < n; i++) {
      const aa = a + rand(-0.13, 0.13), sp = rand(480, 620);
      const life = Math.max(0.06, (range / sp) * rand(0.8, 1.05));
      this.high.emit({ frame: 'fire', x: x + rand(-3, 3), y: y + rand(-3, 3), vx: Math.cos(aa) * sp + vx, vy: Math.sin(aa) * sp + vy, life, drag: 0.6, s0: rand(0.2, 0.35), s1: rand(1.5, 2.2), a0: 0.95, a1: 0.05, tint: 0xfff6c8, tint1: 0xff3a00, add: true, rot: rand(0, 6), vr: rand(-4, 4) });
    }
    if (Math.random() < dt * 25) {
      const d = range * rand(0.6, 1);
      this.high.emit({ frame: 'smoke', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: rand(0.8, 1.4), drag: 1.5, s0: 0.4, s1: 1.6, a0: 0.35, a1: 0, rot: rand(0, 6), tint: 0x2e2a28 });
    }
    if (Math.random() < dt * 6) {
      const d = range * rand(0.75, 1);
      this.decals.draw('fx', 'scorch', x + Math.cos(a) * d + rand(-15, 15), y + Math.sin(a) * d + rand(-15, 15), rand(0, 6), rand(0.25, 0.45), 0xffffff, 0.35);
    }
    this.glow(x + Math.cos(a) * 60, y + Math.sin(a) * 60, 150, 0xff9a3c, 0.35, 0.06);
    this.light(x + Math.cos(a) * 90, y + Math.sin(a) * 90, 380, 0xff9a3c, 1, 0.06);
  }

  burning(x: number, y: number, dt: number, s = 1) {
    if (Math.random() < dt * 30) {
      this.high.emit({ frame: 'fire', x: x + rand(-12, 12) * s, y: y + rand(-12, 12) * s, vx: rand(-20, 20), vy: rand(-20, 20), life: rand(0.25, 0.45), s0: 0.4 * s, s1: 1.1 * s, a0: 0.9, a1: 0, tint: 0xfff3b0, tint1: 0xff3a00, add: true, rot: rand(0, 6) });
    }
    if (Math.random() < dt * 4) this.light(x, y, 200, 0xff8a30, 0.9, 0.3);
  }

  splat(x: number, y: number, kind: 'spit' | 'egg' | 'grenade') {
    if (kind === 'egg') {
      this.decals.draw('fx', 'splat_2', x, y, rand(0, 6), 0.8, 0xffd84a, 0.9);
      for (let i = 0; i < 6; i++) { const aa = rand(0, 6.28), sp = rand(60, 200); this.low.emit({ frame: 'shard', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: 0.4, drag: 6, s0: 1, s1: 1, rot: rand(0, 6), vr: rand(-10, 10), tint: 0xfff8e8, land: true }); }
      sfx.play('splat', { x, y, vol: 0.6 });
      return;
    }
    this.decals.draw('fx', 'goo_0', x, y, rand(0, 6), rand(0.5, 0.8), 0xffffff, 0.85);
    for (let i = 0; i < 8; i++) { const aa = rand(0, 6.28), sp = rand(60, 260); this.low.emit({ frame: 'blood_drop', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: 0.3, drag: 6, s0: 1, s1: 0.7, tint: 0x9be22e, land: true }); }
    this.glow(x, y, 60, 0x9be22e, 0.5, 0.15);
    sfx.play('splat', { x, y, vol: 0.5, rate: 1.3 });
  }

  spawnPuff(x: number, y: number, how: string) {
    for (let i = 0; i < 8; i++) {
      const aa = rand(0, 6.28), sp = rand(40, 160);
      this.high.emit({ frame: 'smoke', x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: rand(0.5, 0.9), drag: 3, s0: 0.3, s1: 1, a0: 0.5, a1: 0, rot: rand(0, 6), tint: how === 'egg' ? 0xfff8e8 : 0x9a948a });
    }
    if (how === 'egg') for (let i = 0; i < 5; i++) { const aa = rand(0, 6.28); this.low.emit({ frame: 'shard', x, y, vx: Math.cos(aa) * 120, vy: Math.sin(aa) * 120, life: 0.4, drag: 6, s0: 1, s1: 1, tint: 0xfff8e8, land: true, rot: rand(0, 6) }); }
  }

  update(dt: number) {
    this.low.update(dt);
    let fw = 0;
    for (const f of this.falling) {
      f.t += dt;
      const k = Math.min(1, f.t / 0.42);
      f.spr.setFrame(f.frames[Math.min(f.frames.length - 1, Math.floor(k * f.frames.length))]);
      const drag = Math.exp(-dt * 7); f.vx *= drag; f.vy *= drag;
      f.spr.x += f.vx * dt; f.spr.y += f.vy * dt;
      if (f.t > 0.6) { this.finishFall(f); continue; }
      this.falling[fw++] = f;
    }
    this.falling.length = fw;
    this.decals.flush();
    this.high.update(dt);
    // tracers: a bright streak travelling from muzzle to impact
    let w = 0;
    for (const t of this.tracers) {
      t.head = Math.min(t.d, t.head + t.speed * dt);
      t.tail = Math.max(t.tail, t.head - t.L);
      if (t.head >= t.d) t.tail += t.speed * dt * 0.8;
      if (t.tail >= t.d) { t.img.setVisible(false).setActive(false); this.tracerPool.push(t.img); continue; }
      const k = t.head / t.d;
      t.img.setPosition(t.x1 + (t.x2 - t.x1) * k, t.y1 + (t.y2 - t.y1) * k);
      t.img.setDisplaySize(Math.max(2, t.head - t.tail), 8 * t.w);
      this.tracers[w++] = t;
    }
    this.tracers.length = w;
    // lights
    let lw = 0;
    for (const l of this.lights) {
      l.t += dt;
      if (l.t >= l.life) continue;
      if (l.follow) { const p = l.follow(); if (!p) continue; l.x = p.x; l.y = p.y; }
      this.lights[lw++] = l;
    }
    this.lights.length = lw;
    // camera trauma decay
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const kd = Math.exp(-dt * 14);
    this.kickX *= kd; this.kickY *= kd;
  }
}
