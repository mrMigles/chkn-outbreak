import Phaser from 'phaser';
import { TEXT_RES } from '../settings';
import artMeta from '../../shared/generated/artMeta.json';
import { ENEMIES } from '../../shared/enemies';
import type { WeaponId } from '../../shared/weapons';
import type { Enemy, Npc, Player } from '../../shared/sim/types';

export const PLAYER_COLORS = [0x4fc3f7, 0xff6b6b, 0xffd54f, 0x81c784];
export const PLAYER_BODIES = ['survivor', 'soldier', 'womanGreen', 'hitman'];
const WMETA = artMeta.weapons as Record<string, { gripX: number; muzzle: number; hands: number[][]; w: number; h: number }>;

/** Where the weapon is held relative to the body centre (facing +X). */
const ATTACH_X = 6, ATTACH_Y = 8;

export function muzzleOf(x: number, y: number, a: number, w: WeaponId, recoil = 0) {
  const m = WMETA[w];
  const lx = ATTACH_X + m.muzzle - recoil, ly = ATTACH_Y;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x + lx * c - ly * s, y: y + lx * s + ly * c };
}
export function ejectOf(x: number, y: number, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x + 14 * c - 12 * s, y: y + 14 * s + 12 * c };
}

/** Body + weapon + hands rig used by players and armed NPCs. */
export class Rig {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  weapon: Phaser.GameObjects.Image;
  hands: Phaser.GameObjects.Image[];
  recoil = 0;
  bob = 0;
  w: WeaponId | null = null;
  handFrame: string;

  constructor(scene: Phaser.Scene, bodyFrame: string, handFrame: string, depth = 10) {
    this.handFrame = handFrame;
    this.weapon = scene.add.image(0, 0, 'chars', 'w_pistol');
    this.hands = [scene.add.image(0, 0, 'chars', handFrame), scene.add.image(0, 0, 'chars', handFrame)];
    this.body = scene.add.image(0, 0, 'chars', bodyFrame);
    this.root = scene.add.container(0, 0, [this.weapon, ...this.hands, this.body]).setDepth(depth);
    // hands are drawn above the body for long guns (Kenney style)
    this.root.bringToTop(this.weapon);
    this.hands.forEach((h) => this.root.bringToTop(h));
  }

  setWeapon(w: WeaponId | null) {
    if (w === this.w) return;
    this.w = w;
    if (!w) { this.weapon.setVisible(false); this.hands.forEach((h) => h.setVisible(false)); return; }
    const m = WMETA[w];
    this.weapon.setVisible(true).setFrame('w_' + w).setOrigin(m.gripX / m.w, 0.5);
    this.hands.forEach((h) => h.setVisible(true));
  }

  layout(x: number, y: number, a: number, moving: boolean, dt: number) {
    this.recoil *= Math.exp(-dt * 18);
    if (moving) this.bob += dt * 11;
    this.root.setPosition(x, y).setRotation(a);
    const sway = moving ? Math.sin(this.bob) * 0.035 : 0;
    this.body.setRotation(sway);
    this.body.setScale(1 + (moving ? Math.abs(Math.sin(this.bob)) * 0.03 : 0));
    this.body.setPosition(-this.recoil * 0.3, 0);
    if (this.w) {
      const m = WMETA[this.w];
      const wx = ATTACH_X - this.recoil, wy = ATTACH_Y;
      this.weapon.setPosition(wx, wy);
      m.hands.forEach(([hx, hy], i) => this.hands[i].setPosition(wx + hx, wy + hy));
    }
  }

  destroy() { this.root.destroy(); }
}

export class PlayerView {
  rig: Rig;
  ring: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  chickenBody = false;
  lastState = '';
  dispX = 0; dispY = 0; dispA = 0;

  constructor(scene: Phaser.Scene, public p: Player, showName: boolean) {
    const color = PLAYER_COLORS[p.slot % 4];
    this.ring = scene.add.image(0, 0, 'fx', 'ring_player').setTint(color).setAlpha(0.75).setDepth(8).setScale(0.75);
    this.rig = new Rig(scene, PLAYER_BODIES[p.slot % 4] + '_stand', 'hand_glove');
    this.label = scene.add.text(0, 0, p.name, { fontFamily: 'Rubik, sans-serif', fontSize: '13px', fontStyle: '600', color: '#ffffff', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(40).setVisible(showName).setResolution(TEXT_RES());
    this.dispX = p.x; this.dispY = p.y;
  }

  sync(p: Player, x: number, y: number, a: number, dt: number, time: number) {
    this.p = p;
    const moving = Math.hypot(x - this.dispX, y - this.dispY) > 0.5;
    this.dispX = x; this.dispY = y; this.dispA = a;
    const chicken = p.state === 'chicken';
    if (chicken !== this.chickenBody) {
      this.chickenBody = chicken;
      this.rig.body.setFrame(chicken ? 'ck_player_armed' : PLAYER_BODIES[p.slot % 4] + '_stand');
      this.rig.hands.forEach((h) => h.setFrame(chicken ? 'hand_claw' : 'hand_glove'));
    }
    const visible = p.state !== 'dead';
    this.rig.root.setVisible(visible);
    this.ring.setVisible(visible);
    this.label.setVisible(visible && this.label.visible !== false);
    this.rig.setWeapon(p.state === 'downed' ? null : p.weapons[p.cur] ?? null);
    if (p.state === 'downed') {
      this.rig.layout(x, y, a, false, dt);
      this.rig.root.setRotation(a + 0.9);
      this.rig.body.setTint(Math.sin(time * 8) > 0 ? 0xff7777 : 0xffffff);
    } else {
      this.rig.layout(x, y, a, moving, dt);
      this.rig.body.setTint(p.hurtT > 0.15 ? 0xff8080 : 0xffffff);
    }
    this.ring.setPosition(x, y).setTint(chicken ? 0xff3b30 : PLAYER_COLORS[p.slot % 4]);
    this.label.setPosition(x, y - 34).setText(p.state === 'downed' ? `${p.name} ✚ ${Math.ceil(p.downT)}` : p.name);
    this.label.setColor(chicken ? '#ff6b6b' : '#ffffff');
  }

  destroy() { this.rig.destroy(); this.ring.destroy(); this.label.destroy(); }
}

const ENEMY_SCALE: Record<string, number> = { chick: 0.7 };

export class EnemyView {
  spr: Phaser.GameObjects.Image;
  frameBase: string;
  anim = Math.random() * 4;
  flashT = 0;
  punch = 0;
  lastX: number; lastY: number;
  dispX: number; dispY: number;
  fuse = false;
  constructor(scene: Phaser.Scene, e: Enemy) {
    const def = ENEMIES[e.type];
    this.frameBase = def.sprite[e.variant % def.sprite.length];
    this.spr = scene.add.image(e.x, e.y, 'chars', this.frameBase + '_walk0').setDepth(e.type === 'boss' ? 11 : 9);
    this.lastX = this.dispX = e.x; this.lastY = this.dispY = e.y;
  }
  get baseScale() { return ENEMY_SCALE[this.frameBase === 'ck_fast' ? '' : ''] ?? 1; }

  sync(e: Enemy, x: number, y: number, dt: number, time: number) {
    const moved = Math.hypot(x - this.lastX, y - this.lastY);
    this.lastX = x; this.lastY = y;
    this.dispX = x; this.dispY = y;
    this.anim += moved * 0.09;
    let frame = this.frameBase + '_walk' + (Math.floor(this.anim) % 4);
    if (e.state === 'windup' || (e.state === 'charge' && e.ability === 'charge_wind')) frame = this.frameBase + '_attack';
    this.spr.setFrame(frame);
    const sc = (e.type === 'chick' ? 0.7 : 1);
    this.punch *= Math.exp(-dt * 14);
    let s = sc * (1 + this.punch);
    if (e.state === 'rise') s *= 0.5 + 0.5 * (1 - Math.max(0, e.t) / 0.55);
    if (this.fuse || e.state === 'fuse') s *= 1 + Math.abs(Math.sin(time * 22)) * 0.15;
    this.spr.setPosition(x, y).setRotation(e.angle).setScale(s);
    this.flashT -= dt;
    if (this.flashT > 0) this.spr.setTintFill(0xffffff);
    else if (e.state === 'fuse' || (e.type === 'boss' && e.state === 'charge')) this.spr.setTint(Math.sin(time * 30) > 0 ? 0xff4040 : 0xffffff);
    else if (e.burnT > 0) this.spr.setTint(0xffb080);
    else this.spr.clearTint();
    this.spr.setAlpha(e.state === 'rise' ? 0.6 : 1);
  }

  hit() { this.flashT = 0.06; this.punch = 0.16; }
  destroy() { this.spr.destroy(); }
}

const NPC_HAND: Record<string, string> = { soldier: 'hand_glove', hitman: 'hand_skin', robot: 'hand_glove', manBrown: 'hand_skin2', zombie: 'hand_skin3' };

export class NpcView {
  rig: Rig;
  label: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, n: Npc) {
    this.rig = new Rig(scene, n.kind + (n.weapon ? '_stand' : '_hold'), NPC_HAND[n.kind] ?? 'hand_skin', 10);
    this.rig.setWeapon(n.weapon);
    this.label = scene.add.text(0, 0, n.name, { fontFamily: 'Rubik, sans-serif', fontSize: '12px', color: '#d8f3ff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(40).setResolution(TEXT_RES());
  }
  sync(n: Npc, x: number, y: number, dt: number, time: number, near: boolean) {
    const moving = n.mode === 'follow' || n.mode === 'goto' || n.mode === 'flee';
    this.rig.setWeapon(n.weapon);
    if (n.mode === 'dead') { this.rig.root.setVisible(false); this.label.setVisible(false); return; }
    this.rig.root.setVisible(n.mode !== 'gone');
    let a = n.angle;
    if (n.mode === 'cower') a += Math.sin(time * 30) * 0.06;
    this.rig.layout(x, y, a, moving, dt);
    if (n.mode === 'cower') this.rig.body.setScale(0.9);
    this.rig.body.setTint(n.hurtT > 0 ? 0xff8080 : 0xffffff);
    this.label.setPosition(x, y - 30).setVisible(near && n.mode !== 'gone');
  }
  destroy() { this.rig.destroy(); this.label.destroy(); }
}
