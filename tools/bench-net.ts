// D59: snapshot traffic (full vs delta, msgpack bytes) and room-save cost on a long floor.
//   npm run bench:net -- office7 10   (level, simulated minutes)
import fs from 'node:fs';
import { World } from '../src/shared/sim/World';
import { GameMap } from '../src/shared/map';
import { LEVELS } from '../src/shared/levels';
import { RoomRecording } from '../src/shared/sim/Checkpoint';
import { encodeSnapshot, SnapshotEncoder } from '../src/shared/protocol';
import { pack } from '@colyseus/msgpackr';
const id = process.argv[2] ?? 'office7', minutes = Number(process.argv[3] ?? 10);
const json = JSON.parse(fs.readFileSync(`public/assets/maps/${id}.tmj`, 'utf8'));
const w = new World(new GameMap(id, json), LEVELS[id], { solo: false });
w.addPlayer('a', 'Аня', 0, 'f.1.bob.c2452d.blouse.6d8b4e.skirt.3b4f7a.glasses'); w.addPlayer('b', 'Боря', 1); w.god = true;
w.start();
const rec = new RoomRecording(w), enc = new SnapshotEncoder();
let full = 0, delta = 0, n = 0, oldSave = 0, newSave = 0, saves = 0;
for (let i = 0; i < 30 * 60 * minutes; i++) {
  for (const p of w.players) w.setInput(p.id, { seq: i, x: p.x + Math.cos(i / 40) * 6, y: p.y + Math.sin(i / 50) * 6, aim: i / 10, fire: true, reload: false, interact: i % 60 < 3, weapon: 0 });
  rec.step(1 / 30); w.events = [];
  if (i % 2 === 0 && i > 30 * 60) { full += pack(encodeSnapshot(w)).length; delta += pack(enc.encode(w)).length; n++; }
  if (i % 150 === 0 && i > 30 * 60 * (minutes - 1)) {
    let t = performance.now(); JSON.stringify(rec.checkpoint()); oldSave += performance.now() - t;
    t = performance.now(); rec.serialize(); newSave += performance.now() - t; saves++;
  } else if (i % 150 === 0) rec.serialize();
}
console.log({ level: id, enemies: w.enemies.length, minutes, snapFullBytes: Math.round(full / n), snapDeltaBytes: Math.round(delta / n), kbpsFull: Math.round(full / n * 20 * 8 / 1000), kbpsDelta: Math.round(delta / n * 20 * 8 / 1000), saveOldMs: (oldSave / saves).toFixed(1), saveNewMs: (newSave / saves).toFixed(1) });
