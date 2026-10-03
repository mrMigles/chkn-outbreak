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
// D72: «Уединение» — a tiny meeting room off the Phoenix connector; its door opens with a button (Стас and Катя inside).
p.rect(11, 18, 17, 18, '#'); p.rect(17, 18, 17, 22, '#'); p.rect(11, 22, 17, 22, '#');
p.rect(12, 19, 16, 21, 'm');
p.set(11, 20, 'K');
// Castor's last office has a single card-reader entrance. No northern/southern bypass.
p.rect(59, 22, 67, 22, '#'); p.rect(59, 23, 59, 31, '#'); p.rect(60, 31, 64, 31, '#');
p.rect(59, 25, 59, 26, 'D');
const objects: ObjSpec[] = [];
const obj = (type: string, name: string, x: number, y: number, props?: ObjSpec['props'], size?: [number, number]) => objects.push({ type, name, at: [x, y], props, size });
const prop = (name: string, x: number, y: number, props?: ObjSpec['props']) => obj('prop', name, x, y, props);
const label = (text: string, x: number, y: number) => obj('label', '', x, y, { text, size: 22, color: '#5f6870' });
const desk = (x: number, y: number) => { prop('desk_light', x, y); prop('office_chair', x, y + 1.15); };
for (const x of [19, 24, 29, 34, 37]) for (const y of [4, 9, 14, 19]) desk(x, y);
for (const x of [53, 58, 63, 66]) for (const y of [4, 9, 14, 19]) if (x < 69 - Math.floor(Math.max(0, y - 16) * .52) - 1) desk(x, y);
for (const x of [28, 33, 37]) for (const y of [30, 35, 39]) desk(x, y);
for (const x of [5, 11]) for (const y of [30, 35, 39]) desk(x, y);
desk(62, 30);
prop('table_tennis', 8, 9);
prop('whiteboard', 8, 3); prop('sofa_green', 4, 15); prop('plant', 13, 3);
label('PHOENIX · ПИНГ-ПОНГ', 8, 17);
label('ОПЕНСПЕЙС · CAPELLA', 27, 21);
label('CASTOR', 59, 21); label('SIRIUS', 8, 40);
label('ALTAIR', 54, 38); label('ЭТАЖ 7 · ЛИФТЫ', 45, 37);
prop('counter_a', 46, 3); prop('sink', 47, 3);
prop('vending', 47, 11, { incident: 'coffee', incidentId: 'incident_coffee7' });
obj('use', 'incident_coffee7', 47, 11.8, { incident: 'coffee', hint: 'кофе: +15 HP и бег на 10 сек' });
label('КОФЕ · 1 ПОРЦИЯ', 46, 12.4);
prop('table_round', 46, 7); prop('office_chair', 45, 8.1); prop('plant', 44, 3);
label('КУХНЯ', 46, 10);
prop('cabinet', 47, 15); prop('printer', 46, 19);
prop('elevator', 44, 39); prop('elevator', 47, 39);
prop('whiteboard', 44, 30); prop('plant', 48, 35);
for (let i = 0; i < 4; i++) obj('spawn', 'player', 44 + (i % 2) * 1.5, 35 - Math.floor(i / 2) * 1.4);
for (const [id, title, x, y] of [
  ['andrey', 'Андрей', 61.5, 27], ['sergey', 'Серёга', 63, 27],
  ['vlad', 'Влад', 46, 9], ['stas', 'Стас', 13.4, 20.6], ['pasha', 'Паша', 10, 9],
] as const) obj('npc', id, x, y, { title, mode: id === 'stas' || id === 'pasha' ? 'idle' : 'cower', hp: 200, story: true, essential: true, rescueLock: id === 'andrey' || id === 'sergey' ? 'f7_pass' : '', weapon: id === 'andrey' ? 'smg' : '', angle: id === 'stas' ? 0 : id === 'pasha' ? 180 : 90, lines: id === 'pasha' ? 'До одиннадцати! Потом эвакуация.|Петух под сеткой? Это фол!' : id === 'stas' ? 'Это не то, что вы подумали!|Мы… дебажили!' : 'Мы тут!|Это всё корпоративный напиток!' });
// D72: Лера (QA) plays ping-pong with Паша — she can come along; Катя waits with Стас in «Уединение»
obj('npc', 'lera', 6, 9, { title: 'Лера · тестировщица', mode: 'idle', hp: 120, story: true, essential: true, angle: 0, lines: 'Нашла баг: у петухов нет хитбокса на гребне!|Подача! Ой, это был петух.' });
obj('npc', 'katya', 15.4, 20.4, { title: 'Катя', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 180, lines: 'Мы тут… обсуждаем спринт!|Стасик, кто это?' });
prop('heart_bed', 14.4, 20.9); prop('kink_rack', 12.8, 19.1); prop('poster_kink', 15, 19.1); prop('poster_kink2', 16.3, 19.1);
prop('fluffy_cuffs', 12.6, 21.5); prop('disco_lamp', 16.4, 21.4);
obj('light', '', 14.5, 20, { kind: 'lamp', color: 'ff4fa8', radius: 150, flicker: .2 });
prop('button_panel', 10.6, 19.15);
obj('use', 'kink_button', 10.5, 19.6, { hint: 'нажать кнопку двери «Уединения»' });
label('«УЕДИНЕНИЕ»', 14.5, 22.6);
// D73: frosted glass until the door opens — silhouettes and the pink light show through
obj('frost', 'kink_glass', 12, 17.3, { door: 'kink_door', label: 'ЗАНЯТО' }, [5, 4.7]);
obj('note', '', 9.2, 21.6, { text: 'Табличка на двери: «Переговорка “Уединение”. Бронь: Стас + Катя, 17:00–∞. Тема: “дебаг”. НЕ БЕСПОКОИТЬ»' });
obj('npc', 'elena', 46, 17, { title: 'Елена · офис-администратор', kind: 'womanGreen', mode: 'idle', hp: 100, story: true, essential: true, lines: 'Пропуск у меня. Только через корпоративный портал.|Сначала разгоните стаю у Castor!' });
for (const [i, [x, y]] of [[54, 24], [56, 24], [57.4, 25], [55, 26], [57, 28], [54, 29]].entries()) obj('npc', 'gate_worker' + i, x, y, { title: 'Сотрудник у Castor', kind: i % 2 ? 'worker' : 'manBrown', tag: 'gate_workers', turn: i === 0 ? 'armored' : i % 2 ? 'fast' : 'normal' });
obj('npc', 'root_manager', 45, 29, { title: 'Лысый менеджер', mode: 'idle', hp: 300, story: true, essential: true, lines: 'Вы куда? Рабочий день ещё не окончен.|У меня root-доступ к вашему отпуску.' });
const workers = [[21, 6], [31, 11], [36, 16], [55, 6], [61, 11], [57, 17], [30, 32], [6, 33], [54, 33]];
workers.forEach(([x, y], i) => obj('npc', 'f7_worker' + i, x, y, { title: ['Скрам-мастер', 'Ко-коуч', 'Стажёр', 'Куриный евангелист'][i % 4], kind: i % 2 ? 'manBrown' : 'womanGreen', tag: 'worker7', turn: i % 4 === 0 ? 'fast' : 'normal', lines: 'Это не баг, это перья.|Митинг можно было заменить яйцом.' }));
obj('npc', 'coffee_intern', 47, 7.8, { title: 'Стажёр с кофе', kind: 'worker', mode: 'cower', hp: 100, weapon: 'pistol', lines: 'Я только чашки помыть зашёл!' });
for (const [x, y] of [[4, 24], [27, 24], [55, 24], [42, 5], [20, 37], [35, 32], [62, 5]]) obj('spawner', 'escort', x, y, { how: 'rise', corridorOnly: true });
obj('trigger', 'east', 50, 3, {}, [17, 19]);
obj('trigger', 'siege7', 52, 23, { once: false }, [7, 5]);
obj('spawner', 'siege7', 55, 21, { how: 'rise', corridorOnly: true });
obj('spawner', 'siege7', 42, 24, { how: 'rise', corridorOnly: true });
obj('trigger', 'pingpong', 2, 3, {}, [13, 15]);
obj('trigger', 'root_ambush', 41, 28, { once: false }, [9, 4]);
obj('trigger', 'evacuation', 41, 34, { once: false, all: true }, [9, 7]);
obj('pickup', 'weapon', 43, 33, { weapon: 'shotgun' });
obj('pickup', 'weapon', 46, 33, { weapon: 'smg' });
for (const [x, y] of [[45, 34], [42, 24], [46, 9], [8, 14], [63, 25]]) obj('pickup', 'ammo', x, y);
obj('pickup', 'health', 44, 33);
obj('note', '', 44, 30, { text: 'План эвакуации: 1. Сохраняйте спокойствие. 2. Не сохраняйте Excel. 3. Бегите.' });
obj('note', '', 46, 4, { text: 'КУКАРЕКС — пилотная партия лаборатории −3. Не смешивать с кофе. Не выдавать сотрудникам. Подпись: менеджер.' });
// Optional hazard in the west hallway. The lift, story gate and manager remain clear.
prop('terminal', 21, 31, { incident: 'alarm', incidentId: 'incident_alarm7' });
obj('use', 'incident_alarm7', 21, 31.75, { incident: 'alarm', group: 'escort', hint: 'обезвредить сигналку' });
label('СИГНАЛКА · НЕ СТРЕЛЯТЬ', 20.5, 29.5);
obj('note', '', 21.8, 32.5, { text: 'Инструкция: «При пожаре нажмите кнопку. При петухах сначала подумайте». Последнюю строку дописала охрана.' });
obj('note', '', 45, 11.8, { text: 'Кофе проверен: бодрит, лечит, не несётся. Одна порция на команду. Бухгалтерия опять считает чашки.' });
const level: LevelSource = { id: 'office7', theme: 'office7', mapProps: { ambient: 0, wallFace: 'office7' }, grid: p.rows(), legend: {
  '#': { wall: true }, g: { floor: [500] }, c: { floor: [501] }, k: { floor: F.white },
  D: { floor: [501], door: { id: 'castor_lock', locked: 'f7_pass', theme: 'office7' } },
  m: { floor: F.woodRed },
  K: { floor: [501], door: { id: 'kink_door', locked: 'script', theme: 'office7' } },
}, objects };
export default level;
