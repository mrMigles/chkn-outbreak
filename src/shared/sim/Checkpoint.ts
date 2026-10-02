// Deterministic room checkpoints replay authoritative inputs, rebuilding even pending callback timers.
// No function serialization, client-supplied saves or approximation of story flags.
import { World, type Carry } from './World';
import { GameMap, type TiledMap } from '../map';
import { LEVELS } from '../levels';
import type { PlayerInput } from './types';

type Member = { id: string; name: string; slot: number; look: string; connected: boolean };
type Input = [string, number, number, number, number, number];
type Frame = [number, Input[]?, Member[]?, [Member[], boolean]?];
export interface RoomCheckpoint {
  version: 2; level: string; seed: number; carry?: Carry; difficulty?: number;
  members: Member[]; frames: Frame[]; chat?: string; updated?: string;
  seats?: Member[];
}
const members = (w: World): Member[] => w.players.map(p => ({ id: p.id, name: p.name, slot: p.slot, look: p.look, connected: p.connected }));
const compact = (id: string, p: PlayerInput): Input => [id, p.x, p.y, p.aim, Number(p.fire) | (Number(p.reload) << 1) | (Number(p.interact) << 2), p.weapon];

export class RoomRecording {
  data: RoomCheckpoint;
  private lastInputs = new Map<string, string>();
  private lastMembers: string;
  safeLength = 0;
  constructor(public world: World, previous?: RoomCheckpoint) {
    this.data = previous ?? { version: 2, level: world.mapId, seed: world.opts.seed!, carry: world.opts.carry, difficulty: world.opts.difficulty, members: members(world), frames: [] };
    this.lastMembers = JSON.stringify(members(world));
    this.safeLength = this.data.frames.length;
  }
  step(dt: number) {
    const roster = members(this.world), rosterKey = JSON.stringify(roster);
    const changed: Input[] = [];
    for (const p of this.world.players) {
      const input = compact(p.id, p.input), key = JSON.stringify(input);
      if (this.lastInputs.get(p.id) !== key) { changed.push(input); this.lastInputs.set(p.id, key); }
    }
    this.data.frames.push([dt, changed.length ? changed : undefined, rosterKey !== this.lastMembers ? roster : undefined]);
    this.lastMembers = rosterKey;
    this.world.step(dt);
    // Preserve progress until the last living teammate: a team wipe never overwrites the recoverable point.
    if (!this.world.over && !this.world.finished && this.world.players.some(p => p.connected && p.state === 'alive')) this.safeLength = this.data.frames.length;
  }
  checkpoint(): RoomCheckpoint {
    return { ...this.data, frames: this.data.frames.slice(0, this.safeLength), seats: members(this.world), updated: new Date().toISOString() };
  }
  /** Restored seats retain their loadout, keys, companions and exact position under new connection ids. */
  resume(roster: Member[], heal = true) {
    this.data.frames.push([0, undefined, undefined, [roster, heal]]);
    restoreSeats(this.world, roster, heal);
    this.safeLength = this.data.frames.length;
  }
  static restore(map: TiledMap, save: RoomCheckpoint) {
    if (save.version !== 2 || !LEVELS[save.level]) throw new Error('Unsupported room checkpoint');
    const world = new World(new GameMap(save.level, map), LEVELS[save.level], { solo: false, seed: save.seed, carry: save.carry, difficulty: save.difficulty });
    const sync = (roster: Member[]) => {
      for (const p of [...world.players]) if (!roster.some(q => q.id === p.id)) world.removePlayer(p.id);
      for (const m of roster) {
        const p = world.players.find(p => p.id === m.id) ?? world.addPlayer(m.id, m.name, m.slot, m.look);
        if (p.connected && !m.connected) world.resetInput(p.id);
        p.connected = m.connected;
      }
    };
    sync(save.members); world.start(); world.events = [];
    for (const [dt, inputs, roster, recovery] of save.frames) {
      if (recovery) { restoreSeats(world, recovery[0], recovery[1]); continue; }
      if (roster) sync(roster);
      for (const [id, x, y, aim, flags, weapon] of inputs ?? []) world.setInput(id, { seq: 0, x, y, aim, fire: !!(flags & 1), reload: !!(flags & 2), interact: !!(flags & 4), weapon });
      world.step(dt); world.events = [];
    }
    world.over = false;
    return new RoomRecording(world, { ...save, frames: [...save.frames] });
  }
}
function restoreSeats(world: World, roster: Member[], heal: boolean) {
  for (const p of world.players) p.connected = false;
  for (const m of roster) {
    const old = world.players.find(p => p.slot === m.slot);
    const p = old ? world.rebindPlayer(old.id, m.id, m.name, m.look) : world.addPlayer(m.id, m.name, m.slot, m.look);
    p!.connected = m.connected;
    if (heal && m.connected) {
      if (p!.state !== 'alive') world.cure(p!);
      p!.hp = Math.max(60, p!.hp); p!.downT = 0; p!.hurtT = 0; p!.reloadT = 0;
      (p!.buffs ??= {}).invincible = Math.max(3, p!.buffs!.invincible ?? 0);
    }
  }
  world.events = [];
}
