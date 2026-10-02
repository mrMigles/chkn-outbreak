// Level passability check: flood-fills each map from the player spawn with the player's radius,
// unlocking doors in story order (key sources below mirror src/shared/levels/*). Fails if any goal,
// trigger, usable, NPC, pickup or spawner needed by the story is unreachable, or a spawn point is stuck.
//   npx tsx tools/check-levels.ts
import fs from 'node:fs';
import { GameMap, TILE, type MapObject } from '../src/shared/map';
import { pickupReach } from '../src/shared/sim/World';
import { PLAYER } from '../src/shared/enemies';

/** Story progression: which object unlocks which lock id. `goal` must become reachable. */
const STORY: Record<string, { unlock: { by: string; lock: string }[]; goal: string[] }> = {
  office: { unlock: [{ by: 'npc:marat', lock: 'blue' }, { by: 'trigger:security_in', lock: 'server' }, { by: 'use:reboot', lock: 'script' }], goal: ['trigger:elevator'] },
  lab: { unlock: [{ by: 'npc:omletov', lock: 'lab' }, { by: 'use:generator', lock: 'script' }], goal: ['trigger:freight'] },
  factory: { unlock: [{ by: 'use:valve1+use:valve2+use:valve3', lock: 'script' }], goal: ['trigger:exit'] },
  boss: { unlock: [], goal: ['spawner:boss_spawn'] },
  arena: { unlock: [], goal: [] },
};
const STEP = 16;
let failed = 0;

for (const id of Object.keys(STORY)) {
  const map = new GameMap(id, JSON.parse(fs.readFileSync(`public/assets/maps/${id}.tmj`, 'utf8')));
  const doors = map.objects.filter((o) => o.type === 'door');
  const W = Math.ceil(map.pw / STEP), H = Math.ceil(map.ph / STEP);
  const open = new Set<string>(['', 'none']);
  const doorAt = (x: number, y: number) => doors.find((d) => x >= d.x - PLAYER.radius && x <= d.x + d.w + PLAYER.radius && y >= d.y - PLAYER.radius && y <= d.y + d.h + PLAYER.radius);
  const passable = (x: number, y: number) => {
    const d = doorAt(x, y);
    if (d) { const lock = String(d.props.locked ?? ''); if (lock && !open.has(lock)) return false; return !map.isWallAt(x, y); }
    return !map.blockedAt(x, y, PLAYER.radius - 2);
  };
  const flood = () => {
    const seen = new Uint8Array(W * H), q: number[] = [];
    for (const s of map.objects.filter((o) => o.type === 'spawn' && o.name === 'player')) {
      const i = Math.floor(s.cy / STEP) * W + Math.floor(s.cx / STEP);
      if (!seen[i]) { seen[i] = 1; q.push(i); }
    }
    while (q.length) {
      const i = q.pop()!, x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[j]) continue;
        if (!passable((nx + 0.5) * STEP, (ny + 0.5) * STEP)) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return seen;
  };
  /** An object is reachable if any reachable cell is within interaction range of its rect. */
  const reach = (seen: Uint8Array, o: MapObject, range = 70) => {
    const x0 = Math.floor((o.x - range) / STEP), x1 = Math.floor((o.x + o.w + range) / STEP);
    const y0 = Math.floor((o.y - range) / STEP), y1 = Math.floor((o.y + o.h + range) / STEP);
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) if (seen[y * W + x]) return true;
    return false;
  };
  const find = (ref: string) => { const [type, name] = ref.split(':'); return map.objects.filter((o) => o.type === type && o.name === name); };
  const problems: string[] = [];
  // progression
  let seen = flood();
  const story = STORY[id];
  for (const u of story.unlock) {
    const ok = u.by.split('+').every((ref) => { const objs = find(ref); if (!objs.length) problems.push(`missing ${ref}`); return objs.some((o) => reach(seen, o)); });
    if (!ok) { problems.push(`cannot reach ${u.by} to unlock "${u.lock}"`); continue; }
    open.add(u.lock);
    seen = flood();
  }
  for (const g of story.goal) { const objs = find(g); if (!objs.length || !objs.some((o) => reach(seen, o))) problems.push(`goal ${g} unreachable`); }
  // everything placed should be reachable once the story is done
  const kinds = ['trigger', 'use', 'npc', 'pickup', 'barrel'];
  const lost = map.objects.filter((o) => kinds.includes(o.type) && !reach(seen, o, o.type === 'pickup' ? pickupReach(map, o.cx, o.cy) - STEP : 90));
  for (const o of lost) problems.push(`${o.type} "${o.name}" at tile ${(o.cx / TILE).toFixed(1)},${(o.cy / TILE).toFixed(1)} unreachable`);
  // every door can be walked through: inside a window of two tiles around it, a player gets from one side of the
  // opening to the other (furniture placed in front of a door must not close it)
  for (const d of doors) {
    const horiz = d.w >= d.h, cx = d.x + d.w / 2, cy = d.y + d.h / 2, reachOut = TILE * 2;
    const x0 = Math.floor((cx - reachOut) / STEP), x1 = Math.floor((cx + reachOut) / STEP), y0 = Math.floor((cy - reachOut) / STEP), y1 = Math.floor((cy + reachOut) / STEP);
    const ok = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && (doorAt((x + 0.5) * STEP, (y + 0.5) * STEP) === d ? !map.isWallAt((x + 0.5) * STEP, (y + 0.5) * STEP) : !map.blockedAt((x + 0.5) * STEP, (y + 0.5) * STEP, PLAYER.radius - 2));
    // start: free cells on one side, goal: free cells on the far side (beyond the door plus a body)
    const side = (x: number, y: number) => { const px = (x + 0.5) * STEP, py = (y + 0.5) * STEP; const v = horiz ? py - cy : px - cx; const lim = (horiz ? d.h : d.w) / 2 + PLAYER.radius * 2; return v < -lim ? -1 : v > lim ? 1 : 0; };
    const seen = new Uint8Array((x1 - x0 + 1) * (y1 - y0 + 1)), q: [number, number][] = [];
    const id = (x: number, y: number) => (y - y0) * (x1 - x0 + 1) + (x - x0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (side(x, y) === -1 && ok(x, y)) { seen[id(x, y)] = 1; q.push([x, y]); }
    let through = false;
    while (q.length && !through) {
      const [x, y] = q.pop()!;
      if (side(x, y) === 1) { through = true; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (ok(nx, ny) && !seen[id(nx, ny)]) { seen[id(nx, ny)] = 1; q.push([nx, ny]); } }
    }
    if (!through) problems.push(`door "${d.name}" at ${(cx / TILE).toFixed(1)},${(cy / TILE).toFixed(1)} cannot be walked through (something blocks the opening)`);
  }
  // spawners must be on open floor (or enemies get stuck)
  for (const s of map.objects.filter((o) => o.type === 'spawner')) if (map.blockedAt(s.cx, s.cy, 10, true)) problems.push(`spawner "${s.name}" at ${(s.cx / TILE).toFixed(1)},${(s.cy / TILE).toFixed(1)} is inside a solid`);
  for (const s of map.objects.filter((o) => o.type === 'spawn')) if (map.blockedAt(s.cx, s.cy, PLAYER.radius - 2)) problems.push(`player spawn at ${(s.cx / TILE).toFixed(1)},${(s.cy / TILE).toFixed(1)} is stuck`);
  const cells = seen.reduce((a, b) => a + b, 0);
  if (problems.length) { failed++; console.log(`FAIL ${id}: ${problems.length} problem(s)\n  - ` + problems.join('\n  - ')); }
  else console.log(`PASS ${id}: story path ok, ${cells} reachable cells, all triggers/NPC/pickups reachable`);
}
process.exit(failed ? 1 : 0);
