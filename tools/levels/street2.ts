// Chapter 2, street 2 (D69): the market (fresh eggs that hatch), a blogger streaming the apocalypse, the park
// with a minibus driver, the industrial zone and the «Провансаль» checkpoint: the watchman's relief has the
// pass, the gate opens slowly while the factory guard attacks.
import { type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';

const p = new Painter(84, 56);
p.rect(40, 0, 44, 14, 'r'); p.rect(42, 0, 42, 14, '|'); p.rect(38, 0, 39, 14, 'k'); p.rect(45, 0, 46, 14, 'k'); // the side street from street 1
p.rect(3, 3, 36, 26, 'z');          // market square
p.rect(37, 4, 37, 12, 'k');         // market ← sidewalk
p.rect(17, 27, 20, 27, 'M');        // market → park: Тётя Валя's back gate
p.rect(3, 28, 37, 52, 'g');         // park
p.rect(3, 39, 37, 40, 'p'); p.rect(18, 28, 19, 52, 'p');
p.rect(38, 30, 81, 51, 'r');        // industrial yard
p.rect(38, 30, 38, 52, 'p');
p.rect(72, 31, 81, 38, 'c');        // garage (Толик)
p.rect(71, 31, 71, 38, '#'); p.rect(72, 39, 81, 39, '#'); p.set(76, 39, 'c'); p.set(77, 39, 'c'); p.set(75, 39, 'c');
p.rect(66, 46, 70, 51, '#'); p.rect(67, 47, 69, 50, 'b'); p.set(66, 48, 'b'); p.set(66, 49, 'b'); // guard booth
p.rect(55, 52, 64, 52, 'G');        // the factory gate
p.rect(53, 53, 66, 54, 'f');        // factory side (exit)
p.rect(71, 30, 81, 30, '#');

const objects: ObjSpec[] = [];
const o = (type: string, name: string, x: number, y: number, props?: ObjSpec['props'], size?: [number, number]) => objects.push({ type, name, at: [x, y], props, size });
const prop = (name: string, x: number, y: number, props?: ObjSpec['props']) => o('prop', name, x, y, props);
const label = (text: string, x: number, y: number, size = 22, color = '#4a4038') => o('label', '', x, y, { text, size, color, alpha: .45 });
const note = (x: number, y: number, text: string) => o('note', '', x, y, { text });
const enemy = (type: string, x: number, y: number, tag: string, extra: ObjSpec['props'] = {}) => o('enemy', type, x, y, { tag, ...extra });

// ---- arrival from street 1; the road south is blocked by a crash with a mayonnaise lorry
for (let i = 0; i < 4; i++) o('spawn', 'player', 41 + (i % 2) * 2, 3 + Math.floor(i / 2) * 1.3);
prop('car_burnt', 42, 13.4); prop('car_white_l', 42.5, 11.4); for (const x of [39, 45.5]) prop('cone', x, 13.6);
label('ПРОЕЗД ЗАКРЫТ · ДТП С ФУРОЙ МАЙОНЕЗА', 42, 9, 16, '#8a2a20');
note(44, 10.5, 'Табличка ГИБДД: «Объезд через рынок». Под ней перьями: «Добро пожаловать»');
for (const y of [2, 10]) { prop('street_lamp', 38.3, y); prop('street_lamp', 46.6, y + 2); }
o('npc', 'blogger', 38.6, 7, { title: 'Блогер Стёпа · в эфире', mode: 'idle', hp: 120, story: true, angle: 180, lines: 'Ставьте лайк, если вы не курица!|Донат: «Стёпа, сзади!» Спасибо!' });
o('trigger', 'blogger', 37, 3, {}, [10, 9]);

// ---- the market: stalls in rows, Тётя Валя and her «fresh» eggs
for (const y of [7, 13, 19]) for (const x of [7, 15, 31]) prop('stall', x, y);
prop('stall', 23, 7); prop('stall', 23, 19);
prop('stall', 23, 13); o('npc', 'valya', 23, 12.1, { reach: 150, title: 'Тётя Валя · яйца', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 90, lines: 'Яйца! Свежие! Почти не вылупляются!' });
for (const [x, y] of [[20.5, 14.4], [25.5, 14.4], [21.5, 15.6], [24.5, 15.6], [19.5, 12], [26.5, 12]]) o('pod', '', x, y, { tag: 'eggs', hatch: (x * 7 + y) % 3 < 1 ? 'fast' : 'normal' });
// D72: more eggs — trays at every stall row, they all hatch with Тётя Валя's
for (const [x, y] of [[5.5, 8.6], [8.5, 8.6], [13.5, 8.6], [16.5, 8.6], [29.5, 8.6], [32.5, 8.6], [5.5, 14.6], [8.5, 14.6], [13.5, 14.6], [16.5, 14.6], [29.5, 14.6], [32.5, 14.6], [5.5, 20.6], [9, 20.6], [16.5, 20.6], [21.5, 20.6], [25, 20.6], [32.5, 20.6]] as const) {
  const k = Math.round(x * 3 + y);
  o('pod', '', x, y, { tag: 'eggs', hatch: k % 4 === 0 ? 'fast' : k % 4 === 1 ? 'normal' : 'chick' });
}
for (const [x, y, t] of [[11, 10, 'normal'], [19, 10, 'fast'], [27, 10, 'normal'], [11, 16, 'spitter'], [27, 16, 'normal'], [15, 22.5, 'fast'], [31, 22.5, 'normal'], [7, 22.5, 'normal'], [34, 4.5, 'fast'], [5, 4.5, 'normal']] as const) enemy(t, x, y, 'market');
for (const [x, y] of [[3.5, 3.5], [3.5, 26], [36, 26], [20, 3.5]]) o('spawner', 'market', x, y, { how: 'rise' });
o('trigger', 'market', 3, 3, { once: false }, [34, 24]);
o('trigger', 'eggstall', 18, 10, {}, [10, 7]);
prop('shopping_cart', 34, 8); prop('shopping_cart', 5, 18); prop('trash_can', 36, 25); prop('billboard', 12, 3.3);
label('КОЛХОЗНЫЙ РЫНОК', 19, 25.3, 30, '#5a4a3a');
note(15, 8.2, 'Ценник: «Курица домашняя — 300 ₽/кг. Курица агрессивная — бесплатно, забирайте»');
o('pickup', 'health', 4, 12); o('pickup', 'ammo', 35, 17); o('pickup', 'ammo', 11, 24);

// ---- the park: trees, the minibus stop, the driver
for (const [n, x, y] of [['tree_round', 6, 31], ['tree_oak', 13, 30.5], ['tree_pine', 27, 31], ['tree_big', 33, 34], ['tree_round', 8, 45], ['tree_oak', 27, 46], ['tree_pine', 13, 50], ['tree_round', 33, 50]] as const) prop(n, x, y);
for (const [x, y] of [[24, 35], [10, 36], [30, 43]]) prop('hedge', x, y);
prop('bus_stop', 30, 38.6); prop('bench', 6, 38.4); prop('fountain', 18.5, 46);
o('npc', 'rustam', 32.5, 37.4, { title: 'Рустам · маршрутка 66', kind: 'manBrown', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 90, lines: 'Маршрутка 66 до завода! Только наличные!|Петухов не вожу. Они без масок.' });
for (const [x, y, t] of [[10, 33, 'normal'], [24, 40.5, 'fast'], [14, 44, 'normal'], [30, 48, 'spitter'], [6, 50, 'fast'], [35, 30, 'normal']] as const) enemy(t, x, y, 'park2');
for (const [x, y] of [[3.5, 51.5], [36.5, 51.5], [3.5, 29]]) o('spawner', 'park2', x, y, { how: 'rise' });
o('trigger', 'park2', 3, 28, {}, [35, 25]);
label('СКВЕР «РЕОРГАНИЗАЦИИ»', 18.5, 51.5, 20, '#3f5a38');
o('pickup', 'health', 36, 51); o('pickup', 'armor', 4, 40);

// ---- industrial zone: garage with the watchman's relief, the booth, the gate
for (const [n, x, y] of [['car_grey', 46, 33.4], ['car_burnt', 52, 44.4], ['car_blue_v', 60, 36], ['car_taxi', 74, 43.4]] as const) prop(n, x, y);
for (const [x, y] of [[44, 47], [49, 40], [56, 31.5], [64, 41]]) { prop('crate', x, y); prop('crate_small', x + .7, y + .3); }
o('barrel', '', 47, 46); o('barrel', '', 58, 46); o('barrel', '', 65, 34); o('barrel', '', 69, 42);
prop('pallet', 79, 47); prop('pallet', 41, 33);
label('ГАРАЖ ВАХТЫ', 76.5, 32.4, 16);
// D72: Толик — a mini-boss on a smoke break among beer crates; his garage mates
enemy('fat', 76.5, 35, 'tolik', { dormant: true }); enemy('normal', 74, 36.5, 'garage', { dormant: true }); enemy('fast', 79, 33.5, 'garage', { dormant: true }); enemy('normal', 79.5, 37, 'garage', { dormant: true }); enemy('armored', 73.5, 33, 'garage', { dormant: true });
for (const [x, y] of [[73, 32.2], [74.2, 32.2], [80.5, 35.5], [80.5, 36.6]]) prop('beer_crate', x, y);
prop('ashtray', 77.6, 33.2);
o('trigger', 'garage', 72, 31, {}, [10, 8]);
o('npc', 'semyonych', 64.5, 49.2, { title: 'Вахтёр Семёныч', kind: 'semyon', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 180, lines: 'Пропуск!|Без пропуска не пущу. Даже конец света.' });
prop('terminal', 69, 47.2); o('use', 'gate_panel', 69, 48, { hint: 'открыть ворота завода' });
label('ПРОХОДНАЯ', 68.5, 50.4, 14);
label('ЗАВОД «ПРОВАНСАЛЬ»', 60, 53.6, 28, '#f6d77c');
o('trigger', 'yard', 39, 30, {}, [43, 22]);
for (const [x, y] of [[39, 31], [81, 45], [52, 31], [81, 50.5], [39, 50]]) o('spawner', 'yard', x, y, { how: 'rise' });
o('trigger', 'exit2', 54, 53, { once: false, all: true }, [12, 2]);
o('pickup', 'health', 67.5, 49.8); o('pickup', 'ammo', 70, 50); o('pickup', 'ammo', 45, 50); o('pickup', 'health', 80, 31.5);
note(64, 51.4, 'Объявление: «Экскурсии на завод отменены. Причина: экскурсанты кудахчут»');

const level: LevelSource = {
  id: 'street2', theme: 'street', mapProps: { ambient: 0.12, wallFace: 'street', podLook: 'egg' }, grid: p.rows(), objects,
  legend: {
    '#': { wall: true }, z: { floor: [510] }, k: { floor: [507] }, r: { floor: [502] }, '|': { floor: [504] }, g: { floor: [508, 509] }, p: { floor: [514] },
    c: { floor: [6] }, b: { floor: [507] }, f: { floor: [502] },
    G: { floor: [502], door: { id: 'gate', locked: 'script', theme: 'street' } },
    M: { floor: [514], door: { id: 'market_gate', locked: 'script', theme: 'street' } },
  },
};
export default level;
