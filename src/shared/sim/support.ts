import { dist } from '../math';
import { WEAPONS } from '../weapons';
import type { GameMap } from '../map';
import type { Player, WorldView } from './types';
import type { World } from './World';

export const HELP_RADIUS = 80;
const TAP_TIME = 0.22;

/** The HUD and authority use the same selection and line-of-sight rules. */
export function supportTarget(view: WorldView, map: GameMap, p: Player): Player | null {
  const candidates = view.players.filter(q => q !== p && q.id !== p.id && q.connected &&
    (q.state === 'alive' || q.state === 'downed') && dist(p.x, p.y, q.x, q.y) <= HELP_RADIUS &&
    map.lineOfSight(p.x, p.y, q.x, q.y, false));
  candidates.sort((a, b) => Number(b.state === 'downed') - Number(a.state === 'downed') ||
    dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y) || a.id.localeCompare(b.id));
  return candidates[0] ?? null;
}

export class SupportController {
  private edges = new Map<string, boolean[]>();
  private held = new Map<string, boolean>();

  input(p: Player, pressed: boolean) {
    if (pressed === (this.held.get(p.id) ?? false)) return;
    this.held.set(p.id, pressed);
    const edges = this.edges.get(p.id) ?? [];
    // A complete tap can arrive between two simulation ticks.
    if (edges.length < 16) edges.push(pressed);
    this.edges.set(p.id, edges);
  }

  reset(p: Player, w: World) {
    this.cancel(p, w); p.support = null;
    this.held.set(p.id, p.input.interact); this.edges.delete(p.id);
  }

  private cancel(p: Player, w: World) {
    const action = p.support;
    if (!action) return;
    action.cancelled = true; action.progress = 0;
    const target = w.players.find(q => q.id === action.target);
    if (target && action.kind === 'revive' && !w.players.some(q => q !== p && q.support?.target === target.id && !q.support.cancelled && !q.support.completed)) target.reviveT = 0;
  }

  private valid(p: Player, target: Player | undefined, w: World) {
    return target && p.connected && p.state === 'alive' && target.connected &&
      dist(p.x, p.y, target.x, target.y) <= HELP_RADIUS &&
      w.map.lineOfSight(p.x, p.y, target.x, target.y, false);
  }

  update(w: World, p: Player, dt: number, use: () => void): boolean {
    for (const pressed of this.edges.get(p.id) ?? []) {
      if (pressed && p.state === 'alive' && p.connected) {
        const target = supportTarget(w, w.map, p) ?? (p.hp < p.maxHp && p.supplies.medkit > 0 ? p : null);
        p.support = target ? {
          target: target.id, kind: target.state === 'downed' ? 'revive' : target.hp < target.maxHp && p.supplies.medkit > 0 ? 'heal' : 'ammo',
          elapsed: 0, progress: 0, anchorX: p.x, anchorY: p.y, cancelled: false, completed: false,
          targetVersion: target.supportVersion,
        } : null;
        // World interactions are single edges, never repeated while holding E.
        if (!target) use();
      } else if (!pressed) {
        const action = p.support;
        if (action && !action.cancelled && !action.completed && action.elapsed < TAP_TIME && action.kind !== 'revive') {
          const target = w.players.find(q => q.id === action.target);
          if (target === p) use();
          else if (this.valid(p, target, w) && target!.state === 'alive' && p.supplies.ammo > 0) {
            const weapon = target!.weapons[target!.cur], ammo = target!.ammo[weapon], def = WEAPONS[weapon];
            if (ammo && ammo.reserve >= 0 && ammo.reserve < def.reserveMax) {
              ammo.reserve = Math.min(def.reserveMax, ammo.reserve + def.mag);
              p.supplies.ammo--; w.emit({ e: 'help', id: target!.id, by: p.id, kind: 'ammo' });
            }
          }
        }
        this.cancel(p, w); p.support = null;
      }
    }
    this.edges.delete(p.id);
    const a = p.support;
    if (!a || a.cancelled || a.completed) return false;
    const target = w.players.find(q => q.id === a.target);
    if (!this.valid(p, target, w) || dist(p.x, p.y, a.anchorX, a.anchorY) > 8 || p.input.fire) {
      this.cancel(p, w); return false;
    }
    a.elapsed += dt;
    if (a.kind === 'ammo') return false;
    if (target!.supportVersion !== a.targetVersion) { this.cancel(p, w); return false; }
    if ((a.kind === 'revive' && target!.state !== 'downed') || (a.kind === 'heal' &&
      (target!.state !== 'alive' || target!.hp >= target!.maxHp || p.supplies.medkit < 1))) {
      this.cancel(p, w); return false;
    }
    // One helper owns a target. A second helper cannot accelerate or duplicate it.
    const owner = w.players.find(q => q.support?.target === a.target && q.support.kind === a.kind && !q.support.cancelled && !q.support.completed);
    if (owner !== p) { a.progress = 0; return true; }
    a.progress = Math.min(1, a.progress + dt / (a.kind === 'revive' ? 2.6 : 1.2));
    if (a.kind === 'revive') target!.reviveT = a.progress;
    if (a.progress >= 1) {
      a.completed = true;
      target!.supportVersion++;
      if (a.kind === 'revive') {
        target!.state = 'alive'; target!.hp = 45; target!.reviveT = 0; target!.downT = 0;
        w.emit({ e: 'revived', id: target!.id, by: p.id });
      } else {
        target!.hp = Math.min(target!.maxHp, target!.hp + 40); p.supplies.medkit--;
        w.emit({ e: 'help', id: target!.id, by: p.id, kind: 'heal' });
      }
    }
    return true;
  }
}
