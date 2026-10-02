import { ENEMIES } from '../enemies';
import { angleDiff, dist, lerpAngle, TAU } from '../math';
import type { World } from './World';
import type { Enemy, Npc, Player } from './types';

type Target = { id: string; x: number; y: number; ref: Player | Npc; isPlayer: boolean };

const losCache = new Map<number, { t: number; ok: boolean }>();

function findTarget(w: World, e: Enemy, sight: number): { t: Target | null; d: number } {
  let best: Target | null = null, bd = Infinity;
  for (const p of w.players) {
    if (p.state !== 'alive') continue;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < bd) { bd = d; best = { id: p.id, x: p.x, y: p.y, ref: p, isPlayer: true }; }
  }
  for (const n of w.npcs) {
    if (!w.npcTargetable(n)) continue;
    const d = dist(e.x, e.y, n.x, n.y) * 1.15; // players are juicier
    if (d < bd) { bd = d; best = { id: n.id, x: n.x, y: n.y, ref: n, isPlayer: false }; }
  }
  if (bd > sight * 3) return { t: null, d: Infinity };
  return { t: best, d: best ? dist(e.x, e.y, best.x, best.y) : Infinity };
}

function los(w: World, e: Enemy, t: Target) {
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
  const def = ENEMIES[e.type];
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
  if (!e.aggro) {
    if (!e.dormant && t && td < def.sight && los(w, e, t)) {
      e.aggro = true;
      for (const o of w.enemies) if (!o.aggro && dist(o.x, o.y, e.x, e.y) < 260) o.aggro = true;
    } else {
      // idle: peck around slowly
      e.t -= dt;
      if (e.t <= 0) { e.t = 1 + Math.random() * 2.5; e.wanderA = Math.random() < 0.4 ? NaN : Math.random() * TAU; }
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

  const burning = e.burnT > 0 ? 1.25 : 1;
  const speed = def.speed * e.speedMul * burning * (e.stunT > 0 ? 0.25 : 1) * (w.opts.difficulty ?? 1) ** 0.3;

  switch (e.state) {
    case 'windup': {
      e.t -= dt;
      e.angle = lerpAngle(e.angle, Math.atan2(t.y - e.y, t.x - e.x), Math.min(1, dt * 12));
      if (e.t > 0) return;
      e.state = 'chase';
      e.cd = def.attackCd;
      if (e.type === 'spitter') {
        const a = Math.atan2(t.y - e.y, t.x - e.x) + (Math.random() - 0.5) * 0.12;
        w.addProjectile('spit', e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, Math.cos(a) * 400, Math.sin(a) * 400, String(e.id), 'chicken', def.damage * (w.script.enemyDamage ?? 1), 1.3);
      } else if (td < def.attackRange + 22) {
        hurt(w, e, t, def.damage);
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
        w.damagePlayer(p, 30, e.x, e.y);
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
        if (d < def.attackRange + 30 && Math.abs(angleDiff(e.angle, Math.atan2(p.y - e.y, p.x - e.x))) < 1.2) w.damagePlayer(p, def.damage, e.x, e.y);
      }
    }
    return;
  }
  if (e.stunT > 0) return;

  if (e.abilityCd <= 0) {
    const options = e.phase === 0 ? ['eggs', 'charge'] : e.phase === 1 ? ['eggs', 'charge', 'ring', 'summon'] : ['charge', 'ring', 'eggs', 'summon', 'ring'];
    const ab = options[Math.floor(Math.random() * options.length)];
    e.abilityCd = (4.2 - e.phase * 0.9) + Math.random();
    if (ab === 'eggs') {
      w.say(String(e.id), 'Делегирую задачи!', 1.6);
      const n = 4 + e.phase * 2;
      for (let i = 0; i < n; i++) {
        const a = toT + (i / (n - 1) - 0.5) * 1.6;
        const sp = 300 + Math.random() * 260;
        w.addProjectile('egg', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, Math.cos(a) * sp, Math.sin(a) * sp, String(e.id), 'chicken', 0, 0.9 + Math.random() * 0.4);
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
          w.addProjectile('spit', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, Math.cos(a) * 330, Math.sin(a) * 330, String(e.id), 'chicken', 12, 2.2);
        }
      });
    } else if (ab === 'summon') {
      w.say(String(e.id), 'Совещание! Все в переговорку!', 1.8);
      w.spawnWave('boss', ['normal', 'fast', 'normal', 'spitter'], 5 + e.phase * 3, 0.35, true, 'boss');
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
