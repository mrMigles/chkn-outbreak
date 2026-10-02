// Level 3 — «Курникс-Агро» bottling plant. Yard, warehouse, boiler room, conveyor hall, storage.
import { F, type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';

const P = new Painter(70, 50);
P.rect(2, 2, 11, 10, 'c');     // freight lift arrival
P.rect(13, 2, 44, 20, 'y');    // loading yard
P.rect(13, 11, 44, 11, 'd');   // yard road marking
P.rect(46, 2, 67, 20, 'w');    // warehouse
P.rect(2, 12, 11, 36, 'p');    // boiler room
P.rect(13, 22, 56, 36, 'h');   // conveyor hall
P.rect(58, 22, 67, 30, 'c');   // control room
P.rect(13, 38, 44, 47, 'c');   // finished goods storage
// structure
for (const x of [20, 30, 40, 50]) P.rect(x, 28, x, 29, '#');      // hall pillars
for (const [x, y] of [[20, 6], [36, 6], [20, 16], [36, 16]]) P.rect(x, y, x + 1, y + 1, '#'); // yard concrete blocks
// doors
P.rect(12, 5, 12, 7, 'A');     // lift → yard
P.rect(45, 9, 45, 12, 'B');    // yard → warehouse
P.rect(12, 15, 12, 16, 'C');   // yard → boiler
P.rect(28, 21, 31, 21, 'D');   // yard → hall (gate)
P.rect(12, 26, 12, 27, 'E');   // boiler → hall
P.rect(57, 25, 57, 26, 'G');   // hall → control
P.rect(62, 21, 63, 21, 'J');   // warehouse → control
P.rect(27, 37, 30, 37, 'H');   // hall → storage (after antidote)

const objs: ObjSpec[] = [];
const at = (x: number, y: number): [number, number] => [x, y];
const prop = (name: string, x: number, y: number, rot = 0, props?: ObjSpec['props']) => objs.push({ type: 'prop', name, at: at(x, y), rot, props });
const note = (x: number, y: number, text: string) => objs.push({ type: 'note', at: at(x, y), props: { text } });
const label = (x: number, y: number, text: string, size = 26) => objs.push({ type: 'label', at: at(x, y), props: { text, size, color: '#ffd27a' } });
const enemy = (type: string, x: number, y: number, tag = '') => objs.push({ type: 'enemy', name: type, at: at(x, y), props: { tag } });
const pickup = (name: string, x: number, y: number, props?: ObjSpec['props']) => objs.push({ type: 'pickup', name, at: at(x, y), props });
const spawner = (name: string, x: number, y: number, how = 'vent') => objs.push({ type: 'spawner', name, at: at(x, y), props: { how } });
const trigger = (name: string, x: number, y: number, w: number, h: number, props?: ObjSpec['props']) => objs.push({ type: 'trigger', name, at: at(x, y), size: [w, h], props });
const light = (x: number, y: number, kind: string, color: string, radius: number, extra: ObjSpec['props'] = {}) => objs.push({ type: 'light', at: at(x, y), props: { kind, color, radius, ...extra } });
const barrel = (x: number, y: number) => objs.push({ type: 'barrel', at: at(x, y) });

// ---------------------------------------------------------------- lift
prop('elevator', 6.5, 3.1); prop('crate', 3, 9.4); prop('crate_small', 4, 9.6);
objs.push({ type: 'spawn', name: 'player', at: at(5.5, 6.8) }, { type: 'spawn', name: 'player', at: at(7, 6.8) }, { type: 'spawn', name: 'player', at: at(8.5, 6.8) }, { type: 'spawn', name: 'player', at: at(7, 8.2) });
pickup('ammo', 10.4, 9.4); pickup('health', 2.6, 6);

// ---------------------------------------------------------------- yard
for (const [x, y] of [[16, 4], [16.9, 4.2], [16.4, 5.1], [42, 18], [41.1, 18.3]]) prop('crate', x, y, (x * 37) % 90);
for (const [x, y] of [[24, 3.6], [33, 3.6], [24, 18.4], [33, 18.4]]) prop('pallet', x, y);
prop('forklift', 27.5, 15.5, 90); prop('forklift', 40, 5, 0);
for (const [x, y] of [[18, 9], [18.6, 9.7], [26, 8.2], [38, 13.5], [38.7, 14.2], [43.5, 3], [14, 19.3], [31, 12.9], [22.5, 13.4]]) barrel(x, y);
prop('hazard_barrel', 43.4, 9.5); prop('hazard_barrel', 14, 2.8);
pickup('weapon', 28.5, 9.8, { weapon: 'grenade' }); pickup('ammo', 36.5, 9.5); pickup('armor', 21, 18.5);
label(29, 6.6, 'ПОГРУЗОЧНЫЙ ДВОР', 30);
note(16.4, 6.0, 'Ящики: «КУКАРЕКС. 24 банки. Встряхнуть перед превращением»');
enemy('normal', 25, 6, 'yard0'); enemy('armored', 32, 14, 'yard0'); enemy('normal', 35, 8, 'yard0'); enemy('fast', 40, 16, 'yard0');
spawner('yard', 44, 2.6); spawner('yard', 44, 19.4); spawner('yard', 13.5, 19.4); spawner('yard', 30, 2.6);
trigger('yard', 13, 2, 32, 19);
for (const [x, y] of [[18, 3], [40, 3], [18, 19], [40, 19]]) light(x, y, 'lamp', 'ffd9a0', 300);

// ---------------------------------------------------------------- warehouse
for (const y of [5, 9.5, 14]) for (const x of [50, 56.5, 63]) prop('shelf', x, y);
prop('forklift', 60, 18.4, 90); prop('pallet', 48, 18.5); prop('crate', 66.5, 2.6); prop('crate_small', 65.6, 3);
objs.push({ type: 'npc', name: 'mihalych', at: at(65.5, 17.5), props: { kind: 'manBrown', title: 'Бригадир Михалыч', mode: 'guard', weapon: 'rifle', hp: 180, angle: 180, lines: 'Тридцать лет на заводе. Курицу от человека отличаю по походке.|План по розливу никто не отменял!|Держись за мной, салага.' } });
pickup('ammo', 47, 2.8); pickup('health', 66.4, 9.5);
label(56.5, 11.8, 'СКЛАД СЫРЬЯ', 24);
note(50, 5.8, 'Накладная: «Корм комбинированный, 40 т. Получатель: Отдел продаж»');
spawner('wh', 46.5, 2.6); spawner('wh', 46.5, 19.5); spawner('wh', 67, 12);
trigger('warehouse', 46, 2, 22, 19);
for (const x of [50, 63]) light(x, 11.5, 'lamp', 'cfe0ff', 280, { flicker: 0.15 });

// ---------------------------------------------------------------- boiler
prop('generator', 6.5, 13.6); prop('machine', 6.5, 21); prop('pipe_h', 4, 29); prop('pipe_h', 9, 29); prop('generator', 6.5, 34.5);
barrel(3, 25); barrel(10.3, 25); barrel(3, 31.5);
pickup('health', 10.4, 18); pickup('ammo', 2.7, 18);
label(6.5, 26.5, 'КОТЕЛЬНАЯ', 18);
note(6.5, 23.6, 'Табличка: «Температура 95°. Идеально для бульона»');
light(6.5, 24, 'alarm', 'ff6a1f', 300); light(6.5, 18, 'lamp', 'ffb347', 220, { flicker: 0.6 });
enemy('spitter', 4, 17, 'boil'); enemy('normal', 9, 22, 'boil'); enemy('exploder', 6, 32, 'boil');

// ---------------------------------------------------------------- conveyor hall
for (let x = 16; x <= 53; x++) {
  if ([24, 25, 34, 35, 44, 45].includes(x)) continue; // walkways between the belts
  prop('conveyor', x + 0.5, 25, 0); prop('conveyor', x + 0.5, 32.6, 0);
}
prop('machine', 16.4, 29, 0); prop('machine', 53.6, 29, 0);
for (const [i, [x, y]] of ([[16, 30.8], [35, 23], [53.5, 34.8]] as [number, number][]).entries()) {
  prop('lab_console', x, y);
  objs.push({ type: 'use', name: 'valve' + (i + 1), at: at(x, y), props: { hint: 'открыть вентиль синтеза' } });
  light(x, y, 'lamp', '7dff8a', 180);
}
for (const [x, y] of [[25, 28.4], [45, 30.2], [35, 29.4]]) barrel(x, y);
pickup('ammo', 22, 35.4); pickup('ammo', 48, 23); pickup('health', 35, 35.4);
label(35, 28.8, 'ЦЕХ РОЗЛИВА «КУКАРЕКС»', 30);
note(35, 31.2, 'Плакат: «Сто тысяч банок в день! Сто тысяч кур в неделю!»');
spawner('hall', 13.6, 22.6); spawner('hall', 56.4, 22.6); spawner('hall', 13.6, 35.4); spawner('hall', 56.4, 35.4); spawner('hall', 35, 22.1);
trigger('hall', 13, 22, 44, 15);
for (const x of [18, 30, 42, 52]) light(x, 29, 'lamp', 'ffe2a8', 300, { flicker: 0.1 });
for (const x of [22, 48]) light(x, 29, 'alarm', 'ff3b1f', 380);

// ---------------------------------------------------------------- control room
prop('lab_console', 60, 22.6); prop('lab_console', 63.5, 22.6); prop('cabinet', 66.4, 27, 90); prop('chair_blue', 61.5, 24);
note(62, 23.4, 'Пульт: «Синтез антидота: требуется открыть 3 вентиля в цехе»');
pickup('weapon', 64, 29, { weapon: 'flamethrower' }); pickup('armor', 59, 29.4);
label(62.5, 27.5, 'ПУЛЬТОВАЯ', 18);
light(62, 26, 'lamp', 'b7ff9a', 220);

// ---------------------------------------------------------------- storage / exit
for (const x of [16, 21, 26, 33, 38, 43]) for (const y of [40, 44.5]) prop('pallet', x, y);
for (const x of [16, 26, 38]) prop('crate', x, 40);
prop('sign_exit', 28.5, 47.6);
label(28.5, 42.3, 'СКЛАД ГОТОВОЙ ПРОДУКЦИИ', 22);
note(28.5, 47.0, 'Табличка: «К АНГАРУ. Вход только для руководства»');
trigger('exit', 24, 45, 9, 3, { all: true });
light(28.5, 46, 'emergency', 'ff2a1a', 260);

const level: LevelSource = {
  id: 'factory',
  theme: 'industrial',
  mapProps: { ambient: 0.45 },
  grid: P.rows(),
  legend: {
    '#': { wall: true },
    'c': { floor: F.concreteBlue },
    'y': { floor: F.asphalt },
    'd': { floor: [82] },
    'w': { floor: F.concrete },
    'p': { floor: F.asphalt },
    'h': { floor: [85, 85, 85, 86] },
    'A': { floor: F.concreteBlue, door: { id: 'lift' } },
    'B': { floor: F.asphalt, door: { id: 'warehouse' } },
    'C': { floor: F.asphalt, door: { id: 'boiler' } },
    'D': { floor: F.asphalt, door: { id: 'hall' } },
    'E': { floor: F.asphalt, door: { id: 'boiler_hall' } },
    'G': { floor: F.asphalt, door: { id: 'control' } },
    'J': { floor: F.asphalt, door: { id: 'wh_control' } },
    'H': { floor: F.asphalt, door: { id: 'storage', locked: 'script' } },
  },
  objects: objs,
};
export default level;
