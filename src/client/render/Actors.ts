import { BLEEDOUT } from '../../shared/sim/support';
import Phaser from 'phaser';
import { TEXT_RES } from '../settings';
import artMeta from '../../shared/generated/artMeta.json';
import type { WeaponId } from '../../shared/weapons';
import { MUTATION, type Enemy, type Npc, type Player } from '../../shared/sim/types';
import type { EnemyType } from '../../shared/enemies';
import { enemyLook, resolveLook, SKIN_TONES, LOOK_PRESETS } from '../../shared/look';
import { lookTexture } from './Looks';
import { WalkingCycle } from './WalkingCycle';

export const PLAYER_COLORS = [0x4fc3f7, 0xff6b6b, 0xffd54f, 0x81c784];
const GUNS = (artMeta as any).guns as Record<string, { gripX: number; gripY: number; muzzle: number; w: number; h: number }>;

import { HAND_H, ENEMY_SCALE, enemyScale } from '../../shared/sim/hitbox';
/** Height of the gun (hand) above the feet, world units. Bullets, tracers and impacts render at this height. */
export { HAND_H };
/** Kept for imports: everything is 2.5D now. */
export const BODY_HEIGHT = HAND_H;
export const worldDepth = (y: number) => 8 + y / 100000;
export const direction = (a: number) => ['e', 's', 'w', 'n'][((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4];
const FEET = 62 / 64;

/** Fists of the armed pose (LPC thrust frame 4, ×2) relative to the feet, per facing. */
const GRIP: Record<string, [number, number]> = { e: [26, -36], w: [-26, -36], s: [0, -36], n: [0, -40] };
/** Where the hands holding the gun are, relative to the feet. */
function gripOf(x: number, y: number, a: number, recoil = 0) {
  const c = Math.cos(a), s = Math.sin(a), [gx, gy] = GRIP[direction(a)];
  return { x: x + gx + c * (2 - recoil), y: y + gy + s * (2 - recoil * 0.5) };
}
export function muzzleOf(x: number, y: number, a: number, w: WeaponId, recoil = 0, _elevation = 0) {
  const g = gripOf(x, y, a, recoil), m = GUNS[w]?.muzzle ?? 20;
  return { x: g.x + Math.cos(a) * m, y: g.y + Math.sin(a) * m };
}
export function ejectOf(x: number, y: number, a: number, _elevation = 0) {
  const g = gripOf(x, y, a);
  return { x: g.x + Math.cos(a) * 6, y: g.y + Math.sin(a) * 6 - 4 };
}

const skinTint = (look: string) => parseInt(SKIN_TONES[resolveLook(look).skin] ?? SKIN_TONES[0], 16);

/** Directed LPC body + weapon held in the hand + shadow. Used by players and NPCs. */
export class Rig {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  weapon: Phaser.GameObjects.Image;
  hand: Phaser.GameObjects.Rectangle;
  shadow: Phaser.GameObjects.Ellipse;
  recoil = 0;
  private walk = new WalkingCycle();
  w: WeaponId | null = null;
  tex: string;
  mutTex: string;

  constructor(private scene: Phaser.Scene, public look: string) {
    this.tex = lookTexture(scene, look);
    this.mutTex = '';
    this.shadow = scene.add.ellipse(0, 0, 34, 11, 0x000000, 0.28);
    this.body = scene.add.sprite(0, 0, this.tex, 's_0').setOrigin(0.5, FEET).setScale(2);
    this.weapon = scene.add.image(0, 0, 'office25', 'gun_pistol').setVisible(false);
    this.hand = scene.add.rectangle(0, 0, 5, 5, skinTint(look)).setStrokeStyle(1, 0x2a2328).setVisible(false);
    this.root = scene.add.container(0, 0, [this.shadow, this.body, this.weapon, this.hand]);
  }

  mutantTexture() { return this.mutTex ||= lookTexture(this.scene, this.look, true); }

  setWeapon(w: WeaponId | null) {
    if (w === this.w) return;
    this.w = w;
    if (!w) { this.weapon.setVisible(false); this.hand.setVisible(false); return; }
    const m = GUNS[w];
    this.weapon.setVisible(true).setFrame('gun_' + w).setOrigin(m.gripX / m.w, m.gripY / m.h);
    this.hand.setVisible(true);
  }

  /** dir/frame selection + gun placement. `frame` overrides the walking frame (e.g. hurt poses). */
  layout(x: number, y: number, a: number, moving: boolean, dt: number, frame?: string) {
    this.recoil *= Math.exp(-dt * 18);
    const dir = direction(a);
    const f = this.walk.update(x, y, dt, moving && !frame);
    moving = f !== 0;
    // Torso, fists and gun share the same integer gait offset. No independent weapon bob.
    const gait = moving ? [0, -2, -2, 0, 0, -2, -2, 0][(f - 1) % 8] : 0;
    this.root.setPosition(x, y).setDepth(worldDepth(y));
    // armed: upper body in the two-handed pose (hands forward), legs keep walking
    this.body.setFrame(frame ?? (this.w ? `a${dir}_${f}` : `${dir}_${f}`)).setPosition(0, this.w && !frame ? gait : 0).setRotation(0);
    if (this.w && !frame) {
      const g = gripOf(0, 0, a, this.recoil);
      const c = Math.cos(a);
      this.weapon.setPosition(g.x, g.y + gait).setRotation(a).setFlipY(c < 0).setVisible(true);
      this.hand.setVisible(false); // the hands are part of the armed body frame
      // side views: the gun sits behind the body so the fists (part of the body frame) close over the grip;
      // facing away it is hidden behind the back; facing the camera it is held in front
      const back = dir !== 's';
      this.root.moveTo(this.weapon, back ? 1 : 2);
      this.root.moveTo(this.hand, back ? 2 : 3);
    } else if (this.w) { this.weapon.setVisible(false); this.hand.setVisible(false); }
  }

  destroy() { this.root.destroy(); }
}

export class PlayerView {
  rig: Rig;
  ring: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  /** D66: bleed-out countdown around a downed player (shrinking red arc) and revive progress (green) */
  timer: Phaser.GameObjects.Graphics;
  lastState = '';
  dispX = 0; dispY = 0; dispA = 0;
  showName: boolean;

  constructor(scene: Phaser.Scene, public p: Player, showName: boolean) {
    this.showName = showName;
    const color = PLAYER_COLORS[p.slot % 4];
    this.ring = scene.add.image(0, 0, 'fx', 'ring_player').setTint(color).setAlpha(0.7).setDepth(7).setScale(0.7, 0.42);
    this.rig = new Rig(scene, p.look || LOOK_PRESETS['p' + (p.slot % 4)]);
    this.label = scene.add.text(0, 0, p.name, { fontFamily: 'Rubik, sans-serif', fontSize: '12px', fontStyle: '600', color: '#ffffff', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(40).setVisible(showName).setResolution(TEXT_RES());
    this.timer = scene.add.graphics().setDepth(8);
    this.dispX = p.x; this.dispY = p.y;
  }

  sync(p: Player, x: number, y: number, a: number, dt: number, time: number) {
    this.p = p;
    const moving = Math.hypot(x - this.dispX, y - this.dispY) > 0.5;
    this.dispX = x; this.dispY = y; this.dispA = a;
    const visible = p.state !== 'dead';
    this.rig.root.setVisible(visible);
    this.ring.setVisible(visible);
    this.label.setVisible(visible && this.showName);
    this.rig.setWeapon(p.state === 'downed' ? null : (p.weapons[p.cur] as WeaponId) ?? null);
    if (p.state === 'downed') {
      this.rig.layout(x, y, a, false, dt, 'hurt_4');
      this.rig.body.setTint(Math.sin(time * 8) > 0 ? 0xff9a9a : 0xffffff);
    } else {
      this.rig.layout(x, y, a, moving, dt);
      this.rig.body.setTint(p.hurtT > 0.15 ? 0xff8080 : 0xffffff);
    }
    this.ring.setPosition(x, y + 2).setTint((p.buffs?.invincible ?? 0) > 0 ? 0xffd65c : (p.slowT ?? 0) > 0 ? 0x4f9a32 : PLAYER_COLORS[p.slot % 4]);
    // D73: held by potato tops — green leaves wrapped around the legs
    const held = (p.slowT ?? 0) > 0 && p.state === 'alive';
    if (held && !this.vines) this.vines = this.rig.root.scene.add.graphics().setDepth(worldDepth(y) + 0.00001);
    if (this.vines) {
      this.vines.clear().setVisible(held);
      if (held) {
        this.vines.setDepth(worldDepth(y) + 0.00001);
        for (let k = 0; k < 7; k++) {
          const a = k / 7 * Math.PI * 2 + time * 0.6, lx = x + Math.cos(a) * 16, ly = y - 6 + Math.sin(a) * 6;
          this.vines.fillStyle(k % 2 ? 0x4f9a32 : 0x8fd16b, 0.95).fillTriangle(lx - 5, ly, lx + 5, ly, lx + Math.cos(a) * 4, ly - 26 - (k % 3) * 6);
        }
      }
    }
    this.label.setPosition(x, y - 104).setText(p.state === 'downed' ? `${p.name} ✚ ${Math.ceil(p.downT)}` : p.name);
    const g = this.timer.clear();
    if (p.state === 'downed') {
      const left = Math.max(0, Math.min(1, p.downT / BLEEDOUT)), r = 34, cy = y - 4;
      const top = -Math.PI / 2;
      g.lineStyle(7, 0x000000, 0.45).strokeCircle(x, cy, r);
      g.lineStyle(5, left < 0.3 ? 0xff3b2f : 0xff8a4a, 0.95).beginPath().arc(x, cy, r, top, top + left * Math.PI * 2, false).strokePath();
      if (p.reviveT > 0) g.lineStyle(3, 0x6dff7a, 1).beginPath().arc(x, cy, r - 7, top, top + Math.min(1, p.reviveT) * Math.PI * 2, false).strokePath();
    }
  }

  private vines?: Phaser.GameObjects.Graphics;
  destroy() { this.rig.destroy(); this.ring.destroy(); this.label.destroy(); this.timer.destroy(); this.vines?.destroy(); }
}

/** Visual height of the body (world units) for aiming at the torso and placing labels. */
export const enemyHeight = (t: EnemyType) => t === 'chick' ? 26 : ENEMY_SCALE[t] * 48;
/** How many distinct random looks per enemy type are used (keeps texture compositions bounded). */
export const LOOK_POOL = 5;
export const enemyLookKey = (e: Pick<Enemy, 'type' | 'id' | 'appearance'>) => e.appearance?.kind ?? enemyLook(e.type, (e.id % LOOK_POOL) * 97 + e.type.length * 13);

export class EnemyView {
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label?: Phaser.GameObjects.Text;
  anim = Math.random() * 4;
  flashT = 0;
  punch = 0;
  lastX: number; lastY: number;
  dispX: number; dispY: number;
  fuse = false;
  bird: boolean;
  tex: string;
  lookKey: string;
  type: EnemyType;
  scale: number;

  constructor(scene: Phaser.Scene, e: Enemy) {
    this.type = e.type;
    this.scale = enemyScale(e);
    this.bird = e.type === 'chick';
    this.lookKey = enemyLookKey(e);
    this.tex = this.bird ? 'office25' : lookTexture(scene, this.lookKey, true);
    this.shadow = scene.add.ellipse(e.x, e.y, this.bird ? 22 : 30 * this.scale / 2, this.bird ? 8 : 10 * this.scale / 2, 0x000000, 0.28).setDepth(6);
    this.spr = scene.add.sprite(e.x, e.y, this.tex, this.bird ? 'chick_s_0' : 's_0').setOrigin(0.5, this.bird ? 0.9 : FEET).setScale(this.scale);
    if (e.appearance) this.label = scene.add.text(e.x, e.y, e.appearance.name, { fontFamily: 'Rubik, sans-serif', fontSize: '11px', color: '#ffad73', stroke: '#151515', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(40).setResolution(TEXT_RES());
    this.lastX = this.dispX = e.x; this.lastY = this.dispY = e.y;
  }

  sync(e: Enemy, x: number, y: number, dt: number, time: number) {
    const moved = Math.hypot(x - this.lastX, y - this.lastY);
    this.lastX = x; this.lastY = y;
    this.dispX = x; this.dispY = y;
    this.anim += moved * (this.bird ? 0.2 : 0.09);
    const dir = direction(e.angle);
    const walking = moved > 0.1;
    let frame = this.bird ? `chick_${dir}_${walking ? Math.floor(this.anim) % 3 : 0}` : `${dir}_${walking ? 1 + Math.floor(this.anim) % 8 : 0}`;
    // windup: lean in with the attack frame of the walk cycle
    let lunge = 0;
    if (e.state === 'windup' || (e.state === 'charge' && e.ability === 'charge_wind')) { lunge = 6; if (!this.bird) frame = `${dir}_${Math.floor(time * 18) % 2 ? 3 : 7}`; }
    this.spr.setFrame(frame);
    this.punch *= Math.exp(-dt * 14);
    let s = this.scale * (1 + this.punch);
    if (e.state === 'rise') s *= 0.5 + 0.5 * (1 - Math.max(0, e.t) / 0.55);
    if (this.fuse || e.state === 'fuse') s *= 1 + Math.abs(Math.sin(time * 22)) * 0.12;
    const lx = Math.cos(e.angle) * lunge, ly = Math.sin(e.angle) * lunge * 0.6;
    // D71: a jumper in the air — an arc above its shadow
    const hop = e.type === 'jumper' && e.state === 'charge' ? Math.sin(Math.PI * Math.min(1, Math.max(0, 1 - e.t / 0.55))) * 70 : 0;
    // D72: the CEO is a fattened rooster — drawn wider than tall
    this.spr.setPosition(x + lx, y + ly - hop).setScale(this.type === 'boss' ? s * 1.3 : s, s).setDepth(worldDepth(y));
    this.shadow.setPosition(x, y);
    this.label?.setPosition(x, y - this.scale * 48 - 14);
    this.flashT -= dt;
    if (this.flashT > 0) this.spr.setTintFill(0xffffff);
    else if (e.state === 'fuse' || ((e.type === 'boss' || e.type === 'jumper') && e.state === 'charge')) this.spr.setTint(Math.sin(time * 30) > 0 ? 0xff4040 : 0xffffff);
    else if (e.type === 'exploder') this.spr.setTint(Math.sin(time * 6) > 0.6 ? 0xc8ff8a : 0xffffff);
    else if (e.type === 'gmo') this.spr.setTint(Math.sin(time * 3 + e.id) > 0.75 ? 0xd8ff9a : 0xffffff);
    else if (e.burnT > 0) this.spr.setTint(0xffb080);
    else this.spr.clearTint();
    this.spr.setAlpha(e.state === 'rise' ? 0.6 : 1);
  }

  /** Texture/frame used for the corpse decal. */
  corpse(): { tex: string; frame: string; frames: string[] } {
    if (this.bird) { const d = this.spr.frame.name.split('_')[1] ?? 's'; return { tex: 'office25', frame: `chick_${d}_0`, frames: [] }; }
    return { tex: this.tex, frame: 'hurt_4', frames: ['hurt_0', 'hurt_1', 'hurt_2', 'hurt_3', 'hurt_4'] };
  }

  hit() { this.flashT = 0.06; this.punch = 0.12; }

  /** D69 floor 8: glowing red eyes drawn above the darkness (depth 31); dim while asleep, blink now and then. */
  private eyeL?: Phaser.GameObjects.Rectangle;
  private eyeR?: Phaser.GameObjects.Rectangle;
  private eyeGlow?: Phaser.GameObjects.Image;
  eyes(scene: Phaser.Scene, e: Enemy, dark: number, time: number) {
    if (this.bird || dark < 0.35) { this.eyeL?.setVisible(false); this.eyeR?.setVisible(false); this.eyeGlow?.setVisible(false); return; }
    if (!this.eyeL) {
      this.eyeL = scene.add.rectangle(0, 0, 4, 3, 0xff2a1a).setDepth(31);
      this.eyeR = scene.add.rectangle(0, 0, 4, 3, 0xff2a1a).setDepth(31);
      this.eyeGlow = scene.add.image(0, 0, 'fx', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2010).setDepth(31).setScale(0.35);
    }
    const S = this.scale, dir = direction(e.angle);
    const awake = e.state !== 'idle';
    const blink = Math.sin(time * 1.3 + e.id * 1.7) > 0.97;
    const a = (awake ? 1 : 0.45) * Math.min(1, (dark - 0.35) * 3) * (blink ? 0 : 1);
    const x = this.spr.x, y = this.spr.y - 41 * S, sz = Math.max(1.5, S * 1.6);
    const show = dir !== 'n' && a > 0.02;
    this.eyeL!.setVisible(show).setAlpha(a).setSize(sz * 1.4, sz);
    this.eyeR!.setVisible(show && dir === 's').setAlpha(a).setSize(sz * 1.4, sz);
    if (dir === 's') { this.eyeL!.setPosition(x - 4 * S, y); this.eyeR!.setPosition(x + 4 * S, y); }
    else this.eyeL!.setPosition(x + (dir === 'e' ? 5 : -5) * S, y);
    this.eyeGlow!.setVisible(show).setAlpha(a * 0.6).setPosition(x, y).setScale(0.25 * S);
  }
  destroy() { this.spr.destroy(); this.shadow.destroy(); this.label?.destroy(); this.eyeL?.destroy(); this.eyeR?.destroy(); this.eyeGlow?.destroy(); }
}

export class NpcView {
  rig: Rig;
  label: Phaser.GameObjects.Text;
  warn?: Phaser.GameObjects.Graphics;
  private lastX = NaN;
  private lastY = NaN;
  constructor(private scene: Phaser.Scene, n: Npc) {
    this.rig = new Rig(scene, n.kind);
    this.rig.setWeapon(n.weapon);
    this.label = scene.add.text(0, 0, n.name, { fontFamily: 'Rubik, sans-serif', fontSize: '12px', color: '#d8f3ff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(40).setResolution(TEXT_RES());
  }
  sync(n: Npc, x: number, y: number, dt: number, time: number, near: boolean) {
    const moving = Number.isFinite(this.lastX) && Math.hypot(x - this.lastX, y - this.lastY) > .5;
    this.lastX = x; this.lastY = y;
    this.rig.setWeapon(n.weapon);
    if (n.mode === 'dead' || n.mode === 'gone') { this.warn?.clear().setVisible(false); this.rig.root.setVisible(false); this.label.setVisible(false); return; }
    this.rig.root.setVisible(true);
    const a = n.angle;
    if (n.mutation) {
      // twitch → feathers (flicker between human and chicken-person) → dark silhouette → enemy
      const st = n.mutation.stage;
      this.rig.setWeapon(null);
      const flick = st === 'twitch' ? Math.sin(time * 9) > 0.85 : st === 'feathers' ? Math.sin(time * 20) > -0.2 : true;
      this.rig.body.setTexture(flick ? this.rig.mutantTexture() : this.rig.tex);
      this.rig.layout(x, y, a, false, dt, `${direction(a)}_${Math.floor(time * 14) % 2 ? 3 : 0}`);
      this.rig.root.x += Math.sin(time * 55) * (st === 'twitch' ? 1.5 : 3);
      if (st === 'silhouette') this.rig.body.setTintFill(0x2a2633); else this.rig.body.setTint(Math.sin(time * 22) > 0 ? 0xffbd7a : 0xffffff);
      this.rig.body.setScale(2 * (1 + Math.sin(time * 16) * 0.05));
      this.label.setPosition(x, y - 118).setVisible(true).setText('⚠ ' + n.name + ' ПРЕВРАЩАЕТСЯ!').setColor(Math.sin(time * 12) > 0 ? '#ff6a4a' : '#ffd36a');
      // progress bar over the head + pulsing danger ring on the floor
      const g = this.warn ??= this.scene.add.graphics().setDepth(39);
      const k = Math.min(1, n.mutation.elapsed / MUTATION.done);
      g.clear().setVisible(true);
      g.fillStyle(0x000000, 0.6).fillRect(x - 26, y - 114, 52, 7);
      g.fillStyle(k > 0.66 ? 0xff3b30 : k > 0.33 ? 0xff9a2e : 0xffd23a, 1).fillRect(x - 25, y - 113, 50 * k, 5);
      const pulse = (time * 2.2) % 1;
      g.lineStyle(3, 0xff4a2a, 0.8 * (1 - pulse)).strokeEllipse(x, y, 40 + pulse * 70, (40 + pulse * 70) * 0.42);
      return;
    }
    this.warn?.setVisible(false);
    if (this.rig.body.texture.key !== this.rig.tex) this.rig.body.setTexture(this.rig.tex);
    this.rig.body.setScale(2);
    this.rig.layout(x, y, a, moving, dt, n.mode === 'cower' ? (Math.sin(time * 3) > 0 ? 'hurt_1' : 'hurt_2') : undefined);
    if (n.mode === 'cower') this.rig.root.x += Math.sin(time * 30) * 0.8;
    this.rig.body.setTint(n.hurtT > 0 ? 0xff8080 : 0xffffff);
    this.label.setPosition(x, y - 104).setVisible(near).setText(n.name).setColor('#d8f3ff');
  }
  corpse() { return { tex: this.rig.tex, frame: 'hurt_4', frames: ['hurt_0', 'hurt_1', 'hurt_2', 'hurt_3', 'hurt_4'] }; }
  destroy() { this.rig.destroy(); this.label.destroy(); this.warn?.destroy(); }
}
