// Chapter 2, street 1 (D69): out of the business centre, along the avenue to the fountain square where the
// helicopter fell. Side scenes: Ашот's shawarma kiosk, a grandma feeding a flock in the park, a courier on a car.
import { type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';

const W = 84, H = 68;
const p = new Painter(W, H);
p.rect(2, 2, 22, 11, 'z');          // business-centre forecourt
p.rect(2, 12, 81, 13, 'k');         // north sidewalk
p.rect(2, 14, 81, 18, 'r');         // the avenue
p.rect(2, 16, 81, 16, '=');         // centre line
p.rect(2, 19, 81, 20, 'k');         // south sidewalk
p.rect(40, 14, 44, 18, 'r');        // crossroads
p.rect(36, 14, 37, 18, 'x');        // zebra across the avenue
p.rect(38, 21, 39, 53, 'k'); p.rect(45, 21, 46, 53, 'k'); // sidewalks of the side street
p.rect(40, 19, 44, 53, 'r'); p.rect(42, 21, 42, 53, '|'); // side street to the south
p.rect(40, 19, 44, 20, 'y');        // zebra across the side street
p.rect(2, 21, 36, 52, 'g');         // park
p.rect(2, 35, 37, 36, 'p'); p.rect(18, 21, 19, 52, 'p'); // park paths
p.rect(37, 21, 37, 52, 'k');
p.rect(48, 22, 81, 51, 'z');        // fountain square
p.rect(47, 29, 47, 41, 'k');        // square ← side street
p.rect(58, 21, 68, 21, 'k');        // square ← avenue
// D72: the side street goes on south to a parking lot «Элит-Авто»; its east fence opens onto the road to the market
p.rect(40, 54, 44, 59, 'r'); p.rect(42, 54, 42, 58, '|'); p.rect(38, 54, 39, 56, 'k'); p.rect(45, 54, 46, 56, 'k');
p.rect(22, 57, 62, 66, 'q');
p.rect(63, 60, 83, 63, 'r');
// a few building corners poke into the square, park hedges are props
p.rect(48, 22, 52, 25, '#'); p.rect(77, 22, 81, 26, '#'); p.rect(48, 47, 53, 51, '#'); p.rect(75, 46, 81, 51, '#');

const objects: ObjSpec[] = [];
const o = (type: string, name: string, x: number, y: number, props?: ObjSpec['props'], size?: [number, number]) => objects.push({ type, name, at: [x, y], props, size });
const prop = (name: string, x: number, y: number, props?: ObjSpec['props']) => o('prop', name, x, y, props);
const label = (text: string, x: number, y: number, size = 22, color = '#4a4038') => o('label', '', x, y, { text, size, color, alpha: .45 });
const note = (x: number, y: number, text: string) => o('note', '', x, y, { text });
const enemy = (type: string, x: number, y: number, tag: string, extra: ObjSpec['props'] = {}) => o('enemy', type, x, y, { tag, ...extra });

// ---- forecourt of the business centre
for (let i = 0; i < 4; i++) o('spawn', 'player', 10 + (i % 2) * 1.6, 5 + Math.floor(i / 2) * 1.3);
label('БЦ «КУРНИКС ПЛАЗА»', 12, 3.2, 26, '#5a5048');
prop('billboard', 18, 3.4); prop('bench', 5, 9.8); prop('flowers_0', 3.5, 3.2); prop('flowers_1', 20.5, 9.6); prop('trash_can', 7, 10);
prop('street_lamp', 3, 10.4); prop('street_lamp', 21, 10.4);
o('pickup', 'ammo', 14, 9.8); o('pickup', 'health', 6, 3.5);
note(12, 7.6, 'Табличка у входа: «Бизнес-центр работает в штатном режиме». Табличку держит петух.');

// ---- the avenue: abandoned cars, cones, lamps
const car = (name: string, x: number, y: number) => prop(name, x, y);
car('car_red', 8, 15.3); car('car_grey_l', 15, 17.8); car('car_burnt', 27, 15.2); car('car_white_l', 33, 17.6);
car('car_blue', 50, 17.6); car('car_taxi_l', 60, 15.2); car('car_green', 71, 17.6); car('car_burnt', 77, 15.2);
car('car_white_v', 41.4, 27); car('car_red_v', 43.6, 38); car('car_grey_v', 41.4, 47);
for (const [x, y] of [[23, 14.6], [24, 18.2], [46, 15], [66, 18.3], [80, 16]]) prop('cone', x, y);
for (const x of [6, 14, 22, 30, 52, 60, 68, 76]) { prop('street_lamp', x, 12.3); prop('street_lamp', x + 4, 20.7); }
for (const y of [24, 32, 40, 48]) { prop('street_lamp', 38.3, y); prop('street_lamp', 46.15, y + 4); } // D72: off the wall — no pocket to get wedged in
prop('hydrant', 34, 12.6); prop('hydrant', 46.5, 20.4); prop('trash_can', 31, 12.5); prop('trash_can', 57, 20.5); prop('bus_stop', 26, 12.6);
for (const [x, y] of [[3, 16], [80.5, 16], [42, 52.5], [44, 22]]) o('spawner', 'street', x, y, { how: 'rise', corridorOnly: true });
o('trigger', 'avenue', 24, 12, {}, [12, 9]);
note(26, 13.3, 'Остановка: «Маршрутка 66 — до завода «Провансаль». Интервал: как повезёт»');

// ---- Ашот's shawarma kiosk on the north sidewalk
prop('kiosk', 55, 12.55); label('ШАУРМА «НЕ ИЗ КУРИЦЫ»', 55, 11.4, 16, '#8a2a20');
o('npc', 'ashot', 57.8, 13.1, { reach: 130, title: 'Ашот · шаурма', mode: 'cower', hp: 200, story: true, essential: true, untargetable: true, weapon: 'shotgun', angle: 180, lines: 'Клянусь, шаурма из телятины!|Они не верят! Они клюют ларёк!' });
for (const [x, y, t] of [[52, 14.5, 'normal'], [54, 15.2, 'fast'], [56, 14.8, 'normal'], [58.5, 15.5, 'spitter'], [53, 16.5, 'normal'], [60, 13.6, 'fast'], [50.5, 13.2, 'normal']] as const) enemy(t, x, y, 'shawarma', { dormant: true });
o('trigger', 'shawarma', 47, 12, {}, [16, 8]);

// ---- the park: grandma feeds a flock (do not shoot near them), trees, hedges, benches
prop('bench', 10, 28.4); o('npc', 'babushka', 10, 27.6, { title: 'Бабушка Зина', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 90, lines: 'Цыпа-цыпа-цыпа!|Внучок, они же голодные!' });
// D72: a bigger flock — two rings of chicks around the grandma's bench
for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; enemy('chick', 10 + Math.cos(a) * 2.2, 30.5 + Math.sin(a) * 1.4, 'flock', { dormant: true }); }
for (let i = 0; i < 12; i++) { const a = (i + .5) / 12 * Math.PI * 2; enemy('chick', 10 + Math.cos(a) * 3.6, 30.8 + Math.sin(a) * 2.3, 'flock', { dormant: true }); }
for (const [n, x, y] of [['tree_round', 4, 24], ['tree_oak', 13, 23.6], ['tree_pine', 24, 24], ['tree_round', 31, 26], ['tree_big', 6, 41], ['tree_oak', 14, 46], ['tree_round', 26, 42], ['tree_pine', 33, 47], ['tree_oak', 29, 31], ['tree_round', 4, 33]] as const) prop(n, x, y);
for (const [x, y] of [[22, 29], [28, 38], [10, 39], [33, 33]]) prop('hedge', x, y);
prop('bench', 25, 34.4); prop('bench', 12, 37.6); prop('fountain', 18.5, 44); prop('trash_can', 20.5, 34.3);
for (const [x, y] of [[8, 21.3], [28, 21.3]]) prop('fence', x, y);
o('trigger', 'park', 2, 21, {}, [35, 32]);
for (const [x, y] of [[3, 51.5], [35, 51.5], [3, 22]]) o('spawner', 'park', x, y, { how: 'rise' });
o('npc', 'courier', 72.5, 16.6, { title: 'Курьер Тимур', kind: 'courier', mode: 'cower', hp: 120, story: true, essential: true, untargetable: true, angle: 90, lines: 'Заказ на имя «Петух»… Я думал, это шутка!' });
for (const [x, y, t] of [[70, 14.6, 'normal'], [74.5, 18.3, 'fast'], [69, 19.3, 'normal'], [76, 14.6, 'normal']] as const) enemy(t, x, y, 'courier');
o('pickup', 'health', 30, 50); o('pickup', 'ammo', 3, 48); o('pickup', 'armor', 34.5, 22);
label('ПАРК «ИМЕНИ ПЕРВОГО КВАРТАЛА»', 18.5, 51.3, 22, '#3f5a38');

// ---- fountain square: the helicopter wreck, Капитан Крылов, the radio defence
prop('heli_wreck', 64, 32.4); prop('fountain', 66, 42);
for (const [x, y] of [[57, 30], [71, 31], [62, 37.5]]) o('light', '', x, y, { kind: 'lamp', color: 'ff9a3c', radius: 220, flicker: .7 });
prop('car_burnt', 56, 44.6); prop('car_white', 73, 38.2); prop('trash_can', 55, 27); prop('bench', 72, 46.4); prop('bench', 60, 46.4);
for (const [n, x, y] of [['tree_round', 56, 24.5], ['tree_oak', 74, 28], ['tree_round', 59, 49.5], ['tree_pine', 72, 49.5]] as const) prop(n, x, y);
o('npc', 'pilot', 60.5, 34.6, { title: 'Капитан Крылов · МЧС', mode: 'cower', hp: 200, story: true, essential: true, untargetable: true, angle: 0, lines: 'Рация цела! Мне нужна минута!' });
for (const [x, y, t] of [[58, 32, 'normal'], [63, 37, 'fast'], [68, 35.5, 'normal'], [70, 41, 'spitter'], [61, 40, 'normal'], [66, 29, 'fast']] as const) enemy(t, x, y, 'square');
o('trigger', 'square', 48, 22, {}, [34, 30]);
for (const [x, y] of [[49, 35], [80.5, 35], [63, 22], [64, 50.5], [55, 50], [80, 43], [50, 27]]) o('spawner', 'heli', x, y, { how: 'rise' });
label('ПЛОЩАДЬ У ФОНТАНА', 66, 47.6, 26);
o('pickup', 'health', 76, 30); o('pickup', 'ammo', 53, 33); o('pickup', 'ammo', 76, 44); o('pickup', 'health', 52, 44);
note(66.5, 34.4, 'На борту вертолёта: «МЧС. Не кормить». Ниже, перьями: «КО».');

// ---- the way south: D72 the parking lot «Элит-Авто», Литовец, the fence onto the road to the market
label('↓ ПАРКОВКА «ЭЛИТ-АВТО»', 42, 50.4, 18, '#5a5048');
o('trigger', 'lot', 38, 53, {}, [9, 4]);
label('ПАРКОВКА «ЭЛИТ-АВТО» · ТОЛЬКО ДЛЯ VIP', 42, 66.2, 20, '#e8c64a');
const lotCars = ['car_sport_black_v', 'car_red_v', 'car_sport_yellow_v', 'car_white_v', 'car_sport_lime_v', 'car_blue_v', 'car_grey_v', 'car_sport_black_v', 'car_sport_yellow_v'];
[24, 27.5, 31, 34.5, 37.5, 48, 51.5, 55, 58.5].forEach((x, i) => prop(lotCars[i], x, 58.6));
[24, 27.5, 31, 34.5, 38, 41.5, 45, 48.5, 52, 55.5, 59].forEach((x, i) => prop(lotCars[(i + 3) % lotCars.length], x, 65.2));
o('npc', 'litovets', 30.4, 61.1, { reach: 130, title: 'Литовец · «просто смотрю»', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 180 });
o('marker', 'getaway', 27, 61.9, { kind: 'car_sport' });
for (const [x, y, t] of [[35, 61, 'normal'], [37, 62.6, 'fast'], [39.5, 60.8, 'normal'], [42, 62.2, 'normal'], [44, 61, 'fast'], [46.5, 62.6, 'normal'], [48.5, 61.2, 'spitter'], [50.5, 62.4, 'normal'], [52.5, 60.9, 'fast'], [54.5, 62.4, 'normal'], [56.5, 61.3, 'armored'], [58.5, 62.6, 'normal'], [60, 61, 'fast'], [61.4, 62.2, 'normal']] as const) enemy(t, x, y, 'lot', { dormant: true, deaf: true });
for (const [x, y] of [[23, 61], [61.5, 57.6], [32.8, 66.3], [46.75, 66.3]]) o('spawner', 'lot', x, y, { how: 'rise' });
prop('fence_v', 63.5, 61); prop('fence_v', 63.5, 63);
o('trigger', 'lot_exit', 76, 60, { once: false, all: true }, [7, 4]);
label('→ РЫНОК · ЗАВОД «ПРОВАНСАЛЬ»', 74, 59.4, 18, '#5a5048');
for (const x of [66, 72, 78]) prop('street_lamp', x, 59.6);
o('pickup', 'ammo', 41, 56.5); o('pickup', 'health', 24, 61.4);
note(44.2, 56.2, 'Табличка: «Охраняемая парковка. Охрана — петух. Тариф — 300 ₽/час. Угон — бесплатно»');

const level: LevelSource = {
  id: 'street1', theme: 'street', mapProps: { ambient: 0, wallFace: 'street' }, grid: p.rows(), objects,
  legend: {
    '#': { wall: true }, z: { floor: [510] }, k: { floor: [507] }, r: { floor: [502] }, '=': { floor: [503] }, '|': { floor: [504] },
    x: { floor: [505] }, y: { floor: [506] }, g: { floor: [508, 509] }, p: { floor: [514] }, q: { floor: [502, 516] },
  },
};
export default level;
