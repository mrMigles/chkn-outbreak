import fs from 'node:fs';
import path from 'node:path';
import type { RoomCheckpoint } from '../src/shared/sim/Checkpoint';
export const SAVE_DIR = path.resolve(process.env.CHKN_SAVE_DIR || 'data/rooms');
const DIR = SAVE_DIR;
export const validRoomCode = (code: string) => /^[A-Z]{4}$/.test(code);
const file = (code: string) => { if (!validRoomCode(code)) throw new Error('Invalid room code'); return path.join(DIR, code + '.json'); };
export function readCheckpoint(code: string): RoomCheckpoint | undefined {
  try {
    const save = JSON.parse(fs.readFileSync(file(code), 'utf8'));
    // Old input tapes used different movement/story rules: retain the room and entry loadout,
    // but start its current floor instead of replaying incompatible combat.
    if ((save.version === 1 || save.version === 2) && Array.isArray(save.frames)) return { ...save, version: 3, frames: [] };
    return save.version === 3 && Array.isArray(save.frames) ? save : undefined;
  }
  catch { return undefined; }
}

// D59: saves are written off the event loop (a long floor's input tape is megabytes; a synchronous write
// every five seconds stalled every room on the server). One queue per room: the newest operation wins,
// so a clear can never be overwritten by an older save still in flight. null = delete.
type Op = string | null;
const queues = new Map<string, { busy: boolean; next?: Op; gen?: number }>();
const gens = new Map<string, number>();
function enqueue(code: string, op: Op) {
  const target = file(code);
  let q = queues.get(code);
  if (!q) { q = { busy: false }; queues.set(code, q); }
  q.next = op;
  if (q.busy) return;
  q.busy = true;
  void (async () => {
    try {
      while (q.next !== undefined) {
        const t = q.next; q.next = undefined;
        if (t === null) { await fs.promises.rm(target, { force: true }); continue; }
        await fs.promises.mkdir(DIR, { recursive: true });
        const gen = gens.get(code) ?? 0;
        await fs.promises.writeFile(target + '.tmp', t);
        if ((gens.get(code) ?? 0) === gen) await fs.promises.rename(target + '.tmp', target); // a synchronous save came later
      }
    } catch (e) { console.error('Room checkpoint failed:', e); }
    finally { q.busy = false; if (q.next === undefined) queues.delete(code); }
  })();
}
export function writeCheckpoint(code: string, save: RoomCheckpoint) { enqueue(code, JSON.stringify(save)); }
export function writeCheckpointText(code: string, text: string) { enqueue(code, text); }
export function clearCheckpoint(code: string) { enqueue(code, null); }
/** Process exit / room disposal: must land before the process goes away. */
export function writeCheckpointSync(code: string, text: string) {
  const q = queues.get(code);
  if (q) q.next = undefined;
  gens.set(code, (gens.get(code) ?? 0) + 1);
  fs.mkdirSync(DIR, { recursive: true });
  const target = file(code);
  fs.writeFileSync(target + '.sync.tmp', text); fs.renameSync(target + '.sync.tmp', target);
}
/** Writes still queued (tests wait for them before reading files). */
export const pendingWrites = () => queues.size;
