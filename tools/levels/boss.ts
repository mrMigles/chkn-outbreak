// Final arena — the hangar with the CEO's helicopter pad. The CEO is now a colossal rooster.
import { F, type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';

const P = new Painter(36, 28);
P.rect(1, 1, 34, 26, 'y');
P.rect(14, 8, 21, 15, 'x');                // helipad markings
for (const [x, y] of [[8, 7], [26, 7], [8, 19], [26, 19]]) P.rect(x, y, x + 1, y + 1, '#'); // pillars

const objs: ObjSpec[] = [];
const at = (x: number, y: number): [number, number] => [x, y];
const prop = (name: string, x: number, y: number, rot = 0) => objs.push({ type: 'prop', name, at: at(x, y), rot });
const pickup = (name: string, x: number, y: number, props?: ObjSpec['props']) => objs.push({ type: 'pickup', name, at: at(x, y), props });
const light = (x: number, y: number, kind: string, color: string, radius: number) => objs.push({ type: 'light', at: at(x, y), props: { kind, color, radius } });

objs.push({ type: 'spawn', name: 'player', at: at(16, 24) }, { type: 'spawn', name: 'player', at: at(18, 24) }, { type: 'spawn', name: 'player', at: at(20, 24) }, { type: 'spawn', name: 'player', at: at(18, 25.2) });
objs.push({ type: 'spawner', name: 'boss_spawn', at: at(18, 5), props: { how: 'rise' } });
for (const [x, y] of [[2, 2], [33.5, 2], [2, 25.5], [33.5, 25.5], [18, 1.6]]) objs.push({ type: 'spawner', name: 'boss', at: at(x, y), props: { how: 'vent' } });
for (const [x, y] of [[5, 4], [30.5, 4], [5, 23.5], [30.5, 23.5], [12, 12], [24, 12], [12, 16], [24, 16], [18, 20.5], [3, 13.5], [33, 13.5]]) objs.push({ type: 'barrel', at: at(x, y) });
for (const [x, y, r] of [[4, 10, 0], [4.9, 10.3, 20], [31.5, 17, 0], [30.6, 17.4, 30], [14, 3, 0], [22, 3, 15]]) prop('crate', x, y, r);
prop('forklift', 31, 10, 90); prop('pallet', 6, 17); prop('generator', 30, 25.6); prop('hazard_barrel', 2.2, 18.5);
pickup('ammo', 3, 25.4); pickup('ammo', 33, 25.4); pickup('health', 3, 2.4); pickup('health', 33, 2.4); pickup('armor', 18, 26.2);
pickup('weapon', 10, 24, { weapon: 'machinegun' }); pickup('weapon', 26, 24, { weapon: 'grenade' });
objs.push({ type: 'label', at: at(17.75, 11.5), props: { text: 'H', size: 120, color: '#ffd84a', alpha: 0.25 } });
objs.push({ type: 'label', at: at(17.75, 14.6), props: { text: 'ПЛОЩАДКА ГЕНЕРАЛЬНОГО ДИРЕКТОРА', size: 16, color: '#ffd84a', alpha: 0.35 } });
for (const [x, y] of [[6, 13.5], [30, 13.5], [18, 4], [18, 22]]) light(x, y, 'lamp', 'ffd9a0', 340);
for (const [x, y] of [[1.6, 1.6], [34, 1.6], [1.6, 26], [34, 26]]) light(x, y, 'alarm', 'ff3b1f', 420);

const level: LevelSource = {
  id: 'boss',
  theme: 'industrial',
  mapProps: { ambient: 0.4 },
  grid: P.rows(),
  legend: { '#': { wall: true }, 'y': { floor: F.asphalt }, 'x': { floor: [86] } },
  objects: objs,
};
export default level;
