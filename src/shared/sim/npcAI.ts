import { ENEMIES } from '../enemies';
import { dist, lerpAngle } from '../math';
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

/** Follow a player through corridors using their breadcrumb trail. */
function follow(w: World, n: Npc, dt: number) {
  const p = w.players.find((q) => q.id === n.follow);
  if (!p || (p.state !== 'alive' && p.state !== 'downed')) { n.mode = 'guard'; n.follow = null; return; }
  const d = dist(n.x, n.y, p.x, p.y);
  const speed = SPEED * (d > 250 ? 1.25 : 1);
  if (d < 75) return;
  if (w.map.lineOfSight(n.x, n.y, p.x, p.y, false)) { moveTo(w, n, p.x, p.y, speed, dt, 70); return; }
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

  // armed NPCs shoot the nearest visible chicken
  let threat: { x: number; y: number; d: number } | null = null;
  for (const e of w.enemies) {
    if (e.state === 'rise') continue;
    const d = dist(n.x, n.y, e.x, e.y);
    if (d < (threat?.d ?? 560)) threat = { x: e.x, y: e.y, d };
  }
  for (const p of w.players) {
    if (p.state !== 'chicken') continue;
    const d = dist(n.x, n.y, p.x, p.y);
    if (d < (threat?.d ?? 560)) threat = { x: p.x, y: p.y, d };
  }
  if (n.weapon && threat && n.mode !== 'cower') {
    const a = Math.atan2(threat.y - n.y, threat.x - n.x);
    n.angle = lerpAngle(n.angle, a, Math.min(1, dt * 14));
    if (n.fireCd <= 0 && Math.abs(n.angle - a) < 0.25 && w.map.lineOfSight(n.x, n.y, threat.x, threat.y, true)) {
      const def = WEAPONS[n.weapon];
      w.fireFrom(n.id, 'human', n.weapon, n.x, n.y, n.angle + (Math.random() - 0.5) * 0.08, null, 0.6);
      n.fireCd = 1 / (def.rof * 0.55);
      if (Math.random() < 0.02 && n.talkCd <= 0) { w.say(n.id, pickLine(COMBAT_LINES)); n.talkCd = 6; }
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
      const danger = w.enemies.some((e) => dist(e.x, e.y, n.x, n.y) < 380);
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
  // NPCs get bitten too: handled by enemy AI (they are valid targets)
  void ENEMIES;
}

const pickLine = (a: string[]) => a[Math.floor(Math.random() * a.length)];
const HELP_LINES = ['Помогите!!!', 'Они клюются!', 'Кто-нибудь! Тут курицы!', 'Я забаррикадировался кулером!', 'Мама, я не хочу нестись!'];
const COMBAT_LINES = ['Получай, несушка!', 'Это за мой отпуск!', 'Перья во все стороны!', 'Обед отменяется!', 'Я ВСЁ напишу в отчёте!'];
