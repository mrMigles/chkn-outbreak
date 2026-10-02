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

// D59: the room this browser is playing in. A closed tab or a crash comes back to it on the next start;
// only «Выйти» forgets it. Six hours later it is stale.
const ACTIVE = 'chkn-active-room';
export function setActiveRoom(code: string) { try { localStorage.setItem(ACTIVE, JSON.stringify({ code, at: Date.now() })); } catch { /* ignore */ } }
export function clearActiveRoom() { try { localStorage.removeItem(ACTIVE); } catch { /* ignore */ } }
export function activeRoom(): string | null {
  try {
    const a = JSON.parse(localStorage.getItem(ACTIVE) || 'null') as { code?: string; at?: number } | null;
    return a?.code && /^[A-Z]{4}$/.test(a.code) && Date.now() - (a.at ?? 0) < 6 * 3600e3 ? a.code : null;
  } catch { return null; }
}

/** Persistent player id of this browser profile: the server gives the same seat back to it (D59). */
export function browserPid() {
  try {
    let id = localStorage.getItem('chkn-pid');
    if (!id || !/^[\w-]{8,64}$/.test(id)) {
      const b = new Uint8Array(12); crypto.getRandomValues(b);
      id = 'b-' + [...b].map((x) => x.toString(36).padStart(2, '0')).join('');
      localStorage.setItem('chkn-pid', id);
    }
    return id;
  } catch { return 'b-' + Math.random().toString(36).slice(2, 14); }
}
