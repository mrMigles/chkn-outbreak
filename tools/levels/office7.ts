// Seventh floor: adapted from the supplied office plan, in the game's LPC pixel style.
import { F, type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';
const p = new Painter(72, 44);
p.rect(2, 2, 14, 17, 'g'); // Phoenix / table tennis
p.rect(16, 2, 39, 21, 'g'); // main open space
p.rect(41, 2, 48, 12, 'k'); // kitchen
p.rect(41, 14, 48, 21, 'g'); // utility rooms
p.rect(50, 2, 68, 21, 'g'); // eastern open space
p.rect(2, 23, 64, 26, 'c'); // main horizontal corridor
p.rect(41, 3, 43, 26, 'c'); // central north/south connector
p.rect(2, 28, 14, 40, 'g'); // Sirius
p.rect(16, 28, 23, 40, 'c'); // west stairs / hallway
p.rect(25, 28, 39, 41, 'g'); // southern desks
p.rect(41, 28, 49, 40, 'c'); // lift lobby
p.rect(51, 28, 58, 39, 'g'); // Altair
p.rect(60, 23, 66, 31, 'g'); // Andrey and Sergey at the red mark
// A stepped curved perimeter, matching the plan without changing collision projection.
for (let y = 16; y <= 40; y++) {
  const edge = 69 - Math.floor((y - 16) * 0.52);
  for (let x = edge; x < 72; x++) p.set(x, y, '#');
}
p.rect(8, 18, 10, 22, 'c'); p.rect(27, 22, 29, 27, 'c');
p.rect(19, 27, 20, 27, 'c'); p.rect(8, 27, 10, 27, 'c');
p.rect(44, 27, 46, 27, 'c'); p.rect(54, 27, 56, 27, 'c');
p.rect(49, 8, 49, 10, 'c'); p.rect(49, 19, 49, 25, 'c');
p.rect(59, 24, 61, 26, 'c');
const objects: ObjSpec[] = [];
const obj = (type: string, name: string, x: number, y: number, props?: ObjSpec['props'], size?: [number, number]) => objects.push({ type, name, at: [x, y], props, size });
const prop = (name: string, x: number, y: number) => obj('prop', name, x, y);
const label = (text: string, x: number, y: number) => obj('label', '', x, y, { text, size: 22, color: '#5f6870' });
const desk = (x: number, y: number) => { prop('desk_light', x, y); prop('office_chair', x, y + 1.15); };
for (const x of [19, 24, 29, 34, 37]) for (const y of [4, 9, 14, 19]) desk(x, y);
for (const x of [53, 58, 63, 66]) for (const y of [4, 9, 14, 19]) if (x < 69 - Math.floor(Math.max(0, y - 16) * .52) - 1) desk(x, y);
for (const x of [28, 33, 37]) for (const y of [30, 35, 39]) desk(x, y);
for (const x of [5, 11]) for (const y of [30, 35, 39]) desk(x, y);
for (const x of [62, 65]) desk(x, 29);
prop('table_tennis', 8, 9);
prop('whiteboard', 8, 3); prop('sofa_green', 4, 15); prop('plant', 13, 3);
label('PHOENIX · ПИНГ-ПОНГ', 8, 17);
label('ОПЕНСПЕЙС · CAPELLA', 27, 21);
label('CASTOR', 59, 21); label('SIRIUS', 8, 40);
label('ALTAIR', 54, 38); label('ЭТАЖ 7 · ЛИФТЫ', 45, 37);
prop('counter_a', 46, 3); prop('sink', 47, 3); prop('vending', 47, 11);
prop('table_round', 46, 7); prop('stool', 45, 8.1); prop('plant', 44, 3);
label('КУХНЯ', 46, 10);
prop('cabinet', 47, 15); prop('printer', 46, 19);
prop('elevator', 44, 39); prop('elevator', 47, 39);
prop('whiteboard', 44, 30); prop('plant', 48, 35);
for (let i = 0; i < 4; i++) obj('spawn', 'player', 44 + (i % 2) * 1.5, 35 - Math.floor(i / 2) * 1.4);
for (const [id, title, x, y] of [
  ['andrey', 'Андрей', 62, 27], ['sergey', 'Серёга', 64, 27],
  ['vlad', 'Влад', 46, 9], ['stas', 'Стас', 6, 9], ['pasha', 'Паша', 10, 9],
] as const) obj('npc', id, x, y, { title, mode: 'cower', hp: 200, story: true, essential: true, weapon: id === 'andrey' ? 'smg' : '', lines: 'Мы тут!|Это всё корпоративный напиток!' });
obj('npc', 'root_manager', 45, 29, { title: 'Лысый менеджер', mode: 'idle', hp: 300, story: true, essential: true, lines: 'Вы куда? Рабочий день ещё не окончен.|У меня root-доступ к вашему отпуску.' });
const workers = [[21, 6], [31, 11], [36, 16], [55, 6], [61, 11], [57, 17], [30, 32], [6, 33], [54, 33]];
workers.forEach(([x, y], i) => obj('npc', 'f7_worker' + i, x, y, { title: ['Скрам-мастер', 'Ко-коуч', 'Стажёр', 'Куриный евангелист'][i % 4], kind: i % 2 ? 'manBrown' : 'womanGreen', tag: 'worker7', turn: i % 4 === 0 ? 'fast' : 'normal', lines: 'Это не баг, это перья.|Митинг можно было заменить яйцом.' }));
obj('npc', 'coffee_intern', 47, 7.8, { title: 'Стажёр с кофе', kind: 'worker', mode: 'cower', hp: 100, weapon: 'pistol', lines: 'Я только чашки помыть зашёл!' });
for (const [x, y] of [[4, 24], [27, 24], [55, 24], [42, 5], [20, 37], [35, 32], [62, 5]]) obj('spawner', 'escort', x, y, { how: 'rise', corridorOnly: true });
obj('trigger', 'east', 50, 3, {}, [17, 19]);
obj('trigger', 'pingpong', 2, 3, {}, [13, 15]);
obj('trigger', 'root_ambush', 41, 28, { once: false }, [9, 4]);
obj('trigger', 'evacuation', 41, 34, { once: false, all: true }, [9, 7]);
obj('pickup', 'weapon', 43, 33, { weapon: 'shotgun' });
for (const [x, y] of [[45, 34], [42, 24], [46, 9], [8, 14], [63, 25]]) obj('pickup', 'ammo', x, y);
obj('pickup', 'health', 44, 33);
obj('note', '', 44, 30, { text: 'План эвакуации: 1. Сохраняйте спокойствие. 2. Не сохраняйте Excel. 3. Бегите.' });
obj('note', '', 46, 4, { text: 'КУКАРЕКС — пилотная партия лаборатории −3. Не смешивать с кофе. Не выдавать сотрудникам. Подпись: менеджер.' });
const level: LevelSource = { id: 'office7', theme: 'office', mapProps: { ambient: 0, wallFace: 'office7' }, grid: p.rows(), legend: {
  '#': { wall: true }, g: { floor: [500] }, c: { floor: [501] }, k: { floor: F.white },
}, objects };
export default level;
