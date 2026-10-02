import fs from 'node:fs';
import path from 'node:path';
import { Room, Client } from '@colyseus/core';
import { RoomState, LobbyPlayer } from './schema';
import { World, Carry } from '../src/shared/sim/World';
import { GameMap, TiledMap } from '../src/shared/map';
import { LEVELS, FIRST_LEVEL } from '../src/shared/levels';
import { SnapshotEncoder, MAX_PLAYERS, SNAP_HZ, TICK_HZ } from '../src/shared/protocol';
import type { PlayerInput } from '../src/shared/sim/types';
import { decodeLook } from '../src/shared/look';
import { ACHIEVEMENTS, type AchievementKey } from '../src/shared/achievements';
import { isChatCode } from './telegram';
import { RoomRecording, type RoomCheckpoint } from '../src/shared/sim/Checkpoint';
import { clearCheckpoint, readCheckpoint, validRoomCode, writeCheckpoint, writeCheckpointText, writeCheckpointSync } from './checkpoints';
import { summonChat, shareToChat, roomChat } from './tgbot';

const MAPS_DIR = path.resolve(process.cwd(), 'public/assets/maps');
const mapCache = new Map<string, TiledMap>();
function loadMap(id: string): TiledMap {
  let m = mapCache.get(id);
  if (!m) { m = JSON.parse(fs.readFileSync(path.join(MAPS_DIR, id + '.tmj'), 'utf8')) as TiledMap; mapCache.set(id, m); }
  return m;
}
/** Seconds a dropped connection keeps its lobby entry (the world seat itself stays for the whole floor). */
const RECONNECT_S = Number(process.env.CHKN_RECONNECT_S || 25);
const SUMMON_COOLDOWN_MS = Number(process.env.CHKN_SUMMON_COOLDOWN_MS || 60000);

const usedCodes = new Set<string>();
function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) { const alphabet = i ? A : A.replace('T', ''); c += alphabet[Math.floor(Math.random() * alphabet.length)]; }
    if (!usedCodes.has(c) && !readCheckpoint(c)) { usedCodes.add(c); return c; }
  }
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const cleanName = (v: unknown) => String(v ?? 'Игрок').trim().slice(0, 14) || 'Игрок';
const cleanLook = (v: unknown) => (typeof v === 'string' && decodeLook(v) ? v : '');
type Stats = { name: string; kills: number; score: number; slot: number }[];
type Deferred = { reject: (e?: unknown) => void };

/** Rooms of this process by code (HTTP handlers ask them about lobbies). */
export const activeRooms = new Map<string, GameRoom>();

export class GameRoom extends Room<RoomState> {
  // D59: the 4-player limit is enforced in onJoin; Colyseus' own limit also counts seats held for
  // reconnection, which would lock out the very person reopening the page in a full room
  override maxClients = MAX_PLAYERS * 2;
  world: World | null = null;
  private snapAcc = 0;
  private timer: NodeJS.Timeout | null = null;
  private carry: Carry | undefined;
  /** loadouts by slot: whoever holds the seat when the next floor starts gets it (ids change on rejoin) */
  private carrySlots = new Map<number, Carry['players'][string]>();
  private recording: RoomRecording | null = null;
  private savedProgress: RoomCheckpoint | undefined;
  private entryCheckpoint: RoomCheckpoint | undefined;
  private saveAcc = 0;
  private encoder = new SnapshotEncoder();
  private firstLevel = FIRST_LEVEL;
  /** sessionId → persistent player id (browser profile or Telegram user) */
  private pids = new Map<string, string>();
  private joinOrder = new Map<string, number>();
  private joinSeq = 0;
  private waiting = new Map<string, Deferred>();
  private replaced = new Set<string>();
  /** pid → world slot of a seat whose owner dropped out mid-floor; it is theirs when they return */
  private reserved = new Map<string, number>();
  private lastSummon = -Infinity;
  private shared = new Set<string>();
  /** achievements per pid, kept after the world is gone (share after the final victory) */
  private earned = new Map<string, Set<string>>();

  override onCreate(options: { level?: string; code?: string; chat?: string }) {
    // Telegram chat rooms get their chat's fixed code (server/telegram.ts); ordinary rooms a random one
    const fixed = options?.code && validRoomCode(options.code) && (isChatCode(options.code) || readCheckpoint(options.code)) && !usedCodes.has(options.code) ? options.code : '';
    if (fixed) usedCodes.add(fixed);
    const code = fixed || makeCode();
    this.roomId = code;
    activeRooms.set(code, this);
    this.setState(new RoomState());
    this.state.code = code;
    // a chat room keeps its chat's title; an ordinary room restored from its save stays ordinary
    if (fixed && (isChatCode(code) || options.chat)) this.state.chat = String(options.chat || 'Чат').slice(0, 40);
    this.firstLevel = options?.level && LEVELS[options.level] ? options.level : FIRST_LEVEL;
    this.state.level = this.firstLevel;
    this.savedProgress = readCheckpoint(code);
    if (this.savedProgress) this.state.level = this.savedProgress.level;
    this.state.saved = this.savedProgress?.level ?? '';
    this.state.summon = isChatCode(code) && !!process.env.TELEGRAM_BOT_TOKEN;
    this.setPatchRate(100);

    this.onMessage('ready', (client, msg: { ready?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.ready = !!msg?.ready;
    });
    // D58: appearance and name can change in the lobby, everyone sees the new portrait
    this.onMessage('profile', (client, m: { name?: string; look?: string; ach?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (m?.name !== undefined) p.name = cleanName(m.name);
      if (m?.look !== undefined) p.look = cleanLook(m.look);
      if (m?.ach !== undefined) p.ach = Math.max(0, Math.min(99, Math.floor(num(m.ach))));
    });
    // D58: the host decides — continue the saved floor or start the campaign over. Readiness is a hint only.
    this.onMessage('start', (client, m: { fresh?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p?.host || this.state.phase !== 'lobby') return;
      this.carry = undefined;
      this.carrySlots.clear();
      if (m?.fresh || !this.savedProgress) {
        if (this.savedProgress) clearCheckpoint(this.state.code);
        this.savedProgress = undefined; this.state.saved = '';
        this.startLevel(this.firstLevel);
      } else this.startLevel(this.savedProgress.level, this.savedProgress);
    });
    this.onMessage('input', (client, m: Partial<PlayerInput>) => {
      if (!this.world || !m) return;
      this.world.setInput(client.sessionId, {
        seq: num(m.seq), x: num(m.x), y: num(m.y), aim: num(m.aim), fire: !!m.fire, reload: !!m.reload, interact: !!m.interact, weapon: Math.floor(num(m.weapon)),
      });
    });
    this.onMessage('lobby', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p?.host && (this.state.phase === 'over' || this.state.phase === 'defeat')) this.toLobby(this.state.phase === 'defeat');
    });
    this.onMessage('retry', (client) => {
      if (this.state.players.get(client.sessionId)?.host && this.state.phase === 'defeat') this.startLevel(this.state.level, this.savedProgress);
    });
    // D62: Telegram — call the chat into the lobby, tell the chat about a rare achievement
    this.onMessage('summon', async (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.state.summon) return;
      const wait = this.lastSummon + SUMMON_COOLDOWN_MS - Date.now();
      if (wait > 0) { client.send('summoned', { error: `Чат уже позвали — ещё раз через ${Math.ceil(wait / 1000)} с` }); return; }
      this.lastSummon = Date.now();
      const n = [...this.state.players.values()].filter(q => q.connected).length;
      const where = this.state.phase === 'lobby'
        ? (this.savedProgress ? `продолжаем: ${LEVELS[this.savedProgress.level]?.title ?? 'кампания'}` : 'начинаем с начала')
        : `бой уже идёт: ${LEVELS[this.state.level]?.title ?? ''} — можно подключиться`;
      const text = `📣 ${p.name} зовёт всех в «Курятник»! В комнате ${n}/${MAX_PLAYERS}, ${where}. Код комнаты ${this.state.code}.`;
      const r = await summonChat(this.state.code, text);
      if ('error' in r) this.lastSummon = -Infinity;
      client.send('summoned', r);
    });
    this.onMessage('share', async (client, m: { key?: string }) => {
      const key = String(m?.key ?? '') as AchievementKey;
      const a = ACHIEVEMENTS[key];
      const pid = this.pids.get(client.sessionId) ?? client.sessionId;
      const p = this.state.players.get(client.sessionId);
      const has = this.world?.players.find(q => q.id === client.sessionId)?.achievements?.includes(key) || this.earned.get(pid)?.has(key);
      if (!a || !('rare' in a) || !p || !has) { client.send('shared', { key, error: 'Это достижение нельзя отправить' }); return; }
      if (this.shared.has(pid + ':' + key)) { client.send('shared', { key, ok: true }); return; }
      this.shared.add(pid + ':' + key);
      const r = await shareToChat(this.state.code, `🏅 Редкое достижение! ${p.name} — ${a.icon} «${a.name}»: ${a.description}`);
      if ('error' in r) this.shared.delete(pid + ':' + key);
      client.send('shared', { key, ...r });
    });
    // QA helpers (only with --debug, i.e. npm run server)
    this.onMessage('debug', (client, m: { cmd?: string; level?: string }) => {
      if (!process.argv.includes('--debug') || !this.world) return;
      const p = this.world.players.find((q) => q.id === client.sessionId);
      if (!p) return;
      // QA god mode must not block the scripted wounds
      const wound = () => { const god = this.world!.god; this.world!.god = false; this.world!.damagePlayer(p, 999, p.x + 10, p.y); this.world!.god = god; };
      if (m?.cmd === 'down') wound();
      if (m?.cmd === 'bleed') p.downT = 0.1;
      if (m?.cmd === 'god') this.world.god = true;
      if (m?.cmd === 'give' && m.level) this.world.giveWeapon(p, m.level as never, true);
      if (m?.cmd === 'tp' && m.level) { const [x, y] = m.level.split(',').map(Number); p.x = p.input.x = x; p.y = p.input.y = y; p.tp++; }
      if (m?.cmd === 'dead') { wound(); p.downT = 0.01; }
      if (m?.cmd === 'award') this.world.award((m.level ?? 'combo_master') as AchievementKey, p.id);
      if (m?.cmd === 'finish') this.world.emit({ e: 'level', next: LEVELS[this.world.mapId]?.next ?? '', win: !LEVELS[this.world.mapId]?.next });
    });
    this.setSimulationInterval((dt) => this.tick(dt), 1000 / TICK_HZ);
  }

  override onJoin(client: Client, options: { name?: string; look?: string; pid?: string; ach?: number }) {
    const pid = typeof options?.pid === 'string' && /^[\w-]{8,64}$/.test(options.pid) ? options.pid : 'anon-' + client.sessionId;
    const name = cleanName(options?.name);
    // D59: the same person again (reopened tab, a phone after the laptop, the browser after Telegram):
    // they take over their own seat; the old connection is told and closed
    let slot = -1, order = -1;
    for (const [sid, other] of [...this.pids]) {
      if (other !== pid || sid === client.sessionId) continue;
      const old = this.state.players.get(sid);
      if (old) { slot = old.slot; order = this.joinOrder.get(sid) ?? -1; }
      this.takeOver(sid);
    }
    const members = [...this.state.players.values()];
    if (members.length >= MAX_PLAYERS) throw new Error('Комната заполнена');
    const taken = new Set(members.map((p) => p.slot));
    if (slot < 0 && this.reserved.has(pid) && !taken.has(this.reserved.get(pid)!)) slot = this.reserved.get(pid)!;
    if (slot < 0) {
      // after a server restart: the seat this person had in the saved floor
      const saved = this.savedProgress;
      const bySaved = saved?.pids ? Object.entries(saved.pids).find(([s, q]) => q === pid && !taken.has(+s)) : undefined;
      if (bySaved) slot = +bySaved[0];
      else {
        const seat = saved?.seats?.find(p => p.name === name && !taken.has(p.slot) && !saved.pids?.[p.slot]);
        if (seat) slot = seat.slot;
      }
    }
    if (slot < 0) {
      // first free slot, preferring ones nobody else is coming back to
      const held = new Set([...this.reserved.values()]);
      for (let s = 0; s < MAX_PLAYERS && slot < 0; s++) if (!taken.has(s) && !held.has(s)) slot = s;
      for (let s = 0; slot < 0; s++) if (!taken.has(s)) slot = s;
    }
    for (const [q, s] of [...this.reserved]) if (s === slot) this.reserved.delete(q);
    this.pids.set(client.sessionId, pid);
    this.joinOrder.set(client.sessionId, order >= 0 ? order : ++this.joinSeq);
    const p = new LobbyPlayer();
    p.id = client.sessionId;
    p.name = name;
    p.slot = slot;
    p.look = cleanLook(options?.look);
    p.ach = Math.max(0, Math.min(99, Math.floor(num(options?.ach))));
    this.state.players.set(client.sessionId, p);
    this.ensureHost();
    // joining a running floor: take back your own seat, or drop in as a fresh employee (D59)
    if (this.world && (this.state.phase === 'playing' || this.state.phase === 'between' || this.state.phase === 'defeat')) {
      if (this.world.players.some(q => q.slot === slot) && this.recording) {
        this.recording.resume(this.roster(), false);
      } else if (this.state.phase === 'playing') this.world.addPlayer(client.sessionId, p.name, slot, p.look);
      this.encoder.keyframe();
      if (this.state.phase === 'playing') client.send('start', { level: this.world.mapId });
    }
  }

  /** The person opened the game somewhere else: close the old connection, the new one gets the seat. */
  private takeOver(sid: string) {
    this.replaced.add(sid);
    this.state.players.delete(sid);
    this.pids.delete(sid);
    this.joinOrder.delete(sid);
    this.waiting.get(sid)?.reject(new Error('replaced'));
    this.waiting.delete(sid);
    const c = this.clients.find(q => q.sessionId === sid);
    if (c) { c.send('replaced', {}); setTimeout(() => c.leave(4001), 50); }
  }

  /** The host is the earliest-joined connected player; leadership moves when they leave or drop. */
  private ensureHost() {
    const list = [...this.state.players.values()];
    const current = list.find(p => p.host && p.connected);
    const next = current ?? list.filter(p => p.connected).sort((a, b) => (this.joinOrder.get(a.id) ?? 0) - (this.joinOrder.get(b.id) ?? 0))[0];
    for (const p of list) p.host = p === next;
  }

  private roster() {
    return [...this.state.players.values()].map(q => ({ id: q.id, name: q.name, slot: q.slot, look: q.look, connected: q.connected }));
  }

  override async onLeave(client: Client, consented: boolean) {
    if (this.replaced.delete(client.sessionId)) return;
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    p.connected = false;
    p.ready = false;
    const wp = this.world?.players.find((q) => q.id === client.sessionId);
    if (wp) { wp.connected = false; this.world?.resetInput(wp.id); }
    this.ensureHost();
    try {
      if (consented) throw new Error('left');
      const wait = this.allowReconnection(client, RECONNECT_S);
      this.waiting.set(client.sessionId, wait as unknown as Deferred);
      await wait;
      this.waiting.delete(client.sessionId);
      p.connected = true;
      // A level can change while the client is offline; do not update an old world.
      const restored = this.world?.players.find((q) => q.id === client.sessionId);
      if (restored) restored.connected = true;
      this.ensureHost();
      this.encoder.keyframe();
      if (this.world && this.state.phase === 'playing') client.send('start', { level: this.world.mapId });
    } catch {
      this.waiting.delete(client.sessionId);
      if (this.replaced.delete(client.sessionId)) return; // taken over by the same person's new connection
      const pid = this.pids.get(client.sessionId);
      this.state.players.delete(client.sessionId);
      this.pids.delete(client.sessionId);
      this.joinOrder.delete(client.sessionId);
      // D59: a closed tab keeps its seat in the running floor; «Выйти» gives it up
      const keep = !consented && this.world && wp && this.state.phase !== 'lobby' && this.state.phase !== 'over';
      if (keep && pid) this.reserved.set(pid, p.slot);
      else this.world?.removePlayer(client.sessionId);
      this.ensureHost();
    }
  }

  override onDispose() {
    this.saveProgress(true);
    usedCodes.delete(this.state.code);
    if (activeRooms.get(this.state.code) === this) activeRooms.delete(this.state.code);
    if (this.timer) clearTimeout(this.timer);
  }

  /** Lobby summary for HTTP callers (Telegram chat entry, resume). */
  info() {
    return { code: this.state.code, phase: this.state.phase, level: this.state.level, saved: this.state.saved, players: [...this.state.players.values()].filter(p => p.connected).length, chat: !!roomChat(this.state.code) };
  }

  private startLevel(id: string, checkpoint?: RoomCheckpoint) {
    const map = new GameMap(id, loadMap(id));
    let world: World;
    const players = [...this.state.players.values()].sort((a, b) => a.slot - b.slot);
    if (checkpoint) {
      this.recording = RoomRecording.restore(loadMap(id), checkpoint);
      world = this.recording.world;
      this.recording.resume(players.map(p => ({ id: p.id, name: p.name, slot: p.slot, look: p.look, connected: p.connected })));
    } else {
      if (this.carry) this.carry = { ...this.carry, players: Object.fromEntries(players.filter(p => this.carrySlots.has(p.slot)).map(p => [p.id, this.carrySlots.get(p.slot)!])) };
      world = new World(map, LEVELS[id], { solo: false, carry: this.carry });
      for (const p of players) world.addPlayer(p.id, p.name, p.slot, p.look).connected = p.connected;
      world.start(); this.recording = new RoomRecording(world);
      this.reserved.clear();
    }
    this.world = world;
    const entry = RoomRecording.restore(loadMap(id), { ...this.recording!.data, frames: [] });
    entry.resume(players.map(p => ({ id: p.id, name: p.name, slot: p.slot, look: p.look, connected: p.connected })), false);
    this.entryCheckpoint = entry.checkpoint();
    this.entryCheckpoint.pids = this.seatPids();
    this.state.level = id;
    this.state.reason = '';
    this.state.phase = 'playing';
    this.snapAcc = 0;
    this.saveAcc = 0;
    this.encoder = new SnapshotEncoder();
    this.saveProgress();
    this.broadcast('start', { level: id });
  }

  private seatPids() {
    const out: Record<number, string> = { ...(this.savedProgress?.pids ?? {}) };
    for (const [pid, slot] of this.reserved) out[slot] = pid;
    for (const p of this.state.players.values()) { const pid = this.pids.get(p.id); if (pid) out[p.slot] = pid; }
    // connections without a player id (old clients, bots) fall back to name matching after a restart
    for (const [slot, pid] of Object.entries(out)) if (pid.startsWith('anon-')) delete out[+slot];
    return out;
  }

  private toLobby(keepSave = false) {
    if (!keepSave) { clearCheckpoint(this.state.code); this.savedProgress = undefined; }
    this.recording = null;
    this.world = null;
    this.reserved.clear();
    this.state.phase = 'lobby';
    this.state.level = this.savedProgress?.level ?? this.firstLevel;
    this.state.saved = this.savedProgress?.level ?? '';
    for (const p of this.state.players.values()) p.ready = false;
    this.broadcast('lobby', {});
  }

  private stats(): Stats {
    return (this.world?.players ?? []).map((p) => ({ name: p.name, kills: p.kills, score: Math.floor(p.score), slot: p.slot }));
  }

  private tick(dtMs: number) {
    const w = this.world;
    if (!w || (this.state.phase !== 'playing' && this.state.phase !== 'between')) return;
    if (!w.players.some(p => p.connected)) return;
    if (this.state.phase === 'playing' && this.recording) this.recording.step(Math.min(dtMs, 100) / 1000);
    else w.step(Math.min(dtMs, 100) / 1000);
    this.saveAcc += dtMs;
    if (this.saveAcc >= 5000) { this.saveAcc = 0; this.saveProgress(); }
    if (w.events.length) {
      const ev = w.events;
      w.events = [];
      this.broadcast('ev', ev);
      for (const e of ev) if (e.e === 'achievement') {
        const pid = this.pids.get(e.id) ?? e.id;
        if (!this.earned.has(pid)) this.earned.set(pid, new Set());
        this.earned.get(pid)!.add(e.key);
      }
      if (this.state.phase === 'playing') for (const e of ev) {
        if (e.e === 'level') this.onLevelEnd(e.next, !!e.win);
        if (e.e === 'gameover') this.onGameOver(e.reason);
      }
    }
    this.snapAcc += dtMs;
    if (this.snapAcc >= 1000 / SNAP_HZ) {
      this.snapAcc = 0;
      this.broadcast('snap', this.encoder.encode(w));
    }
  }

  private onLevelEnd(next: string, win: boolean) {
    const w = this.world!;
    this.carry = w.carryOut();
    this.carrySlots = new Map(w.players.filter(p => this.carry!.players[p.id]).map(p => [p.slot, this.carry!.players[p.id]]));
    this.state.phase = 'between';
    if (next && LEVELS[next] && !win) {
      const preview = new World(new GameMap(next, loadMap(next)), LEVELS[next], { solo: false, carry: this.carry });
      for (const p of this.state.players.values()) preview.addPlayer(p.id, p.name, p.slot, p.look).connected = p.connected;
      preview.start(); this.savedProgress = new RoomRecording(preview).checkpoint();
      this.savedProgress.chat = this.state.chat; this.savedProgress.pids = this.seatPids();
      writeCheckpoint(this.state.code, this.savedProgress);
      this.state.saved = next;
    } else { clearCheckpoint(this.state.code); this.savedProgress = undefined; this.state.saved = ''; }
    this.timer = setTimeout(() => {
      const stats = this.stats();
      if (win || !next || !LEVELS[next]) {
        this.state.phase = 'over';
        this.broadcast('end', { kind: 'win', stats });
        this.world = null;
      } else {
        this.broadcast('end', { kind: 'level', next, stats });
        this.timer = setTimeout(() => this.startLevel(next), 5000);
      }
    }, 2000);
  }

  private onGameOver(reason: string) {
    this.state.phase = 'defeat';
    this.state.reason = reason;
    this.savedProgress = this.entryCheckpoint;
    if (this.savedProgress) { this.savedProgress.chat = this.state.chat; writeCheckpoint(this.state.code, this.savedProgress); }
    this.state.saved = this.savedProgress?.level ?? '';
    this.broadcast('end', { kind: 'gameover', reason, stats: this.stats() });
  }

  private saveProgress(sync = false) {
    if (this.recording && this.state.phase === 'playing' && !this.world?.finished) {
      const extra = { chat: this.state.chat, pids: this.seatPids() };
      // the in-memory copy stays light: frames are only referenced, the text is built incrementally
      this.savedProgress = { ...this.recording.checkpoint(), ...extra };
      this.state.saved = this.savedProgress.level;
      try {
        const text = this.recording.serialize(extra);
        if (sync) writeCheckpointSync(this.state.code, text); else writeCheckpointText(this.state.code, text);
      } catch (e) { console.error('Room checkpoint failed:', e); }
    }
  }
}
