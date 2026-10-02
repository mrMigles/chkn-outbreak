import fs from 'node:fs';
import path from 'node:path';
import { Room, Client } from '@colyseus/core';
import { RoomState, LobbyPlayer } from './schema';
import { World, Carry } from '../src/shared/sim/World';
import { GameMap, TiledMap } from '../src/shared/map';
import { LEVELS, FIRST_LEVEL } from '../src/shared/levels';
import { encodeSnapshot, MAX_PLAYERS, SNAP_HZ, TICK_HZ } from '../src/shared/protocol';
import type { PlayerInput } from '../src/shared/sim/types';
import { decodeLook } from '../src/shared/look';
import { isChatCode } from './telegram';
import { RoomRecording, type RoomCheckpoint } from '../src/shared/sim/Checkpoint';
import { clearCheckpoint, readCheckpoint, validRoomCode, writeCheckpoint } from './checkpoints';

const MAPS_DIR = path.resolve(process.cwd(), 'public/assets/maps');
const mapCache = new Map<string, TiledMap>();
function loadMap(id: string): TiledMap {
  let m = mapCache.get(id);
  if (!m) { m = JSON.parse(fs.readFileSync(path.join(MAPS_DIR, id + '.tmj'), 'utf8')) as TiledMap; mapCache.set(id, m); }
  return m;
}

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
type Stats = { name: string; kills: number; score: number; slot: number }[];

export class GameRoom extends Room<RoomState> {
  override maxClients = MAX_PLAYERS;
  world: World | null = null;
  private snapAcc = 0;
  private timer: NodeJS.Timeout | null = null;
  private carry: Carry | undefined;
  private recording: RoomRecording | null = null;
  private savedProgress: RoomCheckpoint | undefined;
  private entryCheckpoint: RoomCheckpoint | undefined;
  private saveAcc = 0;

  override onCreate(options: { level?: string; code?: string; chat?: string }) {
    // Telegram chat rooms get their chat's fixed code (server/telegram.ts); ordinary rooms a random one
    const fixed = options?.code && validRoomCode(options.code) && (isChatCode(options.code) || readCheckpoint(options.code)) && !usedCodes.has(options.code) ? options.code : '';
    if (fixed) usedCodes.add(fixed);
    const code = fixed || makeCode();
    this.roomId = code;
    this.setState(new RoomState());
    this.state.code = code;
    if (fixed) this.state.chat = String(options.chat ?? 'Чат').slice(0, 40) || 'Чат';
    this.state.level = options?.level && LEVELS[options.level] ? options.level : FIRST_LEVEL;
    this.savedProgress = readCheckpoint(code);
    if (this.savedProgress) this.state.level = this.savedProgress.level;
    this.setPatchRate(100);

    this.onMessage('ready', (client, msg: { ready?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.ready = !!msg?.ready;
    });
    this.onMessage('start', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p?.host || this.state.phase !== 'lobby') return;
      const all = [...this.state.players.values()].filter((q) => q.connected);
      if (!all.every((q) => q.ready || q.host)) return;
      this.carry = undefined;
      this.startLevel(this.state.level || FIRST_LEVEL, this.savedProgress);
    });
    this.onMessage('input', (client, m: Partial<PlayerInput>) => {
      if (!this.world || !m) return;
      this.world.setInput(client.sessionId, {
        seq: num(m.seq), x: num(m.x), y: num(m.y), aim: num(m.aim), fire: !!m.fire, reload: !!m.reload, interact: !!m.interact, weapon: Math.floor(num(m.weapon)),
      });
    });
    this.onMessage('lobby', (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p?.host && this.state.phase === 'over') this.toLobby();
    });
    this.onMessage('retry', (client) => {
      if (this.state.players.get(client.sessionId)?.host && this.state.phase === 'defeat') this.startLevel(this.state.level, this.savedProgress);
    });
    // QA helpers (only with --debug, i.e. npm run server)
    this.onMessage('debug', (client, m: { cmd?: string }) => {
      if (!process.argv.includes('--debug') || !this.world) return;
      const p = this.world.players.find((q) => q.id === client.sessionId);
      if (!p) return;
      if (m?.cmd === 'down') this.world.damagePlayer(p, 999, p.x + 10, p.y);
      if (m?.cmd === 'bleed') p.downT = 0.1;
    });
    this.setSimulationInterval((dt) => this.tick(dt), 1000 / TICK_HZ);
  }

  override onJoin(client: Client, options: { name?: string; look?: string }) {
    const taken = new Set([...this.state.players.values()].map((p) => p.slot));
    let slot = 0;
    while (taken.has(slot)) slot++;
    const savedSeat = this.savedProgress?.seats?.find(p => p.name === String(options?.name ?? 'Игрок').trim().slice(0, 14) && !taken.has(p.slot));
    if (savedSeat) slot = savedSeat.slot;
    const p = new LobbyPlayer();
    p.id = client.sessionId;
    p.name = String(options?.name ?? 'Игрок').trim().slice(0, 14) || 'Игрок';
    p.slot = slot;
    p.look = typeof options?.look === 'string' && decodeLook(options.look) ? options.look : '';
    p.host = this.state.players.size === 0;
    this.state.players.set(client.sessionId, p);
    // joining a running game: drop in as a fresh employee
    if (this.world && this.state.phase === 'playing') {
      if (this.world.players.some(q => q.slot === slot && !q.connected) && this.recording) {
        this.recording.resume([...this.state.players.values()].map(q => ({ id: q.id, name: q.name, slot: q.slot, look: q.look, connected: q.connected })), false);
      } else this.world.addPlayer(client.sessionId, p.name, slot, p.look);
      client.send('start', { level: this.world.mapId });
    }
  }

  override async onLeave(client: Client, consented: boolean) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    p.connected = false;
    const wp = this.world?.players.find((q) => q.id === client.sessionId);
    if (wp) { wp.connected = false; this.world?.resetInput(wp.id); }
    try {
      if (consented) throw new Error('left');
      await this.allowReconnection(client, 25);
      p.connected = true;
      // A level can change while the client is offline; do not update an old world.
      const restored = this.world?.players.find((q) => q.id === client.sessionId);
      if (restored) restored.connected = true;
      if (this.world && this.state.phase === 'playing') client.send('start', { level: this.world.mapId });
    } catch {
      this.state.players.delete(client.sessionId);
      this.world?.removePlayer(client.sessionId);
      if (p.host) {
        const next = [...this.state.players.values()][0];
        if (next) next.host = true;
      }
    }
  }

  override onDispose() {
    this.saveProgress();
    usedCodes.delete(this.state.code);
    if (this.timer) clearTimeout(this.timer);
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
      world = new World(map, LEVELS[id], { solo: false, carry: this.carry });
      for (const p of players) world.addPlayer(p.id, p.name, p.slot, p.look).connected = p.connected;
      world.start(); this.recording = new RoomRecording(world);
    }
    this.world = world;
    const entry = RoomRecording.restore(loadMap(id), { ...this.recording!.data, frames: [] });
    entry.resume(players.map(p => ({ id: p.id, name: p.name, slot: p.slot, look: p.look, connected: p.connected })), false);
    this.entryCheckpoint = entry.checkpoint();
    this.state.level = id;
    this.state.reason = '';
    this.state.phase = 'playing';
    this.snapAcc = 0;
    this.saveAcc = 0;
    this.saveProgress();
    this.broadcast('start', { level: id });
  }

  private toLobby() {
    clearCheckpoint(this.state.code); this.savedProgress = undefined; this.recording = null;
    this.world = null;
    this.state.phase = 'lobby';
    this.state.level = FIRST_LEVEL;
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
      if (this.state.phase === 'playing') for (const e of ev) {
        if (e.e === 'level') this.onLevelEnd(e.next, !!e.win);
        if (e.e === 'gameover') this.onGameOver(e.reason);
      }
    }
    this.snapAcc += dtMs;
    if (this.snapAcc >= 1000 / SNAP_HZ) {
      this.snapAcc = 0;
      this.broadcast('snap', encodeSnapshot(w));
    }
  }

  private onLevelEnd(next: string, win: boolean) {
    const w = this.world!;
    this.carry = w.carryOut();
    this.state.phase = 'between';
    if (next && LEVELS[next] && !win) {
      const preview = new World(new GameMap(next, loadMap(next)), LEVELS[next], { solo: false, carry: this.carry });
      for (const p of this.state.players.values()) preview.addPlayer(p.id, p.name, p.slot, p.look).connected = p.connected;
      preview.start(); this.savedProgress = new RoomRecording(preview).checkpoint();
      this.savedProgress.chat = this.state.chat; writeCheckpoint(this.state.code, this.savedProgress);
    } else { clearCheckpoint(this.state.code); this.savedProgress = undefined; }
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
    this.broadcast('end', { kind: 'gameover', reason, stats: this.stats() });
  }
  private saveProgress() {
    if (this.recording && this.state.phase === 'playing' && !this.world?.finished) {
      this.savedProgress = this.recording.checkpoint(); this.savedProgress.chat = this.state.chat;
      try { writeCheckpoint(this.state.code, this.savedProgress); } catch (e) { console.error('Room checkpoint failed:', e); }
    }
  }
}
