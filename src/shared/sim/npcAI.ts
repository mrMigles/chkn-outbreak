import { ENEMIES } from '../enemies';
import { angleDiff, dist, lerpAngle } from '../math';
import { WEAPONS } from '../weapons';
import type { World } from './World';
import type { Npc } from './types';

const R = 14;
const SPEED = 215;

function moveTo(w: World, n: Npc, x: number, y: number, speed: number, dt: number, stopAt = 8) {
  const d = dist(n.x, n.y, x, y);
  if (d < stopAt) return true;
  const a = Math.atan2(y - n.y, x - n.x);
  const s = Math.min(d, speed * dt);
  [n.x, n.y] = w.map.move(n.x, n.y, R, Math.cos(a) * s, Math.sin(a) * s);
  n.angle = lerpAngle(n.angle, a, Math.min(1, dt * 10));
  return false;
}

/** Follow a player through corridors using their breadcrumb trail. Companions never stop following on their own. */
function follow(w: World, n: Npc, dt: number) {
  let p = w.players.find((q) => q.id === n.follow);
  if (!p || (p.state !== 'alive' && p.state !== 'downed')) {
    // the leader is down/out: tag along with another living teammate, otherwise wait where we are
    const other = w.players.find((q) => q.state === 'alive');
    if (other) { n.follow = other.id; p = other; } else return;
  }
  const d = dist(n.x, n.y, p.x, p.y);
  const speed = SPEED * (d > 250 ? 1.25 : 1);
  // each companion keeps its own distance so a group spreads into a loose ring (see World.separateNpcs)
  const keep = 64 + (hash(n.id) % 4) * 14;
  if (d < keep) return;
  if (w.map.lineOfSight(n.x, n.y, p.x, p.y, false)) { moveTo(w, n, p.x, p.y, speed, dt, keep - 6); return; }
  const tr = w.trail(p.id);
  for (let i = tr.length - 1; i >= 0; i--) {
    if (w.map.lineOfSight(n.x, n.y, tr[i].x, tr[i].y, false)) { moveTo(w, n, tr[i].x, tr[i].y, speed, dt, 4); return; }
  }
  if (d > 1100) {
    // lost: catch up through a trail point a bit behind the player (usually off-screen)
    let q = tr[tr.length - 1] ?? p;
    for (let i = tr.length - 1; i >= 0; i--) if (dist(tr[i].x, tr[i].y, p.x, p.y) > 220) { q = tr[i]; break; }
    n.x = q.x; n.y = q.y;
  }
}

export function updateNpc(w: World, n: Npc, dt: number) {
  if (n.mode === 'dead' || n.mode === 'gone') return;
  n.hurtT -= dt;
  n.talkCd -= dt;
  n.fireCd -= dt;

  // nearest chicken (any) drives fleeing/cowering; armed NPCs shoot the nearest one they can actually see
  let threat = null as { x: number; y: number; d: number } | null;
  let target = null as { x: number; y: number; d: number } | null;
  const consider = (x: number, y: number) => {
    const d = dist(n.x, n.y, x, y);
    if (d >= 600) return;
    if (d < (threat?.d ?? 600)) threat = { x, y, d };
    if (n.weapon && d < (target?.d ?? 600) && w.map.lineOfSight(n.x, n.y, x, y, true)) target = { x, y, d };
  };
  for (const e of w.enemies) if (e.state !== 'rise') consider(e.x, e.y);
  for (const p of w.players) if (p.state === 'chicken') consider(p.x, p.y);
  let aimA: number | null = null;
  if (n.weapon && target && n.mode !== 'cower') {
    const t = target as { x: number; y: number; d: number };
    const a = Math.atan2(t.y - n.y, t.x - n.x);
    n.angle = lerpAngle(n.angle, a, Math.min(1, dt * 14));
    aimA = n.angle;
    if (n.fireCd <= 0 && Math.abs(angleDiff(n.angle, a)) < 0.3) {
      const def = WEAPONS[n.weapon];
      w.fireFrom(n.id, 'human', n.weapon, n.x, n.y, a + (Math.random() - 0.5) * 0.08, null, 0.7);
      n.fireCd = 1 / (def.rof * 0.6);
      if (Math.random() < 0.04 && n.talkCd <= 0) { w.say(n.id, pickLine(COMBAT_LINES)); n.talkCd = 6; }
    }
  }

  switch (n.mode) {
    case 'follow': follow(w, n, dt); break;
    case 'goto':
      if (n.goal && moveTo(w, n, n.goal.x, n.goal.y, SPEED, dt, 10)) { n.goal = null; n.mode = 'guard'; w.script.onNpcArrive?.(w, n); }
      break;
    case 'flee':
      if (threat && threat.d < 300) {
        const a = Math.atan2(n.y - threat.y, n.x - threat.x);
        [n.x, n.y] = w.map.move(n.x, n.y, R, Math.cos(a) * SPEED * dt, Math.sin(a) * SPEED * dt);
        n.angle = lerpAngle(n.angle, a, dt * 8);
      }
      break;
    case 'cower': {
      // waiting to be rescued: becomes rescued when no chickens nearby and a player comes close
      const p = w.players.find((q) => q.state === 'alive' && dist(q.x, q.y, n.x, n.y) < 160);
      // chickens that can actually reach the survivor (not the ones behind a wall)
      const near = w.enemies.filter((e) => { const d = dist(e.x, e.y, n.x, n.y); return d < 380 && (d < 150 || w.map.lineOfSight(e.x, e.y, n.x, n.y, false)); });
      const danger = near.length > 0;
      // the rescuer is here: the chickens hiding around the survivor attack instead of waiting forever
      if (p && danger) for (const e of near) if (!e.aggro || e.dormant) { e.aggro = true; e.dormant = false; e.target = p.id; }
      if (p && !danger) {
        n.rescued = true;
        n.mode = 'idle';
        n.angle = Math.atan2(p.y - n.y, p.x - n.x);
        w.script.onRescue?.(w, n, p);
      } else if (n.talkCd <= 0 && danger) {
        w.say(n.id, pickLine(HELP_LINES), 2.2);
        n.talkCd = 4 + Math.random() * 3;
      }
      break;
    }
    case 'idle': case 'guard': {
      if (!threat || !n.weapon) {
        const p = w.players.find((q) => q.state === 'alive' && dist(q.x, q.y, n.x, n.y) < 220);
        if (p) {
          n.angle = lerpAngle(n.angle, Math.atan2(p.y - n.y, p.x - n.x), Math.min(1, dt * 4));
          if (n.talkCd <= 0 && n.lines.length) { w.say(n.id, pickLine(n.lines)); n.talkCd = 9 + Math.random() * 6; }
        }
      }
      break;
    }
  }
  // keep facing the target while walking (the gun points where the bullets go)
  if (aimA !== null) n.angle = aimA;
  // NPCs get bitten too: handled by enemy AI (they are valid targets)
  void ENEMIES;
}

const pickLine = (a: string[]) => a[Math.floor(Math.random() * a.length)];
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const HELP_LINES = ['Помогите!!!', 'Они клюются!', 'Кто-нибудь! Тут курицы!', 'Я забаррикадировался кулером!', 'Мама, я не хочу нестись!'];
const COMBAT_LINES = ['Получай, несушка!', 'Это за мой отпуск!', 'Перья во все стороны!', 'Обед отменяется!', 'Я ВСЁ напишу в отчёте!'];
