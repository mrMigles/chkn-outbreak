import Phaser from 'phaser';
import { Fx } from '../render/Fx';
import { Lighting } from '../render/Lighting';
import { Guide } from '../render/Guide';
import { haptic, telegramBack } from '../telegram';
import { EnemyView, NpcView, PlayerView, muzzleOf, ejectOf, HAND_H, worldDepth, enemyHeight, enemyLookKey, LOOK_POOL } from '../render/Actors';
import { lookTexture } from '../render/Looks';
import { music } from '../audio/Music';
import { Tutorial } from '../ui/Tutorial';
import { Input, FIRE_EDGE } from '../input/Input';
import { Hud } from '../ui/Hud';
import { preferencesMarkup, bindPreferences } from '../ui/Preferences';
import { achievementsMarkup, earnedAchievements } from '../ui/AchievementProfile';
import { ACHIEVEMENTS } from '../../shared/achievements';
import { controlsMarkup } from '../ui/ControlsHelp';
import { Coach } from '../ui/Coach';
import { Threats } from '../render/Threats';
import { sfx } from '../audio/Sfx';
import type { Session } from '../net/Session';
import { WEAPONS, WeaponId } from '../../shared/weapons';
import { ENEMIES, PLAYER } from '../../shared/enemies';
import { propDef } from '../../shared/props';
import { angleDiff, clamp, dist, lerp } from '../../shared/math';
import type { Player, SimEvent } from '../../shared/sim/types';
import { BUFFS, type BuffKind } from '../../shared/sim/types';
import { TILE } from '../../shared/map';
import { supportTarget } from '../../shared/sim/support';
import { ROOTED_SPEED } from '../../shared/sim/World';
import { rayBody, enemyBox, enemyScale } from '../../shared/sim/hitbox';
import { settings, saveSettings, TEXT_RES } from '../settings';
import artMeta from '../../shared/generated/artMeta.json';

export interface GameSceneData { session: Session; onEnd: (ev: { kind: 'level' | 'gameover' | 'quit'; next?: string; win?: boolean; reason?: string }) => void }

const SHOT_SOUND: Record<WeaponId, string> = { pistol: 'pistol', smg: 'smg', rifle: 'rifle', shotgun: 'shotgun', machinegun: 'machinegun', grenade: 'grenade_launch', flamethrower: 'flame', minigun: 'minigun', laser: 'laser' };
const SHAKE: Record<WeaponId, number> = { pistol: 0.13, smg: 0.055, rifle: 0.11, shotgun: 0.42, machinegun: 0.1, grenade: 0.3, flamethrower: 0.02, minigun: 0.09, laser: 0.25 };
const KICK: Record<WeaponId, number> = { pistol: 3, smg: 2, rifle: 3.5, shotgun: 10, machinegun: 3.5, grenade: 8, flamethrower: 0.5, minigun: 3, laser: 7 };

/** D69: story NPCs behind a counter/desk are talked to from across it (mirrors map prop `reach`). */
const NPC_REACH: Record<string, number> = { zhanna: 150, chef: 150, valya: 150, ashot: 130, valera: 130 };

interface Bubble { text: Phaser.GameObjects.Text; who: string; t: number; d: number }

/** «держать: поднять Петя · …» → «поднять Петя» for the round action button. */
function touchLabel(hint: string) {
  let first = hint.replace(/^E — /, '').split(' · ')[0];
  first = /^(держать|нажать):/.test(first) ? first.replace(/^[^:]+:\s*/, '') : first.replace(/:\s*/, ', ');
  first = first.charAt(0).toUpperCase() + first.slice(1);
  return first.length > 18 ? first.slice(0, 17) + '…' : first;
}

export class GameScene extends Phaser.Scene {
  session!: Session;
  onEnd!: GameSceneData['onEnd'];
  fx!: Fx;
  lighting!: Lighting;
  guide!: Guide;
  /** Destructible prop images by map object id; broken ids already applied. */
  private propImgs = new Map<number, Phaser.GameObjects.Image>();
  private brokenSeen = new Set<number>();
  input2!: Input;
  hud!: Hud;
  players = new Map<string, PlayerView>();
  enemies = new Map<number, EnemyView>();
  npcs = new Map<string, NpcView>();
  pickups = new Map<number, Phaser.GameObjects.Image>();
  pickupGlows = new Map<number, Phaser.GameObjects.Image>();
  private pingPong?: { ball: Phaser.GameObjects.Rectangle; x: number; y: number };
  private vehicles = new Map<number, Phaser.GameObjects.Image>();
  private frosts: { g: Phaser.GameObjects.Graphics; t?: Phaser.GameObjects.Text; door: string; gone: boolean }[] = [];
  private engineAt = 0;
  projs = new Map<number, Phaser.GameObjects.Image>();
  doors = new Map<string, Phaser.GameObjects.Image[]>();
  barrels = new Map<number, Phaser.GameObjects.Image>();
  pods = new Map<number, { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; broken: boolean }>();
  bubbles: Bubble[] = [];
  notes: { x: number; y: number; text: string }[] = [];
  px = 0; py = 0; aim = 0;
  lastTp = -1;
  seq = 0;
  desiredWeapon = 0;
  /** a picked-up gun the snapshot has not listed yet (D66) */
  private pendingWeapon: WeaponId | null = null;
  camX = 0; camY = 0;
  baseZoom = 1;
  ended = false;
  paused = false;
  time0 = 0;
  lastSwingSnd = 0;
  autoTarget: number | null = null;
  crosshair: Phaser.GameObjects.Image | null = null;
  hitMarker = 0;
  hitstop = 0;
  wallFaces: Phaser.GameObjects.Image[] = [];
  private cineFocus: { x: number; y: number; until: number } | null = null;
  private heartAt = 0;
  private fadeProps: { img: Phaser.GameObjects.Image; x: number; y: number; hw: number; h: number }[] = [];
  /** D69 floor 8: chickens' eyes glow above the darkness */
  redEyes = false;
  get elevation() { return HAND_H; }
  tutorial!: Tutorial;
  coach!: Coach;
  threats!: Threats;
  private warmup: Phaser.GameObjects.Image[] = [];
  private warmFrames = 0;
  private incidentMarkers = new Map<string, { icon: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Graphics }>();
  private lastCombatPop = 0;

  constructor() { super('game'); }

  init(data: GameSceneData) {
    this.session = data.session;
    this.onEnd = data.onEnd;
    this.players = new Map(); this.enemies = new Map(); this.npcs = new Map(); this.pickups = new Map(); this.pickupGlows = new Map();
    this.pingPong = undefined;
    this.vehicles = new Map();
    this.frosts = [];
    this.projs = new Map(); this.doors = new Map(); this.barrels = new Map(); this.pods = new Map(); this.bubbles = []; this.notes = [];
    this.ended = false; this.paused = false; this.lastTp = -1;
    this.wallFaces = []; this.fadeProps = []; this.introState = 'wait'; this.cineFocus = null;
    this.incidentMarkers = new Map(); this.lastCombatPop = 0;
  }

  create() {
    const s = this.session;
    const map = s.map;
    this.cameras.main.setBackgroundColor('#17191d').setBounds(-96, -96, map.pw + 192, map.ph + 192);
    // ---- tilemap
    const tm = this.make.tilemap({ key: 'map_' + s.levelId });
    const kt = tm.addTilesetImage('kenney', 'tiles25', TILE, TILE, 0, 0)!;
    const wt = tm.addTilesetImage('walls', 'walls', TILE, TILE, 0, 0)!;
    tm.createLayer('floor', [kt], 0, 0)!.setDepth(0);
    tm.createLayer('decor', [kt], 0, 0)!.setDepth(1);
    const walls = tm.createLayer('walls', [wt], 0, 0)!.setDepth(14);
    // soft drop shadow of the walls onto the floor
    const shadow = tm.createBlankLayer('wall_shadow', [wt], 7, 9)!.setDepth(3.5).setAlpha(0.3);
    walls.forEachTile((t) => { if (t.index > 0) shadow.putTileAt(t.index, t.x, t.y).tint = 0x000000; });
    const theme = String(map.props.theme ?? 'office');
    {
      walls.setDepth(2);
      walls.forEachTile(t => {
        if (t.index <= 0) return;
        // Only the exposed south edge has a front facade. Interior wall cells
        // keep the roof tiles; stacked facades would make a checkerboard wall.
        if ((walls.getTileAt(t.x, t.y + 1)?.index ?? -1) > 0) return;
        // The facade grows upwards; the collision grid and feet stay where they were.
        const x = t.x * TILE + TILE / 2, y = (t.y + 1) * TILE;
        const img = this.add.image(x, y, 'office25', 'wall_face_' + (map.props.wallFace || theme)).setOrigin(0.5, 1).setDepth(worldDepth(y));
        this.wallFaces.push(img);
      });
    }

    // ---- props, labels, notes
    for (const o of map.objects) {
      if (o.type === 'prop') {
        const def = propDef(o.name);
        const metas = artMeta.office25 as Record<string, { feetX: number; feetY: number; wall?: boolean }>;
        const rot = ((Math.round(o.rot / 90) * 90) % 360 + 360) % 360;
        const frameName = metas[o.name + '_' + rot] ? o.name + '_' + rot : o.name;
        const visual = metas[frameName];
        const feetY = o.cy + o.h / 2;
        let img: Phaser.GameObjects.Image;
        if (visual?.wall) {
          // mounted on the wall facade behind it
          img = this.add.image(o.cx, feetY - 14, 'office25', frameName).setOrigin(0.5, 1).setDepth(worldDepth(feetY) + 0.00001);
        } else if (visual) {
          img = this.add.image(o.cx, feetY, 'office25', frameName).setOrigin(0.5, visual.feetY / this.textures.getFrame('office25', frameName).height).setDepth(worldDepth(feetY));
        } else {
          // flat floor details (oil, notes, blood trails) keep the old art on the floor layer
          img = this.add.image(o.cx, o.cy, 'props', o.name).setRotation((o.rot * Math.PI) / 180).setDepth(def.top ? 16 : 4);
        }
        if (o.props.tint) img.setTint(parseInt(String(o.props.tint), 16));
        // D69: tall outdoor things (trees, kiosks, lamps) turn see-through over the local player, like walls
        if (visual && !visual.wall && img.displayHeight > 150) this.fadeProps.push({ img, x: o.cx, y: feetY, hw: img.displayWidth * 0.45, h: img.displayHeight * 0.9 });
        if (o.name === 'table_tennis') this.pingPong = { ball: this.add.rectangle(o.cx, o.cy - 12, 5, 5, 0xffe5a3).setDepth(worldDepth(feetY) + .00002), x: o.cx, y: o.cy - 12 };
        if (def.hp || o.props.incident === 'alarm') this.propImgs.set(o.id, img);
        if (o.props.text) this.notes.push({ x: o.cx, y: o.cy, text: String(o.props.text) });
      } else if (o.type === 'label') {
        this.add.text(o.cx, o.cy, String(o.props.text ?? o.name), {
          fontFamily: 'Russo One, sans-serif', fontSize: String(o.props.size ?? 22) + 'px', color: String(o.props.color ?? '#ffffff'),
        }).setOrigin(0.5).setAlpha(Number(o.props.alpha ?? 0.32)).setDepth(2).setRotation(Number(o.props.angle ?? 0) * Math.PI / 180).setResolution(TEXT_RES());
      } else if (o.type === 'frost') {
        // D73: a frosted-glass pane over a room (o = the rect it covers, props.door = the door that clears it)
        const g = this.add.graphics().setDepth(13.5);
        g.fillStyle(0xdfe8ef, 0.74).fillRect(o.x, o.y, o.w, o.h);
        for (let i = -o.h; i < o.w; i += 26) { g.lineStyle(9, 0xffffff, 0.22).lineBetween(o.x + Math.max(0, i), o.y + Math.max(0, -i), o.x + Math.min(o.w, i + o.h), o.y + Math.min(o.h, o.w - i)); }
        g.lineStyle(4, 0x8a96a3, 0.9).strokeRect(o.x + 2, o.y + 2, o.w - 4, o.h - 4);
        g.lineStyle(2, 0xffffff, 0.5).strokeRect(o.x + 7, o.y + 7, o.w - 14, o.h - 14);
        const t = o.props.label ? this.add.text(o.cx, o.cy, String(o.props.label), { fontFamily: 'Russo One, sans-serif', fontSize: '15px', color: '#5a6470' }).setOrigin(0.5).setAlpha(0.75).setDepth(13.6).setResolution(TEXT_RES()) : undefined;
        this.frosts.push({ g, t, door: String(o.props.door ?? ''), gone: false });
      } else if (o.type === 'note') {
        this.notes.push({ x: o.cx, y: o.cy, text: String(o.props.text ?? '') });
      }
    }

    this.fx = new Fx(this, map.pw, map.ph);
    this.fx.map = map;
    this.fx.shakeScale = settings.shake;
    this.lighting = new Lighting(this, map);
    this.redEyes = !!map.props.redEyes;
    this.lighting.setOverride(s.view.light, true);
    this.guide = new Guide(this, map);
    this.input2 = new Input(this);
    this.hud = new Hud(this.input2.touch);
    for (const k of Object.keys(this.textures.get('office25').frames)) if (k.startsWith('gun_')) this.hud.icons['w_' + k.slice(4)] = this.textures.getBase64('office25', k);
    this.tutorial = new Tutorial(this.input2.touch);
    this.coach = new Coach(this.hud, s.myId, (who, text, d) => this.say(who, text, d), this.input2.touch);
    this.threats = new Threats();
    this.prewarmLooks();
    this.hud.objective(s.view.objective);
    if (!this.input2.touch) {
      this.crosshair = this.add.image(0, 0, 'fx', 'crosshair').setDepth(45);
      document.getElementById('game')!.classList.add('ingame');
    }

    const me = s.view.players.find((p) => p.id === s.myId);
    if (me) { this.px = me.x; this.py = me.y; this.lastTp = me.tp; this.camX = me.x; this.camY = me.y; this.desiredWeapon = me.cur; }
    this.scale.on('resize', this.onResize, this);
    this.onResize();
    this.events.once('shutdown', () => this.cleanup());
    if (settings.dev) this.setupDev();
    // Telegram header «Назад» pauses the game (the pause menu has «В меню»)
    telegramBack(() => this.togglePause());
    this.events.once('shutdown', () => telegramBack(null));
    this.time0 = this.time.now;
    sfx.resume();
    if (this.input2.touch) this.bindWeaponButton();
    this.firstRunHelp();
  }

  /**
   * The weapon panel is the switch button on phones (D55). D71: a tap takes the next gun; holding it opens a
   * picker with every gun — slide onto one and let go (or tap one) to take it.
   */
  private bindWeaponButton() {
    const btn = this.hud.el.querySelector<HTMLElement>('.hud-weapon')!;
    let timer = 0, picker: HTMLElement | null = null, chosen = -1;
    const close = () => { picker?.remove(); picker = null; btn.classList.remove('held'); };
    // D72 (issue #3): the tiles live inside the HUD (pointer-events: none for every child) — hit-test by their rectangles
    const itemAt = (x: number, y: number) => [...(picker?.querySelectorAll<HTMLElement>('.wp-item') ?? [])].find(el => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
    const mark = (el: HTMLElement | null | undefined) => { picker?.querySelectorAll('.wp-item').forEach(q => q.classList.toggle('hover', q === el)); chosen = el ? Number(el.dataset.i) : -1; };
    const open = () => {
      const me = this.session.view.players.find(p => p.id === this.session.myId);
      if (!me || me.weapons.length < 2) return;
      haptic('hit');
      btn.classList.add('held');
      picker = document.createElement('div');
      picker.className = 'weapon-picker';
      picker.innerHTML = '<div class="wp-title">Оружие</div>' + me.weapons.map((w, i) => {
        const a = me.ammo[w], def = WEAPONS[w];
        return `<div class="wp-item ${i === me.cur ? 'cur' : ''}" data-i="${i}"><i style="background-image:url(${this.hud.icons['w_' + w] ?? ''})"></i><b>${def.name}</b><span>${a ? a.mag + (a.reserve >= 0 ? ' / ' + a.reserve : ' / ∞') : ''}</span></div>`;
      }).join('');
      // a tap on a tile selects it on release (touchend), so the touch is not stolen by the game's sticks
      let tapped: HTMLElement | undefined;
      picker.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); tapped = itemAt(e.touches[0].clientX, e.touches[0].clientY); mark(tapped); }, { passive: false });
      picker.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); tapped = itemAt(e.touches[0].clientX, e.touches[0].clientY); mark(tapped); }, { passive: false });
      picker.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); if (tapped) { haptic('hit'); this.input2.state.weaponSlot = Number(tapped.dataset.i); } close(); }, { passive: false });
      picker.addEventListener('click', (e) => { const r = e as MouseEvent; const it = itemAt(r.clientX, r.clientY); if (it) this.input2.state.weaponSlot = Number(it.dataset.i); close(); });
      this.hud.el.appendChild(picker);
    };
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      clearTimeout(timer);
      if (picker) { close(); return; }
      timer = window.setTimeout(() => { timer = 0; open(); }, 330);
    }, { passive: false });
    btn.addEventListener('touchmove', (e) => { e.preventDefault(); if (picker) mark(itemAt(e.touches[0].clientX, e.touches[0].clientY)); }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (timer) { clearTimeout(timer); timer = 0; this.input2.state.weaponDelta = 1; haptic('hit'); return; }
      if (picker && chosen >= 0) { this.input2.state.weaponSlot = chosen; close(); }
      // released on the button itself: the picker stays open for a tap
    }, { passive: false });
    this.events.once('shutdown', () => { clearTimeout(timer); close(); });
  }

  /** «Как управлять» before the very first fight; the portrait hint only now and then. */
  private firstRunHelp() {
    const automated = navigator.webdriver && !new URLSearchParams(location.search).has('help');
    if (!automated && settings.tutorials && !settings.seenTips.includes('controls') && this.session.levelId !== 'arena') {
      settings.seenTips.push('controls', 'move');
      saveSettings();
      this.togglePause('controls');
      return;
    }
    const hint = document.querySelector<HTMLElement>('.rotate-hint');
    if (!hint || !this.input2.touch || innerWidth > innerHeight) return;
    let last = 0;
    try { last = Number(localStorage.getItem('chkn-rotate-hint') || 0); } catch { /* ignore */ }
    if (Date.now() - last < 20 * 60_000) return;
    try { localStorage.setItem('chkn-rotate-hint', String(Date.now())); } catch { /* ignore */ }
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 4500);
  }

  /** Composite every look this level can show up front, so spawns never stall a frame. */
  private prewarmLooks() {
    const v = this.session.view;
    for (const n of v.npcs) { lookTexture(this, n.kind); lookTexture(this, n.kind, true); }
    for (const p of v.players) lookTexture(this, p.look || 'p' + (p.slot % 4));
    const types = ['normal', 'fast', 'fat', 'spitter', 'armored', 'exploder', 'jumper', ...(['office8'].includes(this.session.levelId) ? ['sprout'] as const : []), ...(['lab'].includes(this.session.levelId) ? ['gmo'] as const : [])] as const;
    for (const type of types) for (let i = 0; i < LOOK_POOL; i++) lookTexture(this, enemyLookKey({ type, id: i, appearance: undefined }), true);
    if (this.session.levelId !== 'office') for (const kind of ['manBlue', 'worker', 'arkady', 'guard', 'scientist']) lookTexture(this, kind, true);
    if (this.session.levelId === 'boss') lookTexture(this, enemyLookKey({ type: 'boss', id: 0, appearance: undefined }), true);
    // draw every composed texture once (nearly invisible) so the driver uploads it now, not during the first fight
    const warm = Object.keys(this.textures.list).filter((k) => k.startsWith('look:') || k.startsWith('mut:') || ['office25', 'fx', 'chars', 'props'].includes(k))
      .map((k) => this.add.image(0, 0, k, k.includes(':') ? 's_0' : undefined).setAlpha(0.02).setDepth(100).setScrollFactor(0));
    // first use of a blend mode / tint-fill / gradient program triggers a driver shader compile (100–800 ms on iGPUs)
    warm.push(this.add.image(4, 4, 'fx', 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.02).setScrollFactor(0).setDepth(100));
    warm.push(this.add.image(8, 4, 'office25', 'crate').setTintFill(0xffffff).setAlpha(0.02).setScrollFactor(0).setDepth(100));
    warm.push(this.add.image(12, 4, 'office25', 'crate').setTint(0xff8080).setAlpha(0.02).setScrollFactor(0).setDepth(100));
    const gg = this.add.graphics().setScrollFactor(0).setDepth(100);
    gg.fillGradientStyle(0, 0, 0, 0, 0.01, 0.02, 0.01, 0.02); gg.fillRect(0, 0, 8, 8);
    warm.push(gg as unknown as Phaser.GameObjects.Image);
    warm.push(this.add.text(0, 0, 'Ко!', { fontFamily: 'Rubik, sans-serif', fontSize: '12px', backgroundColor: '#fffdf6e6' }).setAlpha(0.02).setScrollFactor(0) as unknown as Phaser.GameObjects.Image);
    warm.push(this.add.ellipse(16, 8, 10, 4, 0, 0.02).setScrollFactor(0) as unknown as Phaser.GameObjects.Image);
    this.warmup = warm;
  }

  private onResize() {
    const cam = this.cameras.main;
    const dpr = (this.game as any).dprScale ?? 1;
    const h = this.scale.height / dpr, w = this.scale.width / dpr;
    const touch = this.input2?.touch;
    // show roughly 13 tiles vertically on desktop, a bit more on phones
    const tilesV = touch ? 9 : 10;
    // phones in portrait: ~11 tiles across (enemies stay readable, a long view up and down)
    const fit = touch && h > w ? w / (11 * TILE) : Math.min(h / (tilesV * TILE), w / (tilesV * 1.5 * TILE));
    this.baseZoom = clamp(fit, 0.42, 2.2) * dpr;
    cam.setZoom(this.baseZoom);
  }

  private cleanup() {
    document.getElementById('ui')?.classList.remove('cine-bars');
    this.introCaption?.remove();
    this.input2?.destroy();
    this.tutorial?.destroy();
    this.threats?.destroy();
    document.getElementById('game')!.classList.remove('ingame');
    this.crosshair = null;
    this.hud?.destroy();
    this.scale.off('resize', this.onResize, this);
    sfx.loop('flame_me', 'flame', false);
    sfx.loop('alarm', 'alarm', false);
    sfx.loop('incident-alarm', 'alarm', false);
    this.session.dispose();
  }

  // ------------------------------------------------------------------ main loop
  override update(_t: number, dms: number) {
    const dt = Math.min(dms / 1000, 0.05);
    if (this.warmup.length && ++this.warmFrames > 3) { this.warmup.forEach((w) => w.destroy()); this.warmup = []; }
    const s = this.session;
    const inp = this.input2.poll();
    if (inp.pause && !this.ended) this.togglePause();
    if (this.paused) { this.input2.consume(); return; }
    // hit-stop (solo only): freeze the world for a few frames on heavy hits
    if (this.hitstop > 0 && s.solo) { this.hitstop -= dms; this.updateCamera(0, inp); this.input2.consume(); return; }
    const view0 = s.view;
    const me = view0.players.find((p) => p.id === s.myId);

    // ---- local prediction & input
    if (me) {
      if (me.tp !== this.lastTp) { this.lastTp = me.tp; this.px = me.x; this.py = me.y; }
      const w = me.weapons[me.cur] as WeaponId | undefined;
      const wdef = w ? WEAPONS[w] : WEAPONS.pistol;
      let speed = 0;
      if (me.state === 'alive') speed = PLAYER.speed * wdef.speedMul * ((me.buffs?.sprint ?? 0) > 0 ? 1.6 : 1) * ((me.slowT ?? 0) > 0 ? ROOTED_SPEED : 1);
      else if (me.state === 'chicken') speed = PLAYER.chickenSpeed * wdef.speedMul;
      else if (me.state === 'downed') speed = 45;
      if (speed > 0) [this.px, this.py] = s.map.move(this.px, this.py, PLAYER.radius, inp.mx * speed * dt, inp.my * speed * dt);
      // server correction if we drift too far
      if (dist(this.px, this.py, me.x, me.y) > 160) { this.px = me.x; this.py = me.y; }

      let fire = inp.fire;
      // the shot leaves the hand and flies through the pointer; bodies are hit where they are drawn (shared/sim/hitbox)
      if (inp.aimMode === 'mouse') this.aim = Math.atan2(inp.aimWY - (this.py - this.elevation), inp.aimWX - this.px);
      else {
        // touch (D63): the right stick aims inside its circle and fires at its edge — always, in that
        // direction, whether a chicken is there or not. Predictable instead of «sometimes it shoots».
        if (inp.aimMode === 'stick' && inp.stickMag > 0.25) {
          let a = inp.stickA;
          const target = this.findAutoTarget(a, 0.3, me);
          if (target) a += clamp(angleDiff(a, target.a), -0.12, 0.12); // gentle aim assist
          this.aim = a;
          fire = inp.stickMag >= FIRE_EDGE;
        } else if (Math.hypot(inp.mx, inp.my) > 0.2) this.aim = Math.atan2(inp.my, inp.mx);
      }
      if (inp.weaponDelta && me.weapons.length) this.desiredWeapon = (me.cur + inp.weaponDelta + me.weapons.length) % me.weapons.length;
      if (inp.weaponSlot >= 0 && inp.weaponSlot < me.weapons.length) this.desiredWeapon = inp.weaponSlot;
      if (this.desiredWeapon !== me.cur && (inp.weaponDelta || inp.weaponSlot >= 0)) sfx.play('switch', { vol: 0.6 });
      if (this.pendingWeapon && me.weapons.includes(this.pendingWeapon)) { this.desiredWeapon = me.weapons.indexOf(this.pendingWeapon); this.pendingWeapon = null; }
      if (this.desiredWeapon < 0 || this.desiredWeapon >= me.weapons.length) this.desiredWeapon = me.cur;
      // D71: an empty gun (no rounds, no reserve) is put away for the best one that still shoots
      const held = me.weapons[this.desiredWeapon], ha = held ? me.ammo[held] : undefined;
      if (ha && ha.mag === 0 && ha.reserve === 0 && me.reloadT <= 0 && !(me.buffs?.infinite)) {
        let best = me.weapons.indexOf('pistol');
        me.weapons.forEach((wid, i) => { const a = me.ammo[wid]; if (a && (a.mag > 0 || a.reserve !== 0) && wid !== 'grenade') best = i; });
        if (best >= 0 && best !== this.desiredWeapon) { this.desiredWeapon = best; sfx.play('switch', { vol: 0.6 }); }
      }
      if (fire && w && (me.ammo[w]?.mag ?? 0) === 0 && (me.ammo[w]?.reserve ?? 0) === 0 && Math.random() < 0.08) sfx.play('empty', { vol: 0.5 });
      s.send({ seq: ++this.seq, x: this.px, y: this.py, aim: this.aim, fire, reload: inp.reload, interact: inp.interact, weapon: this.desiredWeapon });
      if (!s.solo) this.predictFire(dt, me, fire && !(inp.interact && (supportTarget(view0, s.map, me)?.state === 'downed' || me.support?.kind === 'heal')));
      sfx.loop('flame_me', 'flame', me.firing && w === 'flamethrower', 0.7);
    }

    // ---- simulation / network
    const events = s.poll(dt);
    for (const ev of events) { this.handle(ev); this.coach.event(ev); }

    // ---- sync views
    this.syncWorld(dt);
    for (const wall of this.wallFaces) wall.setAlpha(this.py < wall.y && wall.y - this.py < 155 && Math.abs(this.px - wall.x) < 72 ? 0.28 : 1);
    for (const f of this.fadeProps) f.img.setAlpha(this.py < f.y - 4 && f.y - this.py < f.h && Math.abs(this.px - f.x) < f.hw ? 0.4 : 1);

    this.updateIntro(inp);
    // ---- camera
    this.updateSpectate(inp);
    this.updateCamera(dt, inp);
    sfx.listenerX = this.px; sfx.listenerY = this.py;

    // ---- fx / lighting
    this.fx.update(dt);
    const flashlights: { x: number; y: number; a: number }[] = [];
    if (this.lighting.ambient > 0.25) {
      for (const p of s.view.players) {
        if (p.state !== 'alive' && p.state !== 'downed') continue;
        const pv = this.players.get(p.id);
        if (pv) flashlights.push({ x: pv.dispX, y: pv.dispY, a: pv.dispA });
      }
    }
    this.lighting.setOverride(s.view.light);
    this.lighting.alarm = s.view.alarm || (s.view.incidents ?? []).some(i => i.kind === 'alarm' && (i.phase === 'warning' || i.phase === 'active'));
    sfx.loop('incident-alarm', 'alarm', (s.view.incidents ?? []).some(i => i.kind === 'alarm' && (i.phase === 'warning' || i.phase === 'active')), .2);
    this.lighting.update(this.cameras.main, dt, this.fx.lights, flashlights);
    this.updateIncidents();

    // ---- music intensity
    this.updateMusic(dt);
    this.updateTutorial(dt);

    // ---- hud
    const me2 = s.view.players.find((p) => p.id === s.myId);
    this.hud.update(dt, s.view, me2, s.solo);
    this.coach.update(dt, s.view, me2);
    this.threats.update(s.view, this.px, this.py, this.cameras.main, (this.game as any).dprScale ?? 1, settings.threatArrows && me2?.state === 'alive');
    this.updateHints(me2);
    this.updateCrosshair(dt, inp, me2);
    this.updateBubbles(dt);
    // D66: a downed teammate outranks the objective: the arrow leads to them while they can still be saved
    const downed = me2?.state === 'alive' && !s.solo ? s.view.players.filter(p => p.id !== me2.id && p.state === 'downed' && p.connected).sort((a, b) => dist(a.x, a.y, this.px, this.py) - dist(b.x, b.y, this.px, this.py))[0] : undefined;
    if (downed) this.guide.update(dt, { ...s.view, objectiveTarget: [`@${Math.round(downed.x)},${Math.round(downed.y)}`] } as any, this.px, this.py, this.time.now / 1000, this.cameras.main);
    else if (me2 && me2.state === 'alive') this.guide.update(dt, s.view, this.px, this.py, this.time.now / 1000, this.cameras.main);
    else this.guide.update(dt, { ...s.view, objectiveTarget: [] } as any, this.px, this.py, this.time.now / 1000, this.cameras.main);
    this.hud.guide(this.guide.hud?.angle ?? null, this.guide.hud?.metres);
    this.input2.consume();
  }

  /** Developer hotkeys (solo only, settings.dev). */
  private setupDev() {
    const s = this.session as any;
    const kb = this.input.keyboard!;
    const label = document.createElement('div');
    label.className = 'dev-hud';
    document.getElementById('ui')!.appendChild(label);
    this.events.once('shutdown', () => label.remove());
    const refresh = () => {
      const w = s.world;
      label.textContent = `DEV ${this.session.levelId}${w ? (w.god ? ' · GOD' : '') + ' · F6 бессмертие · F7 оружие · F8 убить всех · F9 пройти' : ' · сеть: горячие клавиши только в соло'}`;
    };
    refresh();
    this.time.addEvent({ delay: 250, loop: true, callback: refresh });
    if (!s.world) return;
    const me = () => s.world.players.find((p: Player) => p.id === s.myId);
    for (const k of ['F6', 'F7', 'F8', 'F9']) kb.addCapture(k);
    kb.on('keydown-F6', () => { s.world.god = !s.world.god; settings.devGod = s.world.god; saveSettings(); this.hud.message(s.world.god ? 'БЕССМЕРТИЕ' : 'СМЕРТНЫЙ', '', 1); });
    kb.on('keydown-F7', () => { const p = me(); if (p) { s.world.devArsenal(p); this.hud.message('ВСЁ ОРУЖИЕ', '', 1); } });
    kb.on('keydown-F8', () => s.world.devKillAll(s.myId));
    kb.on('keydown-F9', () => s.world.completeLevel());
  }

  private tipT = 0;
  private updateTutorial(dt: number) {
    const tut = this.tutorial;
    tut.update(dt);
    this.tipT -= dt;
    if (this.tipT > 0) return;
    this.tipT = 0.25;
    const s = this.session, v = s.view;
    const me = v.players.find((p) => p.id === s.myId);
    if (!me) return;
    const t = (this.time.now - this.time0) / 1000;
    if (t > 1) tut.show('move');
    if (t > 9) tut.show('objective');
    if (t > 20 && v.bonus && settings.bonusGoals) tut.show('bonus');
    const near = (x: number, y: number, r: number) => Math.abs(x - this.px) < r && Math.abs(y - this.py) < r * 0.8;
    for (const e of v.enemies) {
      if (e.state === 'rise' || !near(e.x, e.y, 620)) continue;
      tut.show('enemy');
      if (e.type === 'fat' || e.type === 'spitter' || e.type === 'armored' || e.type === 'exploder' || e.type === 'chick') tut.show(e.type);
    }
    const w = me.weapons[me.cur];
    if (w && me.ammo[w]?.mag === 0) tut.show('reload');
    if (me.weapons.length > 1) tut.show('weapon');
    if (me.hp < 60 && me.supplies.medkit && me.state === 'alive') tut.show('medkit');
    for (const n of v.npcs) if (n.mode !== 'dead' && n.mode !== 'gone' && !n.mutation && near(n.x, n.y, 170)) { tut.show('npc'); break; }
    for (const d of v.doors) if (!d.open && d.locked && near(d.x + d.w / 2, d.y + d.h / 2, 220)) { tut.show('locked'); break; }
    for (const b of v.barrels) if (near(b.x, b.y, 450)) { tut.show('barrel'); break; }
    if (this.lighting.ambient > 0.5) tut.show('dark');
    if (v.players.some((p) => p.id !== me.id && p.state === 'downed')) tut.show('downed');
  }

  private updateMusic(dt: number) {
    const v = this.session.view;
    let near = 0;
    for (const e of v.enemies) if (e.aggro && e.state !== 'rise' && Math.abs(e.x - this.px) < 1000 && Math.abs(e.y - this.py) < 800) near++;
    const boss = v.enemies.some((e) => e.type === 'boss');
    music.want(this.ended ? 'calm' : boss ? 'boss' : near >= 7 || v.alarm ? 'wave' : near >= 1 ? 'tense' : 'calm', dt);
  }

  // ------------------------------------------------------------------ multiplayer: instant local shots
  localFiring = false;
  private predCd = 0;
  private predictFire(dt: number, me: Player, fire: boolean) {
    const w = me.weapons[me.cur] as WeaponId | undefined;
    this.predCd -= dt;
    const can = !!w && fire && (me.state === 'alive' || me.state === 'chicken') && me.reloadT <= 0 && (me.ammo[w]?.mag ?? 0) > 0 && me.cur === this.desiredWeapon;
    this.localFiring = can && w === 'flamethrower';
    if (!can || !w) { if (this.predCd < 0) this.predCd = 0; return; }
    const def = WEAPONS[w];
    let guard = 0;
    while (this.predCd <= 0 && guard++ < 4) {
      this.predCd += 1 / def.rof;
      if (def.kind === 'flame') continue;
      const ends: number[] = [];
      if (def.kind === 'hitscan') {
        for (let i = 0; i < def.pellets; i++) {
          const spread = def.spread + me.bloom;
          const a = this.aim + (def.pellets > 1 ? ((i + Math.random()) / def.pellets - 0.5) * 2 * spread : (Math.random() * 2 - 1) * spread);
          const wall = this.session.map.raycast(this.px, this.py, a, def.range, true);
          let d = wall.d;
          const dx = Math.cos(a), dy = Math.sin(a);
          for (const e of this.session.view.enemies) {
            if (e.state === 'rise') continue;
            const h = rayBody(this.px, this.py, dx, dy, e.x, e.y, enemyBox(e.type, enemyScale(e)), d);
            if (h) d = h.t;
          }
          ends.push(this.px + dx * d, this.py + dy * d);
        }
      }
      this.handle({ e: 'shot', o: '__local', w, x: this.px, y: this.py, a: this.aim, ends, team: me.state === 'chicken' ? 'chicken' : 'human' });
    }
  }

  private updateCrosshair(dt: number, inp: ReturnType<Input['poll']>, me: Player | undefined) {
    const c = this.crosshair;
    if (!c) return;
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    const w = me?.weapons[me.cur] as WeaponId | undefined;
    const d = dist(this.px, this.py, inp.aimWX, inp.aimWY);
    const spread = w ? WEAPONS[w].spread + (me?.bloom ?? 0) : 0.05;
    const sc = clamp(0.6 + (Math.tan(spread) * d) / 34, 0.65, 1.5);
    c.setPosition(inp.aimWX, inp.aimWY).setScale(sc / (this.cameras.main.zoom / ((this.game as any).dprScale ?? 1)) * (1 + this.hitMarker * 1.2));
    c.setTint(this.hitMarker > 0 ? 0xff4040 : 0xffffff).setRotation(this.hitMarker * 3);
    c.setVisible(!!me && (me.state === 'alive' || me.state === 'chicken'));
  }

  private findAutoTarget(a: number, cone: number, me: Player) {
    let best: { a: number; d: number } | null = null;
    const range = 650;
    for (const e of this.session.view.enemies) {
      if (e.state === 'rise') continue;
      const d = dist(this.px, this.py, e.x, e.y);
      if (d > range) continue;
      const ea = Math.atan2(e.y - this.py, e.x - this.px);
      const da = Math.abs(angleDiff(a, ea));
      if (da > cone + Math.atan2(ENEMIES[e.type].radius, d)) continue;
      const score = d * (1 + da * 2);
      if (!best || score < best.d) {
        if (!this.session.map.lineOfSight(this.px, this.py, e.x, e.y, true)) continue;
        best = { a: ea, d: score };
      }
    }
    if (me.state === 'chicken') {
      for (const p of this.session.view.players) {
        if (p.state !== 'alive') continue;
        const d = dist(this.px, this.py, p.x, p.y);
        const ea = Math.atan2(p.y - this.py, p.x - this.px);
        if (d < range && Math.abs(angleDiff(a, ea)) < cone && (!best || d < best.d)) best = { a: ea, d };
      }
    }
    return best;
  }

  /** "В ГОЛОВУ!" pop over the enemy's head for the local shooter (rate-limited). */
  private combatPop(x: number, y: number, text: string, head: boolean) {
    const t = this.add.text(x, y - 14, text, { fontFamily: 'Rubik, sans-serif', fontSize: head ? '13px' : '12px', fontStyle: '700', color: head ? '#ffd84a' : '#ffffff', stroke: '#2a0b0b', strokeThickness: 4 })
      .setOrigin(0.5, 1).setDepth(45).setResolution(TEXT_RES());
    this.tweens.add({ targets: t, y: y - 44, alpha: 0, scale: 1.25, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private updateIncidents() {
    for (const i of this.session.view.incidents ?? []) {
      let marker = this.incidentMarkers.get(i.id);
      if (!marker) {
        marker = { icon: this.add.text(i.x, i.y - 105, '', { fontFamily: 'Rubik, sans-serif', fontSize: '22px', fontStyle: 'bold', stroke: '#19201e', strokeThickness: 4 }).setOrigin(.5, 1).setDepth(38).setResolution(TEXT_RES()), zone: this.add.graphics().setDepth(6) };
        this.incidentMarkers.set(i.id, marker);
      }
      const color = i.phase === 'done' || i.phase === 'disabled' ? '#93c8a3' : i.kind === 'alarm' ? '#ff6857' : i.kind === 'coffee' ? '#f4d28d' : '#8dd2ed';
      marker.icon.setText(i.phase === 'done' || i.phase === 'disabled' ? '✓' : i.kind === 'alarm' ? '!' : i.kind === 'coffee' ? '☕' : '▣').setColor(color).setVisible(dist(i.x, i.y, this.px, this.py) < 620);
      marker.zone.clear();
      if (i.kind === 'cache' && i.phase === 'active') marker.zone.lineStyle(2, i.paused ? 0xd7b575 : 0x8dd2ed, .6).strokeCircle(i.x, i.y, 180);
      if (i.kind === 'alarm') {
        const o = this.session.map.objects.find(o => o.props.incidentId === i.id);
        const image = o && this.propImgs.get(o.id);
        if (image) image.setTint(i.phase === 'disabled' || i.phase === 'done' ? 0x7ea58c : 0xff7368);
      }
    }
  }

  /** D66: a dead player watches a living teammate; click / tap / Space switches to the next one. */
  spectating: Player | null = null;
  private spectatePress = false;
  private updateSpectate(inp: ReturnType<Input['poll']>) {
    const s = this.session, me = s.view.players.find((p) => p.id === s.myId);
    if (s.solo || !me || me.state !== 'dead') { this.spectating = null; this.hud.spectate(null); return; }
    const team = s.view.players.filter((p) => p.id !== me.id && p.connected && (p.state === 'alive' || p.state === 'downed')).sort((a, b) => a.slot - b.slot);
    const press = inp.fire || inp.aimMode === 'stick' || inp.interact;
    let cur = team.find((p) => p.id === this.spectating?.id) ?? team[0] ?? null;
    if (press && !this.spectatePress && team.length > 1 && cur) cur = team[(team.indexOf(cur) + 1) % team.length];
    this.spectatePress = press;
    this.spectating = cur;
    this.hud.spectate(cur ? cur.name : null, team.length > 1, this.input2.touch);
  }

  private updateCamera(dt: number, inp: ReturnType<Input['poll']>) {
    const cam = this.cameras.main;
    // look ahead towards aim
    const sp = this.spectating, watch = sp ? this.players.get(sp.id) : undefined;
    const lead = sp ? 0 : inp.aimMode === 'mouse'
      ? Math.min(220, dist(this.px, this.py, inp.aimWX, inp.aimWY) * 0.28)
      : inp.aimMode === 'stick' ? 110 : 40;
    const fx = watch ? watch.dispX : sp ? sp.x : this.px, fy = watch ? watch.dispY : sp ? sp.y : this.py;
    let tx = fx + Math.cos(this.aim) * lead, ty = fy + Math.sin(this.aim) * lead;
    // D69: a cutscene looks at its subject for a moment (the cafe helicopter)
    if (this.cineFocus && this.time.now < this.cineFocus.until) { tx = this.cineFocus.x; ty = this.cineFocus.y; }
    const k = 1 - Math.exp(-dt * 7);
    this.camX = lerp(this.camX, tx, k); this.camY = lerp(this.camY, ty, k);
    const tr = this.fx.trauma * this.fx.trauma;
    const t = this.time.now / 1000;
    const sx = tr * 22 * (Math.sin(t * 61) + Math.sin(t * 37.3) * 0.5);
    const sy = tr * 22 * (Math.sin(t * 53.7) + Math.sin(t * 29.1) * 0.5);
    cam.setRotation(tr * 0.03 * Math.sin(t * 41));
    cam.centerOn(this.camX + sx + this.fx.kickX, this.camY + sy + this.fx.kickY);
    cam.setZoom(this.baseZoom * (1 - tr * 0.02));
  }

  // ------------------------------------------------------------------ world sync
  private syncWorld(dt: number) {
    const s = this.session, v = s.view;
    const time = (this.time.now - this.time0) / 1000;
    // destroyed props (events give the FX; the list also covers late joiners and the client's own collision map)
    for (const id of v.broken) {
      if (this.brokenSeen.has(id)) continue;
      this.brokenSeen.add(id);
      const c = s.map.colliders.find((q) => q.id === id);
      if (c) s.map.removeCollider(c);
      const img = this.propImgs.get(id);
      if (img) {
        // leave a wreck on the floor: the same sprite, flattened and darkened
        this.fx.decals.draw(img.texture.key, img.frame.name, img.x, img.y - img.displayHeight * 0.18, (Math.random() - 0.5) * 0.5, 0.8, 0x6a625a, 0.85, 1.1);
        img.destroy(); this.propImgs.delete(id);
      }
    }
    // players
    const seenP = new Set<string>();
    for (const p of v.players) {
      seenP.add(p.id);
      let pv = this.players.get(p.id);
      if (!pv) { pv = new PlayerView(this, p, !s.solo); this.players.set(p.id, pv); }
      const mine = p.id === s.myId;
      pv.sync(p, mine ? this.px : p.x, mine ? this.py : p.y, mine ? this.aim : p.aim, dt, time);
      const w = p.weapons[p.cur];
      const firing = mine && !s.solo ? this.localFiring : p.firing;
      if (firing && w === 'flamethrower' && (p.state === 'alive' || p.state === 'chicken')) {
        const m = muzzleOf(pv.dispX, pv.dispY, pv.dispA, w, 0, this.elevation);
        this.fx.flame(m.x, m.y, pv.dispA, dt);
        if (!mine) sfx.play('flame', { x: m.x, y: m.y, vol: 0.4, max: 2 });
      }
    }
    for (const [id, pv] of this.players) if (!seenP.has(id)) { pv.destroy(); this.players.delete(id); }

    // enemies
    let nearSleeper = false;
    const seenE = new Set<number>();
    for (const e of v.enemies) {
      seenE.add(e.id);
      let ev = this.enemies.get(e.id);
      if (!ev) { ev = new EnemyView(this, e); this.enemies.set(e.id, ev); }
      ev.sync(e, e.x, e.y, dt, time);
      const npcId = e.appearance?.npcId;
      if (npcId === 'valera' && this.lighting.ambient > 0.5) {
        // D72: in the dark Валера is only two red eyes — a beam (or standing right next to him) shows him
        const seen = v.players.some(p => p.state === 'alive' && (dist(p.x, p.y, e.x, e.y) < 150 || (dist(p.x, p.y, e.x, e.y) < (this.lighting.base >= 0.985 ? 430 : 560) && Math.abs(angleDiff(p.aim, Math.atan2(e.y - p.y, e.x - p.x))) < 0.42)));
        const a = seen ? 1 : 0.06;
        ev.spr.setAlpha(a); ev.shadow.setAlpha(seen ? 0.28 : 0.04); ev.label?.setVisible(seen);
      }
      if (npcId === 'tolik' && Math.random() < dt * 9) {
        // D72: Толик smokes — a grey cloud drifts up from him
        const h = ev.scale * 46;
        this.fx.high.emit({ frame: 'smoke', x: e.x + (Math.random() - 0.5) * 30, y: e.y - h + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, life: 1.4 + Math.random(), drag: 0.5, s0: 0.3, s1: 1.4, a0: 0.6, a1: 0, rot: Math.random() * 6, tint: 0xc8c4bc });
      }
      if (this.redEyes) {
        ev.eyes(this, e, this.lighting.ambient, time);
        if (e.state === 'idle' && this.lighting.ambient > 0.5 && Math.abs(e.x - this.px) < 260 && Math.abs(e.y - this.py) < 260) nearSleeper = true;
      }
      if (e.burnT > 0) this.fx.burning(e.x, e.y, dt, e.type === 'boss' ? 3 : e.type === 'fat' ? 1.4 : 1);
    }
    for (const [id, ev] of this.enemies) if (!seenE.has(id)) { ev.destroy(); this.enemies.delete(id); }
    // D71: a heartbeat while a sleeping chicken is close in the dark
    if (nearSleeper && this.time.now - this.heartAt > 900) { this.heartAt = this.time.now; sfx.play('heartbeat', { vol: 0.7 }); }

    // npcs
    const seenN = new Set<string>();
    for (const n of v.npcs) {
      seenN.add(n.id);
      let nv = this.npcs.get(n.id);
      if (!nv) { nv = new NpcView(this, n); this.npcs.set(n.id, nv); }
      nv.sync(n, n.x, n.y, dt, time, dist(n.x, n.y, this.px, this.py) < 260);
    }
    // D66: a converted survivor leaves the network snapshot (solo keeps it as 'gone'); drop its body,
    // warning ring and bar instead of leaving a dark silhouette where the mutation happened
    for (const [id, nv] of this.npcs) if (!seenN.has(id)) { nv.destroy(); this.npcs.delete(id); }

    // pickups
    if (this.pingPong) {
      const { ball, x, y } = this.pingPong;
      const playing = v.npcs.some(n => n.id === 'lera' && !n.rescued) && v.npcs.some(n => n.id === 'pasha' && !n.rescued);
      ball.setVisible(playing).setPosition(x + Math.sin(time * 5) * 63, y - Math.abs(Math.cos(time * 5)) * 9);
    }
    const seenK = new Set<number>();
    const mySlot = v.players.find(p => p.id === this.session.myId)?.slot ?? 0;
    for (const k of v.pickups) {
      // D72: a gun or ammo this player already took from a shared spot is gone for them (not for teammates)
      if (((k.ts ?? 0) >> mySlot) & 1) continue;
      seenK.add(k.id);
      let img = this.pickups.get(k.id);
      if (!img) {
        const special = k.kind in BUFFS || k.kind === 'achievement' || k.kind === 'doc';
        img = k.kind === 'weapon' ? this.add.image(k.x, k.y, 'office25', 'gun_' + k.weapon).setDepth(7).setScale(1.2) : this.add.image(k.x, k.y, special ? 'office25' : 'chars', k.kind === 'doc' ? 'doc_form' : 'pk_' + k.kind).setDepth(7).setScale(k.kind === 'doc' ? 1 : special ? .65 : 1.1);
        const tint = k.kind in BUFFS ? BUFFS[k.kind as BuffKind].color : k.kind === 'achievement' ? 0xffd65c : k.kind === 'health' ? 0xff5a5a : k.kind === 'armor' ? 0x5ab0ff : k.kind === 'weapon' ? (k.amount ? 0xff9a3c : 0xffd27a) : k.kind === 'keycard' ? 0xffe14a : k.kind === 'doc' ? 0xfff3c0 : 0x9cff7a;
        const glow = this.add.image(k.x, k.y, 'fx', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(6).setScale(0.8).setAlpha(0.5);
        this.pickups.set(k.id, img); this.pickupGlows.set(k.id, glow);
      }
      const ph = time * 3 + k.id;
      img.setPosition(k.x, k.y + Math.sin(ph) * 2.5).setRotation(k.kind === 'weapon' ? -0.3 + Math.sin(ph * 0.5) * 0.1 : 0);
      if (k.ttl > 0 && k.ttl < 4) img.setAlpha(Math.sin(time * 18) > 0 ? 1 : 0.3);
      this.pickupGlows.get(k.id)!.setAlpha(0.35 + Math.sin(ph) * 0.15);
    }
    for (const [id, img] of this.pickups) if (!seenK.has(id)) { img.destroy(); this.pickupGlows.get(id)?.destroy(); this.pickups.delete(id); this.pickupGlows.delete(id); }

    // D72: vehicles (street 1: the Lithuanian's getaway car)
    const seenV = new Set<number>();
    for (const veh of v.vehicles ?? []) {
      seenV.add(veh.id);
      const west = Math.cos(veh.angle) < -0.1;
      const frame = west && this.textures.get('office25').has(veh.kind + '_l') ? veh.kind + '_l' : veh.kind;
      let img = this.vehicles.get(veh.id);
      if (!img) {
        const meta = (artMeta.office25 as Record<string, { feetY: number }>)[veh.kind];
        img = this.add.image(veh.x, veh.y, 'office25', frame);
        img.setOrigin(0.5, meta ? meta.feetY / img.height : 0.85);
        this.vehicles.set(veh.id, img);
      }
      if (img.frame.name !== frame) img.setFrame(frame);
      const shake = veh.moving ? Math.sin(time * 60) * 1.2 : 0;
      img.setPosition(veh.x, veh.y + 37 + shake).setDepth(worldDepth(veh.y + 37));
      if (veh.moving) {
        const back = west ? 1 : -1;
        if (Math.random() < dt * 30) this.fx.high.emit({ frame: 'smoke', x: veh.x + back * 120, y: veh.y + 20, vx: back * 60, vy: -20, life: 0.7, drag: 2, s0: 0.3, s1: 1, a0: 0.5, a1: 0, rot: Math.random() * 6, tint: 0x9a948a });
        if (this.time.now - this.engineAt > 260 && dist(veh.x, veh.y, this.px, this.py) < 1400) { this.engineAt = this.time.now; sfx.play('engine', { x: veh.x, y: veh.y, vol: 0.9 }); }
      }
    }
    for (const [id, img] of this.vehicles) if (!seenV.has(id)) { img.destroy(); this.vehicles.delete(id); }

    // projectiles
    const seenR = new Set<number>();
    for (const pr of v.projectiles) {
      seenR.add(pr.id);
      let img = this.projs.get(pr.id);
      if (!img) {
        const tex = pr.kind === 'egg' ? 'chars' : pr.kind === 'bottle' ? 'office25' : 'fx';
        const frame = pr.kind === 'grenade' ? 'grenade' : pr.kind === 'spit' ? 'spit' : pr.kind === 'bottle' ? 'bottle' : 'egg';
        img = this.add.image(pr.x, pr.y, tex, frame).setDepth(12).setScale(pr.kind === 'spit' ? 1.3 : 1);
        this.projs.set(pr.id, img);
      }
      img.setPosition(pr.x, pr.y).setRotation(img.rotation + dt * (pr.kind === 'spit' ? 0 : 14));
      if (pr.kind === 'grenade') {
        this.fx.high.emit({ frame: 'smoke', x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.5, s0: 0.15, s1: 0.5, a0: 0.4, a1: 0, tint: 0xcccccc, rot: Math.random() * 6 });
        this.fx.high.emit({ frame: 'glow', x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.04, s0: 0.4, s1: 0.4, a0: 0.6, a1: 0, tint: 0xffa040, add: true });
      } else if (pr.kind === 'spit') {
        this.fx.high.emit({ frame: 'blood_drop', x: pr.x, y: pr.y, vx: -pr.vx * 0.1, vy: -pr.vy * 0.1, life: 0.25, s0: 0.8, s1: 0.2, a0: 0.8, a1: 0, tint: 0x9be22e });
        this.fx.light(pr.x, pr.y, 120, 0x9be22e, 0.6, 0.05);
      }
    }
    for (const [id, img] of this.projs) if (!seenR.has(id)) { img.destroy(); this.projs.delete(id); }

    // D73: frosted glass over a closed room — blurred shapes and its light show through until its door opens
    for (const f of this.frosts) {
      const open = !!v.doors.find(d => d.id === f.door)?.open;
      if (open && !f.gone) { f.gone = true; this.tweens.add({ targets: [f.g, ...(f.t ? [f.t] : [])], alpha: 0, duration: 700, onComplete: () => { f.g.setVisible(false); f.t?.setVisible(false); } }); }
    }
    // doors: 2.5D facades in horizontal walls, side jambs in vertical walls; open doors roll up
    for (const d of v.doors) {
      let parts = this.doors.get(d.id);
      const horiz = d.w >= d.h;
      const locked = !!d.locked && d.locked !== '';
      const frame = (locked ? 'door_locked' : 'door_' + d.theme) + (horiz ? '' : '_side');
      if (!parts) {
        parts = [];
        const n = Math.max(1, Math.round((horiz ? d.w : d.h) / TILE));
        for (let i = 0; i < n; i++) {
          const x = horiz ? d.x + (i + 0.5) * (d.w / n) : d.x + d.w / 2;
          const y = horiz ? d.y + d.h : d.y + (i + 1) * (d.h / n);
          const img = this.add.image(x, y, 'office25', frame).setOrigin(0.5, 1).setDepth(worldDepth(y));
          if (horiz) img.setDisplaySize(d.w / n, 104); else img.setScale(2, 1.8);
          (img as any).full = img.scaleY;
          parts.push(img);
        }
        this.doors.set(d.id, parts);
      }
      for (const img of parts) {
        const full = (img as any).full as number;
        img.scaleY = lerp(img.scaleY, d.open ? full * 0.1 : full, Math.min(1, dt * 12));
        img.setAlpha(d.open ? 0.55 : 1);
        if (img.frame.name !== frame) img.setFrame(frame);
      }
    }

    // barrels
    const seenB = new Set<number>();
    for (const b of v.barrels) {
      seenB.add(b.id);
      if (!this.barrels.has(b.id)) this.barrels.set(b.id, this.add.image(b.x, b.y + 16, 'office25', 'hazard_barrel').setOrigin(0.5, 1).setDepth(worldDepth(b.y + 16)));
    }
    for (const [id, img] of this.barrels) if (!seenB.has(id)) { img.destroy(); this.barrels.delete(id); }

    // incubator pods
    for (const p of v.pods) {
      let pv = this.pods.get(p.id);
      // D69: on the market the «pods» are just big fresh eggs in a crate (no incubator glass, no green glow)
      const eggs = this.session.map.props.podLook === 'egg';
      if (!pv) {
        const img = eggs
          ? this.add.image(p.x, p.y + 16, 'chars', 'egg_big').setOrigin(0.5, 1).setScale(1.5).setDepth(worldDepth(p.y + 16))
          : this.add.image(p.x, p.y + 20, 'office25', p.broken ? 'egg_pod_broken' : 'egg_pod').setOrigin(0.5, 1).setDepth(worldDepth(p.y + 20));
        const glow = this.add.image(p.x, p.y - 30, 'fx', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7dff8a).setDepth(19).setScale(1.3).setAlpha(0.4);
        pv = { img, glow, broken: p.broken };
        this.pods.set(p.id, pv);
      }
      if (p.broken !== pv.broken) { pv.broken = p.broken; if (eggs) pv.img.setVisible(!p.broken); else pv.img.setFrame(p.broken ? 'egg_pod_broken' : 'egg_pod'); }
      if (eggs && !p.broken) pv.img.setRotation(Math.sin(time * 9 + p.id) * (Math.sin(time * 0.7 + p.id) > 0.6 ? 0.12 : 0.02));
      pv.glow.setVisible(!p.broken && !eggs).setAlpha(0.3 + Math.sin(time * 2 + p.id) * 0.1);
      if (!p.broken && !eggs) this.fx.light(p.x, p.y, 150, 0x7dff8a, 0.6, 0.02);
    }
  }

  // ------------------------------------------------------------------ events
  private shooterPose(owner: string): { x: number; y: number; a: number; mine: boolean; view?: PlayerView; npc?: NpcView } | null {
    const pv = this.players.get(owner === '__local' ? this.session.myId : owner);
    if (pv && owner === '__local') return { x: pv.dispX, y: pv.dispY, a: pv.dispA, mine: true, view: pv };
    if (pv) return { x: pv.dispX, y: pv.dispY, a: pv.dispA, mine: owner === this.session.myId, view: pv };
    const nv = this.npcs.get(owner);
    const n = this.session.view.npcs.find((q) => q.id === owner);
    if (nv && n) return { x: n.x, y: n.y, a: n.angle, mine: false, npc: nv };
    return null;
  }

  private handle(ev: SimEvent) {
    const fx = this.fx;
    switch (ev.e) {
      case 'shot': {
        if (!this.session.solo && ev.o === this.session.myId) break; // already predicted locally
        const pose = this.shooterPose(ev.o);
        const sx = pose?.x ?? ev.x, sy = pose?.y ?? ev.y;
        const a = pose?.mine ? this.aim : ev.a;
        const m = muzzleOf(sx, sy, a, ev.w, 0, this.elevation);
        const ej = ejectOf(sx, sy, a, this.elevation);
        const def = WEAPONS[ev.w];
        if (ev.w === 'flamethrower') {
          if (!pose?.view) { fx.flame(m.x, m.y, a, 0.09); sfx.play('flame', { x: m.x, y: m.y, vol: 0.4, max: 2 }); }
          break;
        }
        fx.muzzle(ev.w, m.x, m.y, a, 0, 0, ej.x, ej.y);
        for (let i = 0; i < ev.ends.length; i += 2) {
          const ex = ev.ends[i], ey = ev.ends[i + 1] - this.elevation;
          if (def.tracer) {
            const pellet = def.pellets > 1;
            fx.tracer(m.x, m.y, ex, ey, ev.team === 'chicken' ? 0xff8a8a : def.tracer, def.tracerWidth * (pellet ? 1 : 1.2), pellet ? 3200 : 4200, pellet ? 70 : ev.w === 'machinegun' ? 150 : 110);
          }
        }
        const rig = pose?.view?.rig ?? pose?.npc?.rig;
        if (rig) rig.recoil = def.recoil;
        sfx.play(SHOT_SOUND[ev.w], { x: m.x, y: m.y, vol: pose?.mine ? 0.9 : 0.7, max: ev.w === 'smg' || ev.w === 'machinegun' || ev.w === 'minigun' ? 8 : 5 });
        if (ev.w === 'shotgun') setTimeout(() => sfx.play('pump', { x: m.x, y: m.y, vol: 0.6 }), 280);
        if (pose?.mine) { fx.shake(SHAKE[ev.w]); fx.kick(a, KICK[ev.w]); }
        else fx.shake(SHAKE[ev.w] * 0.15 * clamp(1 - dist(sx, sy, this.px, this.py) / 900, 0, 1));
        break;
      }
      case 'hit': {
        let tint = 0xffffff;
        if (typeof ev.id === 'number') {
          const evw = this.enemies.get(ev.id);
          evw?.hit();
          const e = this.session.view.enemies.find((q) => q.id === ev.id);
          if (e) tint = e.type === 'fast' || e.type === 'chick' ? 0xffe27a : e.type === 'spitter' ? 0xe3f5c8 : e.type === 'boss' ? 0xe8a24a : 0xffffff;
        }
        if (ev.o === this.session.myId) {
          this.hitMarker = 0.12;
          if (ev.hs) sfx.play('headshot', { vol: .6 });
          if (settings.combatText && ev.d > 0 && this.time.now - this.lastCombatPop > 100) {
            this.lastCombatPop = this.time.now;
            this.combatPop(ev.x, ev.y - this.elevation, ev.hs ? 'В ГОЛОВУ! ' + Math.round(ev.d) : String(Math.round(ev.d)), !!ev.hs);
          }
        }
        if (ev.k === 'player' && ev.id === this.session.myId) break;
        fx.impact(ev.k, ev.x, ev.y - this.elevation, ev.a, tint, ev.big);
        break;
      }
      case 'kill': {
        if (ev.id === -1) { fx.kill('player', ev.x, ev.y, ev.a, true, false, undefined, HAND_H); break; }
        const view = this.enemies.get(ev.id);
        const x = view?.dispX ?? ev.x, y = view?.dispY ?? ev.y;
        fx.kill(ev.t, x, y, ev.a, ev.gib, ev.burn, view ? { ...view.corpse(), scale: view.spr.scaleX } : undefined, ev.t === 'chick' ? 12 : enemyHeight(ev.t) * 0.55);
        if (dist(x, y, this.px, this.py) < 700) fx.shake(ev.t === 'boss' ? 0.8 : ev.gib ? 0.12 : 0.05);
        if (ev.by === this.session.myId && ev.t === 'boss') this.hitstop = Math.max(this.hitstop, 160);
        if (ev.t === 'boss') { this.hud.message('ГЕНЕРАЛЬНЫЙ ПЕТУХ ПОВЕРЖЕН', 'Корпорация переходит на удалёнку', 5); }
        break;
      }
      case 'boom': {
        fx.boom(ev.x, ev.y, ev.r, ev.k);
        const d = dist(ev.x, ev.y, this.px, this.py);
        fx.shake(clamp(0.75 - d / 1400, 0.05, 0.75));
        break;
      }
      case 'proj':
        if (ev.k === 'spit') sfx.play('spit', { x: ev.x, y: ev.y, vol: 0.6 });
        break;
      case 'splat': fx.splat(ev.x, ev.y, ev.k); break;
      case 'say': if (!ev.flavor || settings.banter) this.say(ev.who, ev.text, ev.d); break;
      case 'achievement': if (ev.id === this.session.myId) this.hud.achievement(ev.key); break;
      case 'notice': this.hud.notice(ev.text, ev.sub, ev.tone); if (ev.tone === 'danger') sfx.play('ui', { vol: .65, rate: .7 }); break;
      case 'pdmg':
        if (ev.id === this.session.myId) {
          this.hud.damage(ev.d);
          haptic('hurt');
          fx.shake(0.22);
          sfx.play('hurt', { vol: 0.8 });
          // physical push away from the hit
          const a = Math.atan2(this.py - ev.y, this.px - ev.x);
          [this.px, this.py] = this.session.map.move(this.px, this.py, PLAYER.radius, Math.cos(a) * 9, Math.sin(a) * 9);
          for (let i = 0; i < 6; i++) {
            const aa = a + (Math.random() - 0.5) * 1.4, sp = 100 + Math.random() * 250;
            fx.low.emit({ frame: 'blood_drop', x: this.px, y: this.py, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: 0.3, drag: 7, s0: 1, s1: 0.8, land: true });
          }
        }
        break;
      case 'pick':
        if (ev.id === this.session.myId) {
          this.hud.toast(ev.text);
          if (ev.k !== 'weapon' && ev.k !== 'keycard') this.tutorial.show('pickup');
          sfx.play(ev.k === 'weapon' ? 'weapon_pick' : 'pickup', { vol: 0.8 });
          if (ev.k === 'weapon' && ev.w) {
            const me = this.session.view.players.find((p) => p.id === this.session.myId);
            // D66: online the event can arrive before the snapshot that lists the new gun: an index of −1
            // made the client think another gun was selected and stop drawing/playing its own shots
            if (me && me.weapons.includes(ev.w)) this.desiredWeapon = me.weapons.indexOf(ev.w);
            else this.pendingWeapon = ev.w;
          }
        }
        break;
      case 'reload':
        if (ev.id === this.session.myId) sfx.play('reload', { vol: 0.8, rate: ev.w === 'machinegun' ? 0.7 : 1 });
        break;
      case 'down':
        if (ev.id === this.session.myId) haptic('down');
        if (ev.id === this.session.myId) this.hud.message(this.session.solo ? 'ВАС ЗАКЛЕВАЛИ' : 'ВЫ РАНЕНЫ', this.session.solo ? '' : 'Ползите к друзьям — они поднимут вас', 3);
        else if (!this.session.solo) {
          const who = this.session.view.players.find(p => p.id === ev.id)?.name ?? 'Коллега';
          this.hud.notice(`✚ ${who} ранен!`, this.input2.touch ? 'Бегите по стрелке, у раненого жмите и держите кнопку «Поднять» — 15 секунд' : 'Бегите по стрелке, у раненого держите E — 15 секунд', 'danger');
        }
        break;
      case 'revived': this.hud.toast('Игрок поднят!'); break;
      case 'help':
        if (ev.id === this.session.myId || ev.by === this.session.myId) {
          this.hud.toast(ev.kind === 'heal' ? '+40 здоровья · аптечка использована' : 'Магазин патронов передан');
          sfx.play('pickup', { vol: 0.7 });
        }
        break;
      case 'mutation': {
        this.tutorial.show('mutation');
        const who = this.session.view.npcs.find((q) => q.id === ev.id)?.name ?? 'Выживший';
        const burst = (n: number, sp: number) => { for (let i = 0; i < n; i++) fx.high.emit({ frame: 'feather_' + i % 2, x: ev.x + (Math.random() - 0.5) * 20, y: ev.y - 50 - Math.random() * 40, vx: (Math.random() - 0.5) * sp, vy: -40 - Math.random() * sp * 0.7, life: 0.9, s0: 1, s1: 0.4, a0: 1, a1: 0, rot: Math.random() * 6 }); };
        if (ev.stage === 'twitch') {
          this.hud.toast(`⚠ ${who} превращается в курицу!`);
          sfx.play('cluck', { x: ev.x, y: ev.y, vol: 0.9 });
        }
        if (ev.stage === 'feathers') { burst(14, 180); sfx.play('squawk', { x: ev.x, y: ev.y, vol: 0.8 }); }
        if (ev.stage === 'silhouette') { burst(10, 140); fx.light(ev.x, ev.y - 40, 160, 0xff5030, 0.8, 0.5); }
        if (ev.stage === 'complete') {
          burst(34, 320);
          fx.spawnPuff(ev.x, ev.y, 'egg');
          fx.light(ev.x, ev.y - 40, 220, 0xffe0a0, 1, 0.35);
          fx.shake(0.12);
          sfx.play('squawk', { x: ev.x, y: ev.y, vol: 1 }); sfx.play('spawn', { x: ev.x, y: ev.y, vol: 0.7 });
          this.hud.toast(`${who} — теперь курица!`);
        }
        break;
      }
      case 'chicken':
        if (ev.id === this.session.myId) this.hud.message('ВЫ ПРЕВРАТИЛИСЬ В КУРИЦУ', 'Новая задача: заклевать бывших коллег', 4);
        sfx.play('boss_roar', { vol: 0.5, rate: 1.6 });
        break;
      case 'cured': if (ev.id === this.session.myId) this.hud.message('АНТИДОТ!', 'Вы снова человек', 3); break;
      case 'npcdie':
        { const nv = this.npcs.get(ev.id); fx.kill('normal', ev.x, ev.y, 0, false, false, nv ? { ...nv.corpse(), scale: 2 } : undefined, HAND_H); }
        this.hud.toast('Выживший погиб');
        break;
      case 'propbreak': this.fx.propBreak(ev.x, ev.y, ev.m); break;
      case 'door': sfx.play('door', { x: this.doors.get(ev.id)?.[0]?.x, y: this.doors.get(ev.id)?.[0]?.y, vol: 0.5 }); break;
      case 'msg': this.hud.message(ev.text, ev.sub ?? '', ev.d ?? 3); break;
      case 'obj': this.hud.objective(ev.text); sfx.play('ui', { vol: 0.6 }); break;
      case 'spawn':
        fx.spawnPuff(ev.x, ev.y, ev.how);
        sfx.play('spawn', { x: ev.x, y: ev.y, vol: 0.5, max: 3 });
        break;
      case 'light':
        this.lighting.setOverride(ev.v, true);
        sfx.play('breaker', { vol: 0.9 });
        break;
      case 'scare': this.scare(ev); break;
      case 'cine':
        if (ev.k === 'heli') this.heliCrash();
        else if (ev.k === 'victory') this.victory(ev.sub ?? '');
        else this.hud.message(ev.text ?? '', ev.sub ?? '', 5);
        break;
      case 'blackout':
        this.lighting.blackout = ev.on;
        sfx.play('explosion', { vol: 0.3, rate: 0.5 });
        break;
      case 'alarm':
        this.lighting.alarm = ev.on;
        sfx.loop('alarm', 'alarm', ev.on, 0.35);
        break;
      case 'shake': fx.shake(ev.s * 20); break;
      case 'swing': {
        const now = this.time.now;
        if (now - this.lastSwingSnd > 120) {
          this.lastSwingSnd = now;
          sfx.play(Math.random() < 0.5 ? 'squawk' : 'cluck', { x: ev.x, y: ev.y, vol: 0.55, max: 4, rate: 0.9 + Math.random() * 0.3 });
        }
        break;
      }
      case 'fuse': {
        const e = this.session.view.enemies.find((q) => q.id === ev.id);
        sfx.play(e?.type === 'boss' ? 'boss_roar' : e?.type === 'jumper' ? 'hop' : 'fuse', { x: e?.x, y: e?.y, vol: 0.8 });
        break;
      }
      case 'level':
        if (!this.ended) { this.ended = true; this.time.delayedCall(1800, () => this.onEnd({ kind: 'level', next: ev.next, win: ev.win })); }
        break;
      case 'gameover':
        if (!this.ended) { this.ended = true; queueMicrotask(() => this.onEnd({ kind: 'gameover', reason: ev.reason })); }
        break;
    }
  }

  // ------------------------------------------------------------------ D69: horror beats and the cafe helicopter
  private scare(ev: Extract<SimEvent, { e: 'scare' }>) {
    const near = dist(ev.x, ev.y, this.px, this.py) < 900;
    if (ev.k === 'ring') {
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 1500, () => sfx.play('phone', { x: ev.x, y: ev.y, vol: 1 }));
      return;
    }
    if (ev.k === 'flicker') { this.lighting.flicker(1.1); sfx.play('spark', { x: ev.x, y: ev.y, vol: 0.9 }); return; }
    if (ev.k === 'knock') { sfx.play('knock', { x: ev.x, y: ev.y, vol: 1 }); return; }
    if (ev.k === 'eyes') {
      // D71: two red eyes open in the dark, stare for a moment and are gone
      const eyes = [-7, 7].map(dx => this.add.rectangle(ev.x + dx, ev.y - 84, 6, 4, 0xff2a1a).setDepth(31).setAlpha(0));
      const glow = this.add.image(ev.x, ev.y - 84, 'fx', 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2010).setDepth(31).setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: [...eyes, glow], alpha: { from: 0, to: 1 }, duration: 350, yoyo: true, hold: 1100, onComplete: () => { eyes.forEach(e => e.destroy()); glow.destroy(); } });
      this.time.delayedCall(1300, () => sfx.play('whoosh', { x: ev.x, y: ev.y, vol: 0.8 }));
      return;
    }
    if (ev.k === 'spark') { this.fx.impact('wall', ev.x, ev.y - 40, -Math.PI / 2, 0xffe08a, true); sfx.play('spark', { x: ev.x, y: ev.y, vol: 0.8 }); return; }
    // D72: grain for the grandma's flock, a feathery poof, Валера vanishing, the car breaking the fence, the engine
    if (ev.k === 'grain') {
      for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, sp = 40 + Math.random() * 120; this.fx.low.emit({ frame: 'shard', x: ev.x, y: ev.y - 30, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, life: 0.6, drag: 5, s0: 0.6, s1: 0.6, tint: 0xe8c64a, land: true, rot: Math.random() * 6 }); }
      return;
    }
    if (ev.k === 'poof') {
      for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, sp = 60 + Math.random() * 220; this.fx.high.emit({ frame: 'shard', x: ev.x, y: ev.y - 50, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.9, drag: 3, s0: 1, s1: 0.8, tint: 0xfff8e8, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8 }); }
      this.fx.spawnPuff(ev.x, ev.y - 30, 'egg');
      if (near) sfx.play('squawk', { x: ev.x, y: ev.y, vol: 0.9, rate: 1.2 });
      return;
    }
    if (ev.k === 'blink') {
      for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28; this.fx.high.emit({ frame: 'smoke', x: ev.x, y: ev.y - 40, vx: Math.cos(a) * 80, vy: Math.sin(a) * 50, life: 0.6, drag: 3, s0: 0.3, s1: 0.9, a0: 0.6, a1: 0, rot: Math.random() * 6, tint: 0x1a1c24 }); }
      if (near) sfx.play('whoosh', { x: ev.x, y: ev.y, vol: 0.9, rate: 1.3 });
      return;
    }
    if (ev.k === 'engine') { sfx.play('engine', { x: ev.x, y: ev.y, vol: 1 }); sfx.play('honk', { x: ev.x, y: ev.y, vol: 1 }); return; }
    if (ev.k === 'roots') {
      // D73: a warning: the ground cracks and green shoots push up where the potato tops will burst out
      const g = this.add.graphics().setDepth(5);
      const draw = (k: number) => { g.clear(); g.fillStyle(0x3f7a38, 0.18 + 0.25 * k).fillEllipse(ev.x, ev.y, 150, 66); g.lineStyle(3, 0x8fd16b, 0.5 + 0.5 * k).strokeEllipse(ev.x, ev.y, 150, 66); };
      this.tweens.addCounter({ from: 0, to: 1, duration: 750, onUpdate: (tw) => draw(tw.getValue() ?? 0), onComplete: () => g.destroy() });
      for (let i = 0; i < 10; i++) this.fx.low.emit({ frame: 'shard', x: ev.x + (Math.random() - 0.5) * 120, y: ev.y + (Math.random() - 0.5) * 50, vx: 0, vy: -30, life: 0.7, drag: 2, s0: 0.6, s1: 1, tint: 0x6aa857, rot: Math.random() * 6 });
      if (near) sfx.play('hop', { x: ev.x, y: ev.y, vol: 0.8, rate: 0.55 });
      return;
    }
    if (ev.k === 'rooted') {
      for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28; this.fx.high.emit({ frame: 'shard', x: ev.x + Math.cos(a) * 26, y: ev.y + Math.sin(a) * 10, vx: Math.cos(a) * 30, vy: -60 - Math.random() * 80, life: 0.8, drag: 2, s0: 1.2, s1: 0.8, tint: i % 3 ? 0x4f9a32 : 0x8fd16b, rot: Math.random() * 6 }); }
      if (near) sfx.play('chomp', { x: ev.x, y: ev.y, vol: 0.9, rate: 0.7 });
      return;
    }
    if (ev.k === 'crash') {
      this.fx.boom(ev.x, ev.y, 90, 'barrel');
      for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, sp = 120 + Math.random() * 320; this.fx.low.emit({ frame: 'shard', x: ev.x, y: ev.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6, drag: 4, s0: 1.2, s1: 1, tint: 0x8a8f99, land: true, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 }); }
      sfx.play('crash', { x: ev.x, y: ev.y, vol: 1 });
      return;
    }
    if (!near) return;
    if (ev.k === 'scream') { sfx.play('squawk', { x: ev.x, y: ev.y, vol: 1, rate: 0.55 }); this.fx.shake(0.25); return; }
    // jump: stinger, a red flash at the screen edges, shake, vibration
    sfx.play('stinger', { vol: 0.9 });
    sfx.play('squawk', { x: ev.x, y: ev.y, vol: 1, rate: 0.7 });
    this.fx.shake(0.45);
    haptic('hurt');
    if (!settings.reducedFlashes) {
      const f = document.createElement('div');
      f.className = 'scare-flash';
      document.getElementById('ui')!.appendChild(f);
      setTimeout(() => f.remove(), 700);
    }
  }

  /**
   * D71: a short intro at the start of every floor: letterbox bars, the camera glides to the first objective
   * and back, a caption says what to do. Never blocks: any movement or shot ends it at once.
   */
  private introState: 'wait' | 'show' | 'done' = 'wait';
  private introEnd = 0;
  private introCaption: HTMLElement | null = null;
  private updateIntro(inp: ReturnType<Input['poll']>) {
    if (this.introState === 'done') return;
    const t = (this.time.now - this.time0) / 1000;
    const v = this.session.view;
    const moved = Math.hypot(inp.mx, inp.my) > 0.2 || inp.fire;
    if (this.introState === 'wait') {
      if (this.session.levelId === 'arena' || moved || t > 6) { this.introState = 'done'; return; }
      if (t < 1.3 || !v.objective || this.paused) return;
      this.introState = 'show'; this.introEnd = this.time.now + 3200;
      const target = this.resolveTarget(v.objectiveTarget[0]);
      if (target && Math.hypot(target.x - this.px, target.y - this.py) > 300) this.cineFocus = { x: target.x, y: target.y - 40, until: this.introEnd - 700 };
      document.getElementById('ui')!.classList.add('cine-bars');
      const c = document.createElement('div');
      c.className = 'cine-caption';
      c.innerHTML = `<small>ЗАДАЧА</small><b></b><i>${this.input2.touch ? 'коснитесь стика' : 'двигайтесь'} — пропустить</i>`;
      c.querySelector('b')!.textContent = v.objective;
      document.getElementById('ui')!.appendChild(c);
      this.introCaption = c;
      return;
    }
    if (moved || this.time.now > this.introEnd) {
      this.introState = 'done'; this.cineFocus = null;
      document.getElementById('ui')?.classList.remove('cine-bars');
      this.introCaption?.remove(); this.introCaption = null;
    }
  }
  private resolveTarget(t?: string): { x: number; y: number } | null {
    if (!t) return null;
    if (t.startsWith('@')) { const [x, y] = t.slice(1).split(',').map(Number); return { x, y }; }
    const n = this.session.view.npcs.find(q => q.id === t);
    if (n) return n;
    const o = ['use', 'trigger', 'npc', 'door'].map(type => this.session.map.objects.find(q => q.name === t && q.type === type)).find(Boolean);
    return o ? { x: o.cx, y: o.cy } : null;
  }

  /** D71: the finale — fanfare, a slow camera on the fallen CEO, bursts of feathers and confetti. */
  private victory(at: string) {
    const [x, y] = at.split(',').map(Number);
    this.cineFocus = { x: x || this.px, y: (y || this.py) - 60, until: this.time.now + 7000 };
    sfx.play('fanfare', { vol: 1 }); music.want('calm', 99);
    this.time.delayedCall(1600, () => sfx.play('fanfare', { vol: 0.8 }));
    this.hud.message('ГЕНЕРАЛЬНЫЙ ПЕТУХ ПОВЕРЖЕН', 'Корпорация переходит на удалёнку', 5);
    document.getElementById('ui')!.classList.add('cine-bars');
    this.time.delayedCall(7000, () => document.getElementById('ui')?.classList.remove('cine-bars'));
    const colors = [0xffd54f, 0xff6b6b, 0x4fc3f7, 0x81c784, 0xffffff];
    let k = 0;
    this.time.addEvent({ delay: 180, repeat: 34, callback: () => {
      const cx = this.cameras.main.midPoint.x + (Math.random() - 0.5) * 700, cy = this.cameras.main.worldView.y - 20;
      for (let i = 0; i < 6; i++) this.fx.high.emit({ frame: i % 2 ? 'feather_0' : 'feather_1', x: cx + (Math.random() - 0.5) * 120, y: cy, vx: (Math.random() - 0.5) * 120, vy: 140 + Math.random() * 160, life: 2.6, s0: 1.2, s1: 0.8, a0: 1, a1: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, tint: colors[(k + i) % colors.length] });
      if (k++ % 6 === 0) { this.fx.light(x || this.px, (y || this.py) - 60, 400, colors[k % colors.length], 0.9, 0.6); this.fx.shake(0.1); }
    } });
  }

  /** Cafe, floor 12: a smoking helicopter crosses the panoramic windows and falls into the street. */
  private heliCrash() {
    const win = this.session.map.objects.find(o => o.type === 'zone' && o.name === 'windows');
    if (!win) return;
    const y0 = win.y + win.h * 0.45;
    this.cineFocus = { x: Math.min(Math.max(this.px, win.x + 400), win.x + win.w - 400), y: win.y + win.h * 0.5 + 170, until: this.time.now + 9000 };
    const heli = this.add.image(win.x + win.w + 120, y0, 'office25', 'heli_side').setDepth(worldDepth(win.y + win.h + 48)).setScale(0.7);
    let t = 0;
    const smoke = this.time.addEvent({ delay: 70, loop: true, callback: () => {
      this.fx.high.emit({ frame: 'smoke', x: heli.x + 40, y: heli.y - 6, vx: 30, vy: -20, life: 1.2, s0: 0.3, s1: 1.1, a0: 0.55, a1: 0, tint: 0x555555, rot: Math.random() * 6 });
    } });
    sfx.loop('heli', 'heli', true, 0.5);
    this.tweens.addCounter({ from: 0, to: 1, duration: 5200, onUpdate: (tw) => {
      t = tw.getValue() ?? 0;
      heli.x = win.x + win.w + 120 - t * (win.w * 0.75 + 120);
      const fall = Math.max(0, t - 0.55) / 0.45;
      heli.y = y0 + Math.sin(t * 20) * 4 + fall * fall * win.h * 1.3;
      heli.setRotation(-0.1 - fall * 0.9 + Math.sin(t * 30) * 0.05);
      // it disappears below the window sill (no mask: fade out as it drops past the glass)
      heli.setAlpha(Math.max(0, Math.min(1, (win.y + win.h + 10 - heli.y) / 40)));
    }, onComplete: () => {
      smoke.remove(); heli.destroy();
      sfx.loop('heli', 'heli', false);
      sfx.play('explosion', { vol: 1, rate: 0.7 });
      this.fx.shake(0.8);
      const bx = win.x + win.w * 0.35, by = win.y + win.h;
      this.fx.light(bx, by, 700, 0xffa040, 1, 1.2);
      // a smoke column keeps rising behind the glass
      const col = this.time.addEvent({ delay: 120, repeat: 120, callback: () => this.fx.high.emit({ frame: 'smoke', x: bx + (Math.random() - 0.5) * 60, y: by - 10, vx: 10, vy: -60, life: 2.2, s0: 0.5, s1: 1.8, a0: 0.4, a1: 0, tint: 0x3a3a3a, rot: Math.random() * 6 }) });
      this.events.once('shutdown', () => col.remove());
    } });
  }

  // ------------------------------------------------------------------ speech bubbles & hints
  private say(who: string, text: string, d: number) {
    if (who === 'radio' || who === 'pa') { this.hud.radio(who === 'pa' ? 'ОПОВЕЩЕНИЕ' : 'РАЦИЯ', text, d); return; }
    const old = this.bubbles.find((b) => b.who === who);
    if (old) { old.text.destroy(); this.bubbles.splice(this.bubbles.indexOf(old), 1); }
    const t = this.add.text(0, 0, text, {
      fontFamily: 'Rubik, sans-serif', fontSize: '12px', fontStyle: '600', color: '#1d1f24',
      backgroundColor: '#fffdf6e6', padding: { x: 6, y: 3 }, wordWrap: { width: 200 }, align: 'center',
    }).setOrigin(0.5, 1).setDepth(41).setResolution(TEXT_RES());
    this.bubbles.push({ text: t, who, t: 0, d });
  }

  private updateBubbles(dt: number) {
    const v = this.session.view;
    for (const b of [...this.bubbles]) {
      b.t += dt;
      if (b.t > b.d) { b.text.destroy(); this.bubbles.splice(this.bubbles.indexOf(b), 1); continue; }
      b.text.setAlpha(Math.min(1, b.t * 8, (b.d - b.t) * 4));
      let x = 0, y = 0, found = false;
      const pv = this.players.get(b.who);
      if (pv) { x = pv.dispX; y = pv.dispY; found = true; }
      const n = v.npcs.find((q) => q.id === b.who);
      if (n) { x = n.x; y = n.y; found = true; }
      const e = v.enemies.find((q) => String(q.id) === b.who);
      if (e) { x = e.x; y = e.y - enemyHeight(e.type) + 104; found = true; }
      if (!found) { b.text.destroy(); this.bubbles.splice(this.bubbles.indexOf(b), 1); continue; }
      // above the head and name label (name sits at feet − 104)
      // keep bubbles readable when the camera zooms out (phones): never smaller than ~12 css px
      const z = this.cameras.main.zoom / ((this.game as any).dprScale ?? 1);
      b.text.setPosition(x, y - 120 - Math.min(6, b.t * 4)).setScale(Math.max(1, 1 / z));
    }
  }

  private updateHints(me: Player | undefined) {
    if (!me || me.state !== 'alive') { this.hud.hint(null); this.input2.showInteract(null); return; }
    const v = this.session.view;
    let hint: string | null = null;
    const key = this.input2.touch ? '' : 'E — ';
    const ally = supportTarget(v, this.session.map, me);
    if (ally) {
      if (ally.state === 'downed') hint = `${key}держать: поднять ${ally.name}`;
      else {
        const weapon = ally.weapons[ally.cur], ammo = ally.ammo[weapon];
        const actions = [];
        if (me.supplies.ammo && ammo && ammo.reserve >= 0 && ammo.reserve < WEAPONS[weapon].reserveMax) actions.push(`нажать: патроны ${ally.name}`);
        if (ally.hp < ally.maxHp && me.supplies.medkit) actions.push(`держать: лечить ${ally.name}`);
        hint = actions.length ? key + actions.join(' · ') : null;
      }
    }
    if (!ally && !hint) for (const n of v.npcs) {
      if (n.mode === 'dead' || n.mode === 'gone' || n.mode === 'follow' || n.mutation || dist(n.x, n.y, this.px, this.py) > (NPC_REACH[n.id] ?? 80) || !this.session.map.lineOfSight(me.x, me.y, n.x, n.y, false)) continue;
      if (n.rescued || n.weapon) hint = `${key}${n.name}: за мной`;
      else hint = `${key}поговорить`;
      break;
    }
    if (!ally && !hint) for (const o of this.session.map.objects) {
      const incident = v.incidents?.find(i => i.id === o.name);
      if (incident && (incident.phase === 'done' || incident.phase === 'disabled' || incident.phase === 'active')) continue;
      if (o.type === 'use' && dist(o.cx, o.cy, this.px, this.py) < 90 && !(o.props.done && (v as any).flags?.[o.name])) { hint = key + String(o.props.hint ?? 'использовать'); break; }
    }
    if (!ally && !hint) for (const d of v.doors) {
      if (!d.open && d.locked && dist(d.x + d.w / 2, d.y + d.h / 2, this.px, this.py) < 115) { hint = key + (me.keys.includes(d.locked) ? 'открыть' : 'заперто'); break; }
    }
    let note: string | null = null;
    if (!ally && me.hp < me.maxHp && me.supplies.medkit) hint = hint ? `${hint} · держать: лечить себя` : `${key}держать: лечить себя`;
    for (const n of this.notes) if (dist(n.x, n.y, this.px, this.py) < 95) { note = n.text; break; }
    // phones: the action button carries the label, the centre line only shows notes
    this.hud.hint(this.input2.touch ? note : hint ?? note);
    this.input2.showInteract(hint ? touchLabel(hint) : null);
  }

  togglePause(view: 'menu' | 'controls' = 'menu') {
    this.paused = !this.paused;
    const el = document.querySelector('.pause-menu');
    if (this.paused && !el) {
      const p = this.session.view.players.find(q => q.id === this.session.myId);
      if (p) this.session.send({ ...p.input, seq: ++this.seq, x: p.x, y: p.y, fire: false, reload: false, interact: false, weapon: p.cur });
      const d = document.createElement('div');
      d.className = 'overlay pause-menu';
      const render = (v: 'menu' | 'settings' | 'controls' | 'achievements') => {
        d.dataset.view = v;
        d.innerHTML = v === 'achievements'
          ? `<div class="panel achievements-panel"><h2>ДОСТИЖЕНИЯ</h2>${achievementsMarkup()}<button class="btn primary" data-a="back">Назад</button></div>`
          : v === 'settings'
          ? `<div class="panel preferences-panel"><h2>НАСТРОЙКИ</h2>${preferencesMarkup()}<button class="btn primary" data-a="back">Назад</button></div>`
          : v === 'controls'
            ? `<div class="panel controls-panel"><h2>КАК УПРАВЛЯТЬ</h2>${controlsMarkup(this.input2.touch)}<button class="btn primary" data-a="${view === 'controls' ? 'resume' : 'back'}">${view === 'controls' ? 'Понятно, в бой!' : 'Назад'}</button></div>`
            : `<div class="panel"><h2>ПАУЗА</h2>${this.session.solo ? '' : '<p class="flavor">Команда продолжает бой — пауза только у вас.</p>'}
              <button class="btn primary" data-a="resume">Продолжить</button>
              <div class="row"><button class="btn" data-a="settings">Настройки</button><button class="btn" data-a="controls">Управление</button></div>
              <button class="btn" data-a="achievements">Достижения · ${earnedAchievements().length}/${Object.keys(ACHIEVEMENTS).length}</button>
              <button class="btn ghost" data-a="quit">В главное меню</button></div>`;
        d.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => sfx.play('ui', { vol: 0.6 })));
        if (v === 'settings') bindPreferences(d);
      };
      d.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
        if (a === 'resume') this.togglePause();
        if (a === 'settings' || a === 'controls' || a === 'achievements') render(a);
        if (a === 'back') { render('menu'); this.fx.shakeScale = settings.shake; }
        if (a === 'quit') { d.remove(); this.ended = true; this.onEnd({ kind: 'quit' }); }
      });
      render(view);
      document.getElementById('ui')!.appendChild(d);
    } else if (!this.paused) { el?.remove(); this.fx.shakeScale = settings.shake; }
    if (this.session.solo) {
      // freeze local simulation while paused
      if (this.paused) this.time.timeScale = 0;
      else this.time.timeScale = 1;
    }
  }
}
