import { ENEMIES } from '../enemies';
import { angleDiff, dist, lerpAngle, TAU } from '../math';
import type { World } from './World';
import type { Enemy, Npc, Player } from './types';

type Target = { id: string; x: number; y: number; ref: Player | Npc; isPlayer: boolean };

/**
 * Elite chickens: scripted mutants with their own melee numbers and a telegraphed charge (D52 root manager,
 * D69 Валера on floor 8 and the executive director on floor 11). Keyed by the survivor they used to be.
 * hitRun: seconds an elite retreats after a bite; blind: a flashlight cone slows it and opens it up.
 */
interface Elite {
  damage: number; attackRange: number; attackCd: number; windup: number;
  charge: { cd: number; wind: number; run: number; speed: number; dmg: number; line: string };
  hitRun?: number; blind?: boolean; eggs?: { cd: number; n: number; line: string };
  /** D72: Валера blinks through the dark next to his target (never while a flashlight holds him) */
  blink?: boolean;
  /** D72: Толик keeps his distance and lobs beer bottles that shatter where they land */
  bottles?: { cd: number; line: string };
  /** D73: Вершков makes potato tops burst out under a player: after `delay` they hold whoever stands there */
  roots?: { cd: number; delay: number; r: number; hold: number; dmg: number };
}
export const ELITES: Record<string, Elite> = {
  root_manager: { damage: 42, attackRange: 60, attackCd: .8, windup: .35, charge: { cd: 6.5, wind: .6, run: .75, speed: 460, dmg: 48, line: 'ROOT идёт без согласования!' } },
  valera: { damage: 24, attackRange: 50, attackCd: .75, windup: .28, charge: { cd: 7.5, wind: .55, run: .6, speed: 540, dmg: 28, line: 'Ctrl+Alt+КО-КО!' }, hitRun: 2.2, blind: true, blink: true },
  director: { damage: 34, attackRange: 70, attackCd: 1.05, windup: .42, charge: { cd: 7, wind: .75, run: .8, speed: 470, dmg: 40, line: 'Это не обсуждается!' }, eggs: { cd: 9, n: 5, line: 'Делегирую!' } },
  // D72: floor 7 «Катя» (stronger than a chicken, gentler than the manager), floor 8 Вершков, street 2 Толик
  katya: { damage: 20, attackRange: 52, attackCd: .7, windup: .25, charge: { cd: 6, wind: .5, run: .55, speed: 520, dmg: 26, line: 'ДЕБАГ! ДЕБАГ!' } },
  vershkov: { damage: 24, attackRange: 52, attackCd: .85, windup: .3, charge: { cd: 9, wind: .55, run: .65, speed: 460, dmg: 26, line: 'Окучу!' }, eggs: { cd: 11, n: 3, line: 'Посадка! Всходите!' }, roots: { cd: 4, delay: .75, r: 76, hold: 2.4, dmg: 14 } },
  tolik: { damage: 22, attackRange: 52, attackCd: .9, windup: .3, charge: { cd: 11, wind: .7, run: .55, speed: 430, dmg: 26, line: 'Э, слышь! Ко мне!' }, bottles: { cd: 1.9, line: 'Лови, пивасик!' } },
};

// Preserve rules-7 elite numbers when replaying older room recordings.
const LEGACY_VERSHKOV: Elite = { damage: 16, attackRange: 52, attackCd: 1, windup: .35, charge: { cd: 9, wind: .7, run: .6, speed: 420, dmg: 22, line: 'Окучу!' }, eggs: { cd: 8.5, n: 3, line: 'Посадка! Всходите!' } };

const losByWorld = new WeakMap<World, Map<number, { t: number; ok: boolean }>>();

function findTarget(w: World, e: Enemy, sight: number): { t: Target | null; d: number } {
  let best: Target | null = null, bd = Infinity;
  for (const p of w.players) {
    if (p.state !== 'alive') continue;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < bd) { bd = d; best = { id: p.id, x: p.x, y: p.y, ref: p, isPlayer: true }; }
  }
  for (const n of e.appearance?.npcId === 'root_manager' ? [] : w.npcs) {
    if (!w.npcTargetable(n)) continue;
    const d = dist(e.x, e.y, n.x, n.y) * 1.15; // players are juicier
    if (d < bd) { bd = d; best = { id: n.id, x: n.x, y: n.y, ref: n, isPlayer: false }; }
  }
  if (bd > sight * 3) return { t: null, d: Infinity };
  return { t: best, d: best ? dist(e.x, e.y, best.x, best.y) : Infinity };
}

function los(w: World, e: Enemy, t: Target) {
  let losCache = losByWorld.get(w);
  if (!losCache) { losCache = new Map(); losByWorld.set(w, losCache); }
  const c = losCache.get(e.id);
  if (c && w.time - c.t < 0.25) return c.ok;
  const ok = w.map.lineOfSight(e.x, e.y, t.x, t.y, false);
  losCache.set(e.id, { t: w.time, ok });
  return ok;
}

function hurt(w: World, e: Enemy, t: Target, dmg: number) {
  dmg *= w.script.enemyDamage ?? 1;
  if (t.isPlayer) w.damagePlayer(t.ref as Player, dmg, e.x, e.y);
  else w.damageNpc(t.ref as Npc, dmg);
}

function steer(w: World, e: Enemy, t: Target, td: number, speed: number, dt: number, away = false) {
  let dx: number, dy: number;
  if (away) { dx = e.x - t.x; dy = e.y - t.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
  else if (td < 520 && los(w, e, t)) { dx = (t.x - e.x) / td; dy = (t.y - e.y) / td; }
  else {
    const f = w.flow.dirAt(e.x, e.y);
    if (f) [dx, dy] = f; else { dx = (t.x - e.x) / td; dy = (t.y - e.y) / td; }
  }
  const want = Math.atan2(dy, dx);
  e.angle = lerpAngle(e.angle, want, Math.min(1, dt * 9));
  const r = ENEMIES[e.type].radius;
  // move along desired dir (not facing) so turning doesn't make them drift into walls
  [e.x, e.y] = w.map.move(e.x, e.y, r * 0.8, dx * speed * dt, dy * speed * dt);
}

export function updateEnemy(w: World, e: Enemy, dt: number) {
  const elite = e.appearance?.npcId === 'vershkov' && w.rules < 8 ? LEGACY_VERSHKOV : e.appearance ? ELITES[e.appearance.npcId] : undefined;
  const def = elite ? { ...ENEMIES[e.type], damage: elite.damage, attackRange: elite.attackRange, attackCd: elite.attackCd, windup: elite.windup } : ENEMIES[e.type];
  e.flashT -= dt; e.stunT -= dt; e.cd -= dt;
  if (e.burnT > 0) {
    e.burnT -= dt;
    w.damageEnemy(e, 16 * dt, e.angle, 0, '', 'fire');
    if (e.hp <= 0) return;
  }
  // knockback
  if (Math.abs(e.vx) + Math.abs(e.vy) > 2) {
    [e.x, e.y] = w.map.move(e.x, e.y, def.radius * 0.8, e.vx * dt, e.vy * dt);
    const k = Math.exp(-9 * dt);
    e.vx *= k; e.vy *= k;
  } else { e.vx = 0; e.vy = 0; }

  if (e.state === 'rise') {
    e.t -= dt;
    if (e.t <= 0) e.state = 'chase';
    return;
  }

  const { t, d: td } = findTarget(w, e, def.sight);
  // D69 floor 8: sleeping chickens sit still; a player stepping close or shining a flashlight in their eyes wakes them
  if (!e.aggro && e.dormant && w.stealth) {
    if (stealthWake(w, e)) {
      e.dormant = false; e.aggro = true;
      w.say(String(e.id), w.rng.pick(['КО?!', 'КТО ЗДЕСЬ?!', 'Свет! Выключи свет!', 'КУДАХ?!']), 1.4);
      for (const o of w.enemies) if (o !== e && !o.aggro && dist(o.x, o.y, e.x, e.y) < 220) { o.aggro = true; o.dormant = false; }
    }
    return;
  }
  if (!e.aggro) {
    if (!e.dormant && t && td < def.sight && los(w, e, t)) {
      e.aggro = true;
      for (const o of w.enemies) if (!o.aggro && dist(o.x, o.y, e.x, e.y) < 260) o.aggro = true;
    } else {
      // idle: peck around slowly
      e.t -= dt;
      if (e.t <= 0) { e.t = 1 + w.rng.next() * 2.5; e.wanderA = w.rng.next() < 0.4 ? NaN : w.rng.next() * TAU; }
      if (!Number.isNaN(e.wanderA)) {
        e.angle = lerpAngle(e.angle, e.wanderA, Math.min(1, dt * 4));
        const [nx, ny] = w.map.move(e.x, e.y, def.radius * 0.8, Math.cos(e.angle) * 28 * dt, Math.sin(e.angle) * 28 * dt);
        if (Math.abs(nx - e.x - Math.cos(e.angle) * 28 * dt) > 0.5) e.wanderA += Math.PI;
        e.x = nx; e.y = ny;
      }
      return;
    }
  }
  if (!t) return;
  if (e.type === 'boss') return updateBoss(w, e, t, td, dt);
  if (elite) {
    const ch = elite.charge;
    e.abilityCd -= dt;
    if (elite.blind) {
      // a flashlight cone on it: slowed and exposed (damage x1.6 in World.damageEnemy)
      const beam = w.rules >= 8 && (w.light ?? -1) >= 0.985 ? 430 : 560; // D73: in deep darkness flashlights reach less
      const lit = w.players.some(p => p.state === 'alive' && dist(p.x, p.y, e.x, e.y) < beam && Math.abs(angleDiff(p.aim, Math.atan2(e.y - p.y, e.x - p.x))) < .42 && w.map.lineOfSight(p.x, p.y, e.x, e.y, true));
      const was = (e.blindT ?? 0) > 0;
      e.blindT = lit ? .35 : Math.max(0, (e.blindT ?? 0) - dt);
      e.litT = lit ? (e.litT ?? 0) + dt : 0;
      if (lit && !was && w.rng.chance(.25)) w.say(String(e.id), w.rng.pick(['А-А-А! СВЕТ!', 'Убери фонарик! Глаза!', 'Тёмная тема! ВЕРНИТЕ ТЁМНУЮ ТЕМУ!']), 1.5);
      // held in a beam for a while: it bolts back into the dark
      if (e.litT > 1.1 && e.state !== 'charge' && !(e.fleeT ?? 0)) { e.litT = 0; e.fleeT = 1.5; if (w.rng.chance(.4)) w.say(String(e.id), w.rng.pick(['Не поймаешь!', 'Я в тёмном режиме!', 'Ко-ко… офлайн!']), 1.4); }
    }
    // D72: in the dark (no beam on him) Валера vanishes and reappears beside his prey with a lunge
    // D73: «light» is a lit place (a lamp; in deep darkness only the red emergency lights), not a flashlight beam:
    // the beam slows and exposes him, but cannot pin him down
    if (elite.blink && (w.light ?? -1) >= 0.5 && (w.rules >= 8 ? !inLamplight(w, e.x, e.y) : !((e.blindT ?? 0) > 0)) && e.state !== 'charge' && !((e.fleeT ?? 0) > 0)) {
      e.blinkT = (e.blinkT ?? 2.5) - dt;
      if (e.blinkT <= 0 && td < 1000) {
        e.blinkT = w.rules >= 8 ? 1.9 + w.rng.next() * 1.1 : 3 + w.rng.next() * 1.8;
        // D73: behind the prey — opposite to where it is looking (the beam), then anywhere around it
        const look = t.isPlayer ? (t.ref as Player).aim : (t.ref as Npc).angle;
        for (let k = 0; k < (w.rules >= 8 ? 10 : 8); k++) {
          const behind = w.rules >= 8 && k < 6;
          const a = behind ? look + Math.PI + (w.rng.next() - 0.5) * 1.3 : w.rng.next() * TAU;
          const r = w.rules >= 8 ? (behind ? 105 : 150) + w.rng.next() * 60 : 150 + w.rng.next() * 80;
          const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r;
          if (w.map.blockedAt(x, y, 22) || !w.map.lineOfSight(t.x, t.y, x, y, false) || (w.rules >= 8 && inLamplight(w, x, y))) continue;
          w.scare('blink', e.x, e.y);
          e.x = x; e.y = y; e.vx = 0; e.vy = 0;
          e.state = 'charge'; e.ability = 'charge_wind'; e.t = w.rules >= 8 ? 0.42 : 0.5; e.angle = Math.atan2(t.y - y, t.x - x);
          w.scare('eyes', x, y);
          if (w.rng.chance(.35)) w.say(String(e.id), w.rng.pick(['Я в каждом углу.', 'Тёмная тема — везде.', 'Ку-ку. То есть КО-КО.', 'Свет выключен. Я — включён.']), 1.6);
          return;
        }
      }
    }
    if (w.rules >= 8 && elite.roots && e.state !== 'charge') {
      // potato tops burst out under the target (and, below half health, under everyone close), hold them, then he rushes in
      e.blinkT = (e.blinkT ?? 2) - dt;
      if (e.blinkT <= 0 && td < 650 && los(w, e, t)) {
        const R = elite.roots, rage = e.hp < e.maxHp * 0.5;
        e.blinkT = R.cd * (rage ? 0.75 : 1) + w.rng.next();
        const spots = [{ x: t.x, y: t.y }];
        if (rage) for (const p of w.players) if (p.state === 'alive' && p.id !== t.id && dist(p.x, p.y, e.x, e.y) < 700) spots.push({ x: p.x, y: p.y });
        w.say(String(e.id), w.rng.pick(['Корни пущу!', 'Ботва, держи их!', 'Не уйдёшь с грядки!', 'Окучиваю!']), 1.5);
        for (const s of spots) w.scare('roots', s.x, s.y);
        w.after(R.delay, () => {
          if (e.hp <= 0) return;
          for (const s of spots) for (const p of w.players) {
            if (p.state !== 'alive' || dist(p.x, p.y, s.x, s.y) > R.r) continue;
            p.slowT = Math.max(p.slowT ?? 0, R.hold);
            w.damagePlayer(p, R.dmg * (w.script.enemyDamage ?? 1), s.x, s.y);
            w.scare('rooted', p.x, p.y);
          }
        });
        // and comes for the one who is stuck
        e.abilityCd = Math.min(e.abilityCd, R.delay + 0.25);
        return;
      }
    }
    if (elite.bottles && e.state !== 'charge') {
      // keep a throwing distance; lob a bottle at the target's feet (it flies over heads and shatters there)
      e.blinkT = (e.blinkT ?? 1.5) - dt;
      if (e.blinkT <= 0 && td > 90 && td < 560 && los(w, e, t)) {
        const rage = e.hp < e.maxHp * 0.5;
        e.blinkT = elite.bottles.cd * (rage ? 0.8 : 1) + w.rng.next() * 0.6;
        if (w.rng.chance(.3)) w.say(String(e.id), w.rng.pick([elite.bottles.line, 'Ик!', 'Перекур окончен!', 'Кто моё пиво трогал?!', 'Пустая тара — сдаётся!']), 1.5);
        const n = rage ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const tx = t.x + (i ? (w.rng.next() - 0.5) * 140 : 0), ty = t.y + (i ? (w.rng.next() - 0.5) * 140 : 0);
          const d = Math.max(60, Math.hypot(tx - e.x, ty - e.y)), ttl = Math.min(1.3, Math.max(0.45, d / 420));
          w.addProjectile('bottle', e.x, e.y - 10, (tx - e.x) / ttl, (ty - e.y) / ttl, String(e.id), 'chicken', 14 * (w.script.enemyDamage ?? 1), ttl);
        }
        w.emit({ e: 'swing', id: e.id, x: Math.round(e.x), y: Math.round(e.y), a: Math.atan2(t.y - e.y, t.x - e.x) });
        return;
      }
      if (td < 170 && e.cd > 0) { steer(w, e, t, td, ENEMIES[e.type].speed * e.speedMul, dt, true); return; }
    }
    if ((e.fleeT ?? 0) > 0 && e.state !== 'charge') {
      // hit-and-run: back into the dark, then come again
      e.fleeT = Math.max(0, (e.fleeT ?? 0) - dt);
      steer(w, e, t, td, ENEMIES[e.type].speed * e.speedMul * 1.25, dt, true);
      return;
    }
    if (e.state === 'charge') {
      e.t -= dt;
      if (e.ability === 'charge_wind') {
        e.angle = Math.atan2(t.y - e.y, t.x - e.x);
        if (e.t <= 0) { e.ability = 'charge_run'; e.t = ch.run; }
      } else {
        [e.x, e.y] = w.map.move(e.x, e.y, def.radius * .8, Math.cos(e.angle) * ch.speed * dt, Math.sin(e.angle) * ch.speed * dt);
        if (dist(e.x, e.y, t.x, t.y) <  70 && los(w, e, t)) { hurt(w, e, t, ch.dmg); e.t = 0; e.cd = .9; if (elite.hitRun) e.fleeT = w.rules >= 8 && elite.blink ? 0.7 : elite.hitRun; if (w.rules >= 8 && elite.blink) e.blinkT = Math.min(e.blinkT ?? 9, 0.8); }
        if (e.t <= 0) { e.state = 'chase'; e.ability = ''; }
      }
      return;
    }
    if (elite.eggs) {
      // phase is unused by elites: it counts down to the next «делегирование» (eggs that hatch into chicks)
      e.phase -= dt;
      if (e.phase <= -elite.eggs.cd && td < 700 && los(w, e, t)) {
        e.phase = 0;
        w.say(String(e.id), elite.eggs.line, 1.5);
        const toT = Math.atan2(t.y - e.y, t.x - e.x), n = elite.eggs.n;
        for (let i = 0; i < n; i++) {
          const a = toT + (i / (n - 1) - 0.5) * 1.4, sp = 280 + w.rng.next() * 220;
          w.addProjectile('egg', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, Math.cos(a) * sp, Math.sin(a) * sp, String(e.id), 'chicken', 0, 0.9 + w.rng.next() * 0.3);
        }
        return;
      }
    }
    if (e.abilityCd <= 0 && td < 850 && los(w, e, t)) {
      e.abilityCd = ch.cd; e.state = 'charge'; e.ability = 'charge_wind'; e.t = ch.wind;
      w.say(String(e.id), ch.line, 1.5);
      w.emit({ e: 'swing', id: e.id, x: e.x, y: e.y, a: Math.atan2(t.y - e.y, t.x - e.x) });
      return;
    }
  }

  const burning = e.burnT > 0 ? 1.25 : 1;
  const speed = def.speed * e.speedMul * burning * (e.stunT > 0 ? 0.25 : 1) * ((e.blindT ?? 0) > 0 ? .7 : 1) * (w.opts.difficulty ?? 1) ** 0.3;

  if (e.type === 'jumper') {
    // D71: «прыгун» — leaps at its target from mid range and lands with a heavy peck
    if (e.state === 'charge') {
      e.t -= dt;
      [e.x, e.y] = w.map.move(e.x, e.y, def.radius * 0.8, Math.cos(e.angle) * e.wanderA * dt, Math.sin(e.angle) * e.wanderA * dt);
      if (e.t <= 0) {
        e.state = 'chase'; e.ability = ''; e.cd = 1.5;
        w.emit({ e: 'swing', id: e.id, x: Math.round(e.x), y: Math.round(e.y), a: e.angle });
        if (dist(e.x, e.y, t.x, t.y) < 62) hurt(w, e, t, def.damage * 1.6);
      }
      return;
    }
    if (e.cd <= 0 && td > 110 && td < 380 && e.stunT <= 0 && los(w, e, t)) {
      e.state = 'charge'; e.ability = 'leap'; e.t = 0.55;
      e.angle = Math.atan2(t.y - e.y, t.x - e.x); e.wanderA = Math.min(680, (td - 20) / 0.55);
      w.emit({ e: 'fuse', id: e.id });
      return;
    }
  }

  switch (e.state) {
    case 'windup': {
      e.t -= dt;
      e.angle = lerpAngle(e.angle, Math.atan2(t.y - e.y, t.x - e.x), Math.min(1, dt * 12));
      if (e.t > 0) return;
      e.state = 'chase';
      e.cd = def.attackCd;
      if (e.type === 'spitter') {
        const a = Math.atan2(t.y - e.y, t.x - e.x) + (w.rng.next() - 0.5) * 0.12;
        w.addProjectile('spit', e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, Math.cos(a) * 400, Math.sin(a) * 400, String(e.id), 'chicken', def.damage * (w.script.enemyDamage ?? 1), 1.3);
      } else if (td < def.attackRange + 22) {
        hurt(w, e, t, def.damage);
        if (elite?.hitRun) e.fleeT = elite.hitRun;
      }
      return;
    }
    case 'fuse': {
      e.t -= dt;
      steer(w, e, t, td, speed * 0.55, dt);
      if (e.t <= 0) w.killEnemy(e, e.angle, '', true, false);
      return;
    }
    default: {
      e.state = 'chase';
      if (e.type === 'spitter') {
        const see = td < def.attackRange && los(w, e, t);
        if (see && e.cd <= 0) { e.state = 'windup'; e.t = def.windup; w.emit({ e: 'swing', id: e.id, x: e.x, y: e.y, a: e.angle }); return; }
        if (td < 200) steer(w, e, t, td, speed * 0.8, dt, true);
        else if (!see || td > 340) steer(w, e, t, td, speed, dt);
        else {
          // strafe
          const side = (e.id % 2 ? 1 : -1);
          const a = Math.atan2(t.y - e.y, t.x - e.x) + side * Math.PI / 2;
          e.angle = lerpAngle(e.angle, Math.atan2(t.y - e.y, t.x - e.x), Math.min(1, dt * 8));
          [e.x, e.y] = w.map.move(e.x, e.y, def.radius * 0.8, Math.cos(a) * speed * 0.5 * dt, Math.sin(a) * speed * 0.5 * dt);
        }
        return;
      }
      if (e.type === 'exploder' && td < def.attackRange) {
        e.state = 'fuse'; e.t = def.windup;
        w.emit({ e: 'fuse', id: e.id });
        return;
      }
      if (td < def.attackRange + 14 && e.cd <= 0) {
        e.state = 'windup'; e.t = def.windup;
        w.emit({ e: 'swing', id: e.id, x: Math.round(e.x), y: Math.round(e.y), a: e.angle });
        return;
      }
      if (td > def.attackRange * 0.6) steer(w, e, t, td, speed, dt);
      else e.angle = lerpAngle(e.angle, Math.atan2(t.y - e.y, t.x - e.x), Math.min(1, dt * 10));
    }
  }
}

// --------------------------------------------------------------------------- boss
function updateBoss(w: World, e: Enemy, t: Target, td: number, dt: number) {
  const def = ENEMIES.boss;
  const ratio = e.hp / e.maxHp;
  const newPhase = ratio < 0.25 ? 2 : ratio < 0.6 ? 1 : 0;
  if (newPhase > e.phase) {
    e.phase = newPhase;
    w.script.onBossPhase?.(w, e, newPhase);
    e.abilityCd = 1;
  }
  const rage = 1 + e.phase * 0.25;
  e.abilityCd -= dt;
  const toT = Math.atan2(t.y - e.y, t.x - e.x);

  if (e.state === 'charge') {
    e.t -= dt;
    if (e.ability === 'charge_wind') {
      e.angle = lerpAngle(e.angle, toT, Math.min(1, dt * 6));
      if (e.t <= 0) { e.ability = 'charge_run'; e.t = 0.9; }
      return;
    }
    // running
    const sp = 720 * rage;
    const [nx, ny] = w.map.move(e.x, e.y, def.radius * 0.8, Math.cos(e.angle) * sp * dt, Math.sin(e.angle) * sp * dt);
    const blocked = Math.hypot(nx - e.x, ny - e.y) < sp * dt * 0.5;
    e.x = nx; e.y = ny;
    for (const p of w.players) {
      if (p.state === 'alive' && dist(p.x, p.y, e.x, e.y) < def.radius + 20 && !(p as any)._bossHit) {
        (p as any)._bossHit = true;
        w.damagePlayer(p, w.rules >= 7 ? 26 : w.rules >= 5 ? 24 : 30, e.x, e.y);
      }
    }
    for (const o of w.enemies) if (o !== e && dist(o.x, o.y, e.x, e.y) < def.radius + 10) w.damageEnemy(o, 999, e.angle, 600, '', 'melee');
    if (blocked || e.t <= 0) {
      for (const p of w.players) (p as any)._bossHit = false;
      e.state = 'chase'; e.stunT = blocked ? 1.2 : 0.3;
      if (blocked) { w.emit({ e: 'shake', s: 0.03 }); w.say(String(e.id), 'КО-КО-КОРПОРАТИВНАЯ СТЕНА!', 1.6); }
    }
    return;
  }
  if (e.state === 'windup') {
    e.t -= dt;
    e.angle = lerpAngle(e.angle, toT, Math.min(1, dt * 6));
    if (e.t <= 0) {
      e.state = 'chase'; e.cd = def.attackCd / rage;
      // wide claw swipe hits everyone in front
      for (const p of w.players) {
        if (p.state !== 'alive') continue;
        const d = dist(p.x, p.y, e.x, e.y);
        if (d < def.attackRange + 30 && Math.abs(angleDiff(e.angle, Math.atan2(p.y - e.y, p.x - e.x))) < 1.2) w.damagePlayer(p, w.rules >= 7 ? 30 : w.rules >= 5 ? 28 : def.damage, e.x, e.y);
      }
    }
    return;
  }
  if (e.stunT > 0) return;

  if (e.abilityCd <= 0) {
    const options = e.phase === 0 ? ['eggs', 'charge'] : e.phase === 1 ? ['eggs', 'charge', 'ring', 'summon'] : ['charge', 'ring', 'eggs', 'summon', 'ring'];
    const ab = options[Math.floor(w.rng.next() * options.length)];
    e.abilityCd = (4.2 - e.phase * 0.9) + w.rng.next();
    if (ab === 'eggs') {
      w.say(String(e.id), 'Делегирую задачи!', 1.6);
      const n = 4 + e.phase * 2;
      for (let i = 0; i < n; i++) {
        const a = toT + (i / (n - 1) - 0.5) * 1.6;
        const sp = 300 + w.rng.next() * 260;
        w.addProjectile('egg', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, Math.cos(a) * sp, Math.sin(a) * sp, String(e.id), 'chicken', 0, 0.9 + w.rng.next() * 0.4);
      }
    } else if (ab === 'charge') {
      e.state = 'charge'; e.ability = 'charge_wind'; e.t = 0.8;
      w.emit({ e: 'fuse', id: e.id });
      w.say(String(e.id), 'Синергия!!!', 1.2);
    } else if (ab === 'ring') {
      const n = 18;
      w.say(String(e.id), 'Оптимизация штата!', 1.6);
      for (let k = 0; k < 2; k++) w.after(k * 0.45, () => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + k * 0.17;
          w.addProjectile('spit', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, Math.cos(a) * 330, Math.sin(a) * 330, String(e.id), 'chicken', w.rules >= 7 ? 10 : w.rules >= 5 ? 9 : 12, 2.2);
        }
      });
    } else if (ab === 'summon') {
      w.say(String(e.id), 'Совещание! Все в переговорку!', 1.8);
      w.spawnWave('boss', ['normal', 'fast', 'normal', 'spitter', 'armored'], w.rules >= 5 ? 6 + e.phase * 3 : 10 + e.phase * 4, .25, true, 'boss');
    }
    return;
  }
  if (td < def.attackRange && e.cd <= 0) {
    e.state = 'windup'; e.t = def.windup;
    w.emit({ e: 'swing', id: e.id, x: Math.round(e.x), y: Math.round(e.y), a: e.angle });
    return;
  }
  steer(w, e, t, td, def.speed * rage, dt);
}

/** D73: is a point inside a lamp's light (in deep darkness only emergency lights still shine)? */
function inLamplight(w: World, x: number, y: number) {
  const deep = (w.light ?? -1) >= 0.985;
  for (const o of w.map.objects) {
    if (o.type !== 'light' || (deep && o.props.kind !== 'emergency')) continue;
    const r = Number(o.props.radius ?? 260) * 0.55;
    if ((o.cx - x) ** 2 + (o.cy - y) ** 2 < r * r) return true;
  }
  return false;
}

/** D69: a sleeping chicken wakes when someone steps close or holds a flashlight on it. */
function stealthWake(w: World, e: Enemy) {
  for (const p of w.players) {
    if (p.state !== 'alive') continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < 120) return true;
    if (d < 340 && Math.abs(angleDiff(p.aim, Math.atan2(e.y - p.y, e.x - p.x))) < .4 && w.map.lineOfSight(p.x, p.y, e.x, e.y, true)) return true;
  }
  return false;
}
