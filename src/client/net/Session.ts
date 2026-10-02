import { GameMap, TiledMap } from '../../shared/map';
import { World, Carry } from '../../shared/sim/World';
import { LEVELS } from '../../shared/levels';
import type { PlayerInput, SimEvent, WorldView } from '../../shared/sim/types';

export interface Session {
  solo: boolean;
  myId: string;
  levelId: string;
  map: GameMap;               // client copy (prediction, raycasts for FX)
  view: WorldView;
  /** Advance (local) / process network messages. Returns events since last call. */
  poll(dt: number): SimEvent[];
  send(inp: PlayerInput): void;
  /** Carry-over data for the next level (solo). */
  carry(): Carry;
  dispose(): void;
}

const STEP = 1 / 60;

export class LocalSession implements Session {
  solo = true;
  myId = 'me';
  levelId: string;
  map: GameMap;
  world: World;
  private acc = 0;

  constructor(levelId: string, mapJson: TiledMap, name: string, carry?: Carry, difficulty = 1) {
    this.levelId = levelId;
    this.map = new GameMap(levelId, mapJson);
    this.world = new World(this.map, LEVELS[levelId], { solo: true, carry, difficulty });
    this.world.addPlayer(this.myId, name, 0);
    this.world.start();
  }

  get view(): WorldView { return this.world; }

  poll(dt: number) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) { this.world.step(STEP); this.acc -= STEP; }
    const ev = this.world.events;
    this.world.events = [];
    return ev;
  }

  send(inp: PlayerInput) { this.world.setInput(this.myId, inp); }

  carry() { return this.world.carryOut(); }

  dispose() {}
}
