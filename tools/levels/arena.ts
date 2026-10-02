// Combat test arena: open space, corridor, side rooms. Used for tuning weapons & FX (T05–T11).
import { F, type LevelSource } from './types';

const level: LevelSource = {
  id: 'arena',
  theme: 'office',
  mapProps: { ambient: 0 },
  grid: [
    '##########################################',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#..........D,,,,,,,,,,,,,,,,,,E..........#',
    '#..........D,,,,,,,,,,,,,,,,,,E..........#',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#####..#####,,,,,,,,,,,,,,,,,,#####..#####',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#..........#,,,,,,,,,,,,,,,,,,#..........#',
    '#..........#######....#########..........#',
    '#.....................................kkk#',
    '#.....................................kkk#',
    '#..........##########################kkkk#',
    '#..........#                        #kkkk#',
    '############                        ######',
  ],
  legend: {
    '#': { wall: true },
    '.': { floor: F.wood },
    ',': { floor: F.woodLight },
    'k': { floor: F.white },
    'D': { floor: F.wood, door: { id: 'door_w' } },
    'E': { floor: F.wood, door: { id: 'door_e' } },
  },
  objects: [
    { type: 'spawn', name: 'player', at: [21, 16] },
    { type: 'spawn', name: 'player', at: [22, 16] },
    { type: 'spawn', name: 'player', at: [20, 16] },
    { type: 'spawn', name: 'player', at: [23, 16] },
    // open space desks
    ...[13, 17, 21, 25].flatMap((x) => [3, 7, 11].flatMap((y) => [
      { type: 'prop', name: x % 8 === 5 ? 'desk' : 'desk_b', at: [x + 1, y] as [number, number] },
      { type: 'prop', name: 'office_chair', at: [x + 1, y + 0.75] as [number, number] },
    ])),
    { type: 'prop', name: 'plant', at: [12.5, 1.5] }, { type: 'prop', name: 'plant', at: [29.5, 1.5] },
    { type: 'prop', name: 'water_cooler', at: [29.5, 13.4] },
    { type: 'prop', name: 'printer', at: [12.7, 13.3] },
    // west rooms
    { type: 'prop', name: 'server_rack', at: [1.5, 1.5] }, { type: 'prop', name: 'server_rack', at: [2.5, 1.5] }, { type: 'prop', name: 'server_rack', at: [3.5, 1.5] },
    { type: 'prop', name: 'server_rack', at: [1.5, 4.5] }, { type: 'prop', name: 'server_rack', at: [2.5, 4.5] },
    { type: 'prop', name: 'sofa_green', at: [5.5, 10.5] }, { type: 'prop', name: 'coffee_table', at: [5.5, 12] },
    { type: 'prop', name: 'vending', at: [9.5, 10.4] },
    // east rooms
    { type: 'prop', name: 'table_big', at: [36.5, 4.5] },
    ...[[35, 3], [36.5, 3], [38, 3], [35, 6.1], [36.5, 6.1], [38, 6.1]].map(([x, y]) => ({ type: 'prop', name: 'chair_' + ((x * 3) % 4 | 0), at: [x, y] as [number, number], rot: y < 4 ? 180 : 0 })),
    { type: 'prop', name: 'whiteboard', at: [36.5, 1.15] },
    { type: 'prop', name: 'crate', at: [33.5, 11.5] }, { type: 'prop', name: 'crate_small', at: [34.4, 12.2] }, { type: 'prop', name: 'crate_rot', at: [39.5, 10.5] },
    { type: 'prop', name: 'counter_a', at: [40.5, 15.5] }, { type: 'prop', name: 'stove', at: [40.5, 16.5] }, { type: 'prop', name: 'sink', at: [40.5, 17.5] },
    { type: 'barrel', at: [36.5, 11.5] }, { type: 'barrel', at: [6.5, 7.5] }, { type: 'barrel', at: [20.5, 13.2] },
    // weapons to test every gun
    { type: 'pickup', name: 'weapon', at: [17, 16], props: { weapon: 'smg' } },
    { type: 'pickup', name: 'weapon', at: [18, 16], props: { weapon: 'shotgun' } },
    { type: 'pickup', name: 'weapon', at: [19, 16], props: { weapon: 'rifle' } },
    { type: 'pickup', name: 'weapon', at: [24, 16], props: { weapon: 'machinegun' } },
    { type: 'pickup', name: 'weapon', at: [25, 16], props: { weapon: 'grenade' } },
    { type: 'pickup', name: 'weapon', at: [26, 16], props: { weapon: 'flamethrower' } },
    { type: 'pickup', name: 'ammo', at: [21.5, 15.3] }, { type: 'pickup', name: 'health', at: [22.5, 15.3] }, { type: 'pickup', name: 'armor', at: [23.5, 15.3] },
    // spawners (vents)
    { type: 'spawner', name: 'w', at: [2, 13] }, { type: 'spawner', name: 'w', at: [2, 7] },
    { type: 'spawner', name: 'e', at: [40, 8] }, { type: 'spawner', name: 'e', at: [36, 13] },
    { type: 'spawner', name: 'n', at: [15, 2] }, { type: 'spawner', name: 'n', at: [27, 2] },
    { type: 'spawner', name: 's', at: [3, 18] }, { type: 'spawner', name: 's', at: [9, 18] },
    // a few idle chickens
    { type: 'enemy', name: 'normal', at: [16, 5] }, { type: 'enemy', name: 'normal', at: [24, 9] }, { type: 'enemy', name: 'fat', at: [20, 6] },
  ],
};
export default level;
