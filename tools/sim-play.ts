// D69 balance autopilot: plays levels in the authoritative simulation (no browser, faster than real time)
// with 1–4 bot players that behave like a decent human: follow the objective arrow (path-finding to the
// objective targets, a different target per bot when several are listed), shoot the nearest visible
// chicken with reaction time and aim error, kite when bitten, heal themselves, revive teammates, use
// terminals / doors / NPCs in reach, pick the best gun with ammo. The campaign carries loadouts over.
//   npx tsx tools/sim-play.ts [levels=office8] [players=1] [runs=3] [seed=1] [carryFrom=]
// Prints per level and run: result, time, retries (solo game overs), downs, min HP, kills, objectives timeline.
import fs from 'node:fs';
import { World, type Carry } from '../src/shared/sim/World';
import { GameMap } from '../src/shared/map';
import { LEVELS } from '../src/shared/levels';
import { FlowField, NAV } from '../src/shared/nav';
import { PLAYER } from '../src/shared/enemies';
import { WEAPONS, WEAPON_ORDER } from '../src/shared/weapons';
import { enemyScale } from '../src/shared/sim/hitbox';
import { Rng } from '../src/shared/math';
let R = new Rng(1);
const rnd = () => R.next();
import type { Player } from '../src/shared/sim/types';

const json = (id: string) => JSON.parse(fs.readFileSync(`public/assets/maps/${id}.tmj`, 'utf8'));
const DT = 1 / 30;

interface Bot { id: string; flow: FlowField; key: string; recalc: number; target: { x: number; y: number } | null; aimT: number; aimId: number; err: number; stuckT: number; lastX: number; lastY: number; wander: number; wanderA: number; pulse: number; minHp: number; downs: number }

export interface RunResult { level: string; ok: boolean; time: number; retries: number; downs: number; minHp: number; kills: number; log: string[]; carry?: Carry; stuck: number; hpEnd: number[] }

function resolveTargets(w: World, names: string[]) {
  const out: { x: number; y: number }[] = [];
  for (const t of names) {
    if (t.startsWith('@')) { const [x, y] = t.slice(1).split(',').map(Number); out.push({ x, y }); continue; }
    const n = w.npcs.find(q => q.id === t && q.mode !== 'dead' && q.mode !== 'gone');
    if (n) { out.push({ x: n.x, y: n.y }); continue; }
    const o = ['use', 'trigger', 'npc', 'door'].map(type => w.map.objects.find(q => q.name === t && q.type === type)).find(Boolean);
    if (o) out.push({ x: o.cx, y: o.cy });
  }
  return out;
}

function pathDir(w: World, b: Bot, p: Player, target: { x: number; y: number }) {
  const key = `${Math.round(target.x / NAV)},${Math.round(target.y / NAV)}|` + w.doors.map(d => d.open ? 'o' : d.locked ? 'l' : 'c').join('');
  if (key !== b.key || b.recalc <= 0) {
    b.key = key; b.recalc = 1.5;
    b.flow.rebuildBlocked();
    for (const d of w.doors) if (d.locked && !d.open) for (let y = Math.floor(d.y / NAV); y < Math.ceil((d.y + d.h) / NAV); y++) for (let x = Math.floor(d.x / NAV); x < Math.ceil((d.x + d.w) / NAV); x++) b.flow.blocked[y * b.flow.w + x] = 1;
    const seeds: { x: number; y: number }[] = [];
    for (let r = 0; r <= 3 && !seeds.length; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = target.x + dx * NAV, y = target.y + dy * NAV, c = b.flow.cellOf(x, y);
      if (c >= 0 && !b.flow.blocked[c]) seeds.push({ x, y });
    }
    b.flow.compute(seeds.length ? seeds : [target], 40000);
    if (!Number.isFinite(b.flow.distAt(p.x, p.y))) {
      // behind a locked door: walk up to it
      for (const d of w.doors) if (d.locked && !d.open) for (let y = Math.floor(d.y / NAV); y < Math.ceil((d.y + d.h) / NAV); y++) for (let x = Math.floor(d.x / NAV); x < Math.ceil((d.x + d.w) / NAV); x++) b.flow.blocked[y * b.flow.w + x] = 0;
      b.flow.compute(seeds.length ? seeds : [target], 40000);
    }
  }
  if (Math.hypot(target.x - p.x, target.y - p.y) < 14) return null;
  if (w.map.lineOfSight(p.x, p.y, target.x, target.y, false) && w.map.lineOfSight(p.x + 14, p.y + 14, target.x + 14, target.y + 14, false) && w.map.lineOfSight(p.x - 14, p.y - 14, target.x - 14, target.y - 14, false) && Math.hypot(target.x - p.x, target.y - p.y) < 300) { const a = Math.atan2(target.y - p.y, target.x - p.x); return [Math.cos(a), Math.sin(a)] as [number, number]; }
  // the own cell may be blocked when hugging furniture: try neighbours
  let d = b.flow.dirAt(p.x, p.y);
  if (!d) for (const [ox, oy] of [[16, 0], [-16, 0], [0, 16], [0, -16], [16, 16], [-16, -16], [16, -16], [-16, 16]]) { d = b.flow.dirAt(p.x + ox, p.y + oy); if (d) break; }
  return d;
}

function bestWeapon(p: Player) {
  let best = 0;
  p.weapons.forEach((w, i) => {
    const a = p.ammo[w];
    if (w === 'grenade') return; // a bot would blow itself up in corridors
    if (a && (a.mag > 0 || a.reserve !== 0) && WEAPON_ORDER.indexOf(w) >= WEAPON_ORDER.indexOf(p.weapons[best])) best = i;
  });
  return best;
}

function botStep(w: World, b: Bot, skill: number) {
  const p = w.players.find(q => q.id === b.id)!;
  if (!p) return;
  b.recalc -= DT; b.aimT -= DT; b.pulse--;
  if (p.state === 'alive') { b.minHp = Math.min(b.minHp, p.hp); }
  const inp = { ...p.input, fire: false, interact: false, reload: false };
  if (p.state !== 'alive' && p.state !== 'downed') { w.setInput(p.id, { ...inp, x: p.x, y: p.y }); return; }
  // ---- enemy selection
  let best = null as null | (typeof w.enemies)[number], bd = 1e9;
  for (const e of w.enemies) {
    if (e.state === 'rise') continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    // sleeping chickens on a stealth floor: a careful player only engages them when close enough to finish quickly
    if (w.stealth && e.dormant && !e.aggro && d > 330) continue;
    if (d < bd && d < 640 && w.map.lineOfSight(p.x, p.y, e.x, e.y, true)) { bd = d; best = e; }
  }
  // ---- movement
  let mv: [number, number] | null = null;
  const downed = w.players.filter(q => q.id !== p.id && q.state === 'downed').sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))[0];
  const targets = resolveTargets(w, w.objectiveTarget);
  const slotTargets = targets.length > 1 && w.players.length > 1 ? [targets[p.slot % targets.length]] : targets;
  let goal = downed ? { x: downed.x, y: downed.y } : slotTargets.sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))[0];
  // low on health: grab a nearby medkit / buff first
  if (!downed && p.hp < 65) {
    const k = w.pickups.filter(k => (k.kind === 'health' || k.kind === 'invincible') && Math.hypot(k.x - p.x, k.y - p.y) < 500).sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))[0];
    if (k) goal = { x: k.x, y: k.y };
  }
  if (best && bd < 210 && best.type !== 'spitter') {
    // back off while shooting, curving so a wall does not trap us
    const a = Math.atan2(p.y - best.y, p.x - best.x) + Math.sin(w.time * 1.7 + p.slot) * 0.8;
    mv = [Math.cos(a), Math.sin(a)];
  } else if (best && bd < 360 && !downed && !(goal && p.hp < 65)) {
    mv = null; // stand and shoot (keeps aim steady)
  } else if (goal) {
    mv = pathDir(w, b, p, goal);
  } else {
    // nothing to do: drift around so triggers fire
    b.wander -= DT; if (b.wander <= 0) { b.wander = 2 + rnd() * 2; b.wanderA = rnd() * Math.PI * 2; }
    mv = best ? null : [Math.cos(b.wanderA), Math.sin(b.wanderA)];
  }
  if (downed && Math.hypot(downed.x - p.x, downed.y - p.y) < 90) { mv = null; inp.interact = (w.time % 3.2) < 3; }
  // stuck: sidestep
  if (Math.hypot(p.x - b.lastX, p.y - b.lastY) > 24) { b.lastX = p.x; b.lastY = p.y; b.stuckT = 0; }
  else if (mv) { b.stuckT += DT; if (b.stuckT > 2.5) { b.stuckT = 0; b.wander = 1; b.wanderA = Math.atan2(mv[1], mv[0]) + (rnd() < 0.5 ? 1.6 : -1.6); (b as any).stuck = ((b as any).stuck ?? 0) + 1; } }
  if (b.wander > 0 && b.stuckT === 0 && mv && (b as any).stuck && b.wander > 0.01) { b.wander -= DT; if (b.wander > 0) mv = [Math.cos(b.wanderA), Math.sin(b.wanderA)]; }
  const speed = (p.state === 'downed' ? 45 : PLAYER.speed * WEAPONS[p.weapons[p.cur]].speedMul * ((p.buffs?.sprint ?? 0) > 0 ? 1.6 : 1));
  let [nx, ny] = [p.x, p.y];
  if (mv) [nx, ny] = w.map.move(p.x, p.y, PLAYER.radius, mv[0] * speed * DT, mv[1] * speed * DT);
  // ---- aim and fire (reaction time, aim error, chest/head height like a mouse player)
  let aim = p.aim;
  if (best) {
    if (b.aimId !== best.id) { b.aimId = best.id; b.aimT = 0.22 / skill + rnd() * 0.15; b.err = (rnd() - 0.5) * 0.12 / skill; }
    const h = 51 * enemyScale(best);
    const yAim = best.y - h * (0.35 + rnd() * 0.35) + 36;
    aim = Math.atan2(yAim - ny, best.x - nx) + b.err * (0.6 + rnd() * 0.8);
    inp.fire = b.aimT <= 0;
  } else if (mv) aim = Math.atan2(mv[1], mv[0]);
  // ---- interact: objective terminals, locked doors with the key, objective NPCs, self-heal
  const near = (x: number, y: number, r: number) => Math.hypot(x - p.x, y - p.y) < r;
  let wantE = false;
  for (const o of w.map.objects) if (o.type === 'use' && near(o.cx, o.cy, 80) && (w.objectiveTarget.includes(o.name) || o.props.incident)) wantE = true;
  for (const d of w.doors) if (!d.open && d.locked && p.keys.includes(d.locked) && near(d.x + d.w / 2, d.y + d.h / 2, 105)) wantE = true;
  for (const n of w.npcs) if (n.mode !== 'follow' && n.mode !== 'dead' && n.mode !== 'gone' && !n.mutation && (n.rescued || n.weapon || w.objectiveTarget.includes(n.id)) && near(n.x, n.y, (n.props?.reach ?? 85) - 10)) wantE = true;
  // self-heal is a hold of E (1.2 s); release and press again for the next medkit
  (b as any).healT = ((b as any).healT ?? 0) + DT;
  if (p.hp < 50 && p.supplies.medkit && (!best || bd > 260) && (b as any).healT % 1.6 < 1.35) { inp.interact = true; nx = p.x; ny = p.y; inp.fire = false; }
  else if (wantE && b.pulse <= 0) { inp.interact = true; b.pulse = 8; }
  const wi = bestWeapon(p);
  w.setInput(p.id, { ...inp, seq: inp.seq + 1, x: nx, y: ny, aim, weapon: wi });
}

export function playLevel(level: string, players: number, seed: number, carry?: Carry, skill = 1, maxSec = 900, verbose = false): RunResult {
  const log: string[] = [];
  let retries = 0, downs = 0, kills = 0, stuck = 0, minHp = 100;
  for (let attempt = 0; attempt < 6; attempt++) {
    R = new Rng(seed * 7919 + attempt);
    const w = new World(new GameMap(level, json(level)), LEVELS[level], { solo: players === 1, seed: seed * 1000 + attempt, carry });
    const bots: Bot[] = [];
    for (let i = 0; i < players; i++) {
      const id = carry ? Object.keys(carry.players)[i] ?? 'bot' + i : 'bot' + i;
      w.addPlayer(id, 'Бот ' + (i + 1), i);
      bots.push({ id, flow: new FlowField(w.map), key: '', recalc: 0, target: null, aimT: 0, aimId: -1, err: 0, stuckT: 0, lastX: 0, lastY: 0, wander: 0, wanderA: 0, pulse: 0, minHp: 100, downs: 0 });
    }
    // LOADOUT=smg,shotgun: what a player typically carries into this floor (when not chaining levels)
    if (!carry && process.env.LOADOUT) for (const p of w.players) for (const g of process.env.LOADOUT.split(',')) w.giveWeapon(p, g as any, true);
    w.start();
    let lastObj = '';
    let result: 'win' | 'over' | 'timeout' = 'timeout';
    while (w.time < maxSec) {
      for (const b of bots) botStep(w, b, skill);
      w.events.length = 0;
      w.step(DT);
      for (const ev of w.events) {
        if (ev.e === 'down') { downs++; if (verbose) log.push(`  ${w.time.toFixed(0)}s down ${ev.id} obj="${w.objective}"`); }
        if (ev.e === 'kill' && ev.by.startsWith('bot')) kills++;
        if (ev.e === 'kill' && carry && Object.keys(carry.players).includes(ev.by)) kills++;
        if (ev.e === 'level') result = 'win';
        if (ev.e === 'gameover') result = 'over';
      }
      if (process.env.TRACE && Math.floor(w.time / 5) !== Math.floor((w.time - DT) / 5)) for (const p of w.players) log.push(`    t=${w.time.toFixed(0)} ${p.id} @${(p.x / 64).toFixed(1)},${(p.y / 64).toFixed(1)} hp=${Math.round(p.hp)} in=${(p.input.x / 64).toFixed(1)},${(p.input.y / 64).toFixed(1)} fire=${p.input.fire} E=${p.input.interact}`);
      if (w.objective !== lastObj) { lastObj = w.objective; log.push(`  ${w.time.toFixed(0).padStart(4)}s ${w.objective}`); }
      if (result !== 'timeout') break;
    }
    for (const b of bots) { minHp = Math.min(minHp, b.minHp); stuck += (b as any).stuck ?? 0; }
    if (result === 'win') {
      const c = w.carryOut();
      return { level, ok: true, time: Math.round(w.time), retries, downs, minHp: Math.round(minHp), kills, log, carry: c, stuck, hpEnd: w.players.map(p => Math.round(p.hp)) };
    }
    log.push(`  ${result.toUpperCase()} at ${w.time.toFixed(0)}s obj="${w.objective}" enemies=${w.enemies.length} targets=${w.objectiveTarget.join('|')} -> ${JSON.stringify(resolveTargets(w, w.objectiveTarget).map(t => [Math.round(t.x / 64), Math.round(t.y / 64)]))} players=${JSON.stringify(w.players.map(p => [Math.round(p.x / 64 * 10) / 10, Math.round(p.y / 64 * 10) / 10, p.state]))} npcs=${JSON.stringify(w.npcs.filter(n => n.mode !== "gone").map(n => [n.id, Math.round(n.x / 64 * 10) / 10, Math.round(n.y / 64 * 10) / 10, n.mode]))} enemiesAt=${JSON.stringify(w.enemies.slice(0, 8).map(e => [e.type, Math.round(e.x / 64 * 10) / 10, Math.round(e.y / 64 * 10) / 10, e.state, e.aggro ? 1 : 0, e.dormant ? 1 : 0]))}`);
    retries++;
    if (result === 'timeout') return { level, ok: false, time: Math.round(w.time), retries, downs, minHp: Math.round(minHp), kills, log, stuck, hpEnd: [] };
  }
  return { level, ok: false, time: 0, retries, downs, minHp: Math.round(minHp), kills, log, stuck, hpEnd: [] };
}

if (process.argv[1]?.includes('sim-play')) {
  const [levelsArg = 'office8', playersArg = '1', runsArg = '3', seedArg = '1', skillArg = '1'] = process.argv.slice(2);
  const levels = levelsArg.split(',');
  for (let r = 0; r < +runsArg; r++) {
    let carry: Carry | undefined;
    for (const level of levels) {
      const t0 = Date.now();
      const res = playLevel(level, +playersArg, +seedArg + r * 7, carry, +skillArg, 900, true);
      console.log(`${level} p=${playersArg} run=${r} ${res.ok ? 'WIN' : 'FAIL'} t=${res.time}s retries=${res.retries} downs=${res.downs} minHp=${res.minHp} kills=${res.kills} stuck=${res.stuck} hpEnd=${res.hpEnd.join('/')} (${((Date.now() - t0) / 1000).toFixed(1)}s real)`);
      if (process.env.LOG) console.log(res.log.join('\n'));
      if (!res.ok) { console.log(res.log.slice(-12).join('\n')); break; }
      carry = res.carry;
    }
  }
}
