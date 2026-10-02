import fs from 'node:fs';
import path from 'node:path';
import { Room, Client } from '@colyseus/core';
import { RoomState, LobbyPlayer } from './schema';
import { World, Carry } from '../src/shared/sim/World';
import { GameMap, TiledMap } from '../src/shared/map';
import { LEVELS, FIRST_LEVEL } from '../src/shared/levels';
import { encodeSnapshot, MAX_PLAYERS, SNAP_HZ, TICK_HZ } from '../src/shared/protocol';
import type { PlayerInput } from '../src/shared/sim/types';

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
    for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)];
    if (!usedCodes.has(c)) { usedCodes.add(c); return c; }
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
  private levelCarry: Carry | undefined;

  override onCreate(options: { level?: string }) {
    const code = makeCode();
    this.roomId = code;
    this.setState(new RoomState());
    this.state.code = code;
    this.state.level = options?.level && LEVELS[options.level] ? options.level : FIRST_LEVEL;
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
      this.startLevel(this.state.level || FIRST_LEVEL);
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

  override onJoin(client: Client, options: { name?: string }) {
    const taken = new Set([...this.state.players.values()].map((p) => p.slot));
    let slot = 0;
    while (taken.has(slot)) slot++;
    const p = new LobbyPlayer();
    p.id = client.sessionId;
    p.name = String(options?.name ?? 'Игрок').trim().slice(0, 14) || 'Игрок';
    p.slot = slot;
    p.host = this.state.players.size === 0;
    this.state.players.set(client.sessionId, p);
    // joining a running game: drop in as a fresh employee
    if (this.world && this.state.phase === 'playing') {
      this.world.addPlayer(client.sessionId, p.name, slot);
      client.send('start', { level: this.world.mapId });
    }
  }

  override async onLeave(client: Client, consented: boolean) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    p.connected = false;
    const wp = this.world?.players.find((q) => q.id === client.sessionId);
    if (wp) { wp.connected = false; wp.input = { ...wp.input, fire: false, interact: false }; }
    try {
      if (consented) throw new Error('left');
      await this.allowReconnection(client, 25);
      p.connected = true;
      if (wp) wp.connected = true;
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
    usedCodes.delete(this.state.code);
    if (this.timer) clearTimeout(this.timer);
  }

  private startLevel(id: string) {
    const map = new GameMap(id, loadMap(id));
    this.levelCarry = this.carry;
    const world = new World(map, LEVELS[id], { solo: false, carry: this.carry });
    const players = [...this.state.players.values()].sort((a, b) => a.slot - b.slot);
    for (const p of players) world.addPlayer(p.id, p.name, p.slot);
    world.start();
    this.world = world;
    this.state.level = id;
    this.state.phase = 'playing';
    this.snapAcc = 0;
    this.broadcast('start', { level: id });
  }

  private toLobby() {
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
    w.step(Math.min(dtMs, 100) / 1000);
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
    const level = this.world!.mapId;
    this.state.phase = 'between';
    this.timer = setTimeout(() => {
      this.broadcast('end', { kind: 'gameover', reason, stats: this.stats() });
      // retry the same level with the loadout we had when it started
      this.timer = setTimeout(() => { this.carry = this.levelCarry; this.startLevel(level); }, 6000);
    }, 2000);
  }
}
