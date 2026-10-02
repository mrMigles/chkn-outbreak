// Local "continue" records for the main menu (D55). Solo keeps the floor and its entry loadout;
// rooms are saved by the server, the client only remembers the last code and floor for the caption.
import type { Carry } from '../shared/sim/World';
import { LEVELS, FIRST_LEVEL } from '../shared/levels';

export interface SoloSave { level: string; carry?: Carry; at: number }
export interface RoomSave { code: string; level?: string }

const SOLO = 'chkn-solo-save', ROOM = 'chkn-last-room', ROOM_LEVEL = 'chkn-last-room-level';

export function loadSolo(): SoloSave | null {
  try {
    const s = JSON.parse(localStorage.getItem(SOLO) || 'null') as SoloSave | null;
    return s && LEVELS[s.level] && s.level !== 'arena' ? s : null;
  } catch { return null; }
}
export function saveSolo(level: string, carry?: Carry) {
  if (level === 'arena' || !LEVELS[level]) return;
  try { localStorage.setItem(SOLO, JSON.stringify({ level, carry, at: Date.now() })); } catch { /* storage unavailable */ }
}
export function clearSolo() { try { localStorage.removeItem(SOLO); } catch { /* ignore */ } }

export function loadRoom(): RoomSave | null {
  try {
    const code = localStorage.getItem(ROOM);
    if (!code) return null;
    const level = localStorage.getItem(ROOM_LEVEL) || undefined;
    return { code, level: level && LEVELS[level] ? level : undefined };
  } catch { return null; }
}
export function saveRoom(code: string, level?: string) {
  try {
    if (localStorage.getItem(ROOM) !== code) localStorage.removeItem(ROOM_LEVEL);
    localStorage.setItem(ROOM, code);
    if (level) localStorage.setItem(ROOM_LEVEL, level);
  } catch { /* ignore */ }
}

/** «Этап 2/5 · Этаж 7. …» caption for a level id (campaign order follows `next`). */
export function levelCaption(id?: string) {
  const lvl = id ? LEVELS[id] : undefined;
  if (!lvl) return '';
  const order: string[] = [];
  for (let l: string | undefined = FIRST_LEVEL; l && LEVELS[l] && !order.includes(l); l = LEVELS[l].next) order.push(l);
  const i = order.indexOf(lvl.id);
  return (i >= 0 ? `Этап ${i + 1}/${order.length} · ` : '') + lvl.title;
}
