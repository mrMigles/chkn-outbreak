import fs from 'node:fs';
import path from 'node:path';
import type { RoomCheckpoint } from '../src/shared/sim/Checkpoint';
const DIR = path.resolve(process.env.CHKN_SAVE_DIR || 'data/rooms');
export const validRoomCode = (code: string) => /^[A-Z]{4}$/.test(code);
const file = (code: string) => { if (!validRoomCode(code)) throw new Error('Invalid room code'); return path.join(DIR, code + '.json'); };
export function readCheckpoint(code: string): RoomCheckpoint | undefined {
  try { const save = JSON.parse(fs.readFileSync(file(code), 'utf8')); return save.version === 1 && Array.isArray(save.frames) ? save : undefined; }
  catch { return undefined; }
}
export function writeCheckpoint(code: string, save: RoomCheckpoint) {
  fs.mkdirSync(DIR, { recursive: true });
  const target = file(code), temp = target + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(save)); fs.renameSync(temp, target);
}
export function clearCheckpoint(code: string) { fs.rmSync(file(code), { force: true }); }
