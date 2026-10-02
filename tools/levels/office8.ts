// Floor 8 «Тёмная тема» (D69): an office in the dark. Sleeping red-eyed chickens, two wings with one safety
// release each (split up, or Неля takes the other one), Валера's den with the breaker, a service lift behind it.
import { type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';

const p = new Painter(64, 46);
p.rect(26, 34, 37, 43, 'l');   // arrival lift lobby
p.rect(3, 29, 60, 31, 'c');    // main corridor
p.rect(30, 32, 33, 33, 'c');   // lobby → corridor
p.rect(3, 3, 22, 27, 'a');     // west wing: accounting and the archive
p.rect(12, 28, 13, 28, 'c');   // west wing door gap
p.rect(44, 3, 60, 27, 's');    // east wing: sales and meeting rooms
p.rect(51, 28, 52, 28, 'c');   // east wing door gap
p.rect(29, 17, 32, 28, 'c');   // north corridor to the den
p.rect(25, 3, 36, 16, 'd');    // Валера's den («серверная тёмной темы»)
p.rect(38, 3, 42, 10, 'l');    // service lift
// archive shelves (west) and glass meeting rooms (east)
for (const y of [6, 10, 14]) { p.rect(4, y, 9, y, '#'); p.rect(15, y, 20, y, '#'); }
p.rect(44, 13, 51, 13, '#'); p.rect(54, 13, 60, 13, '#'); p.rect(51, 8, 51, 12, '#'); p.rect(54, 8, 54, 12, '#');
p.rect(44, 20, 49, 20, '#'); p.rect(55, 20, 60, 20, '#');
// doors
p.rect(29, 21, 32, 21, 'D');  // the double-locked door to the den
p.set(37, 6, 'S'); p.set(37, 7, 'S'); // den → service lift (opens when the light is back)
p.rect(12, 28, 13, 28, 'W'); p.rect(51, 28, 52, 28, 'E');
p.rect(30, 33, 33, 33, 'L');

const objects: ObjSpec[] = [];
const o = (type: string, name: string, x: number, y: number, props?: ObjSpec['props'], size?: [number, number]) => objects.push({ type, name, at: [x, y], props, size });
const prop = (name: string, x: number, y: number, props?: ObjSpec['props']) => o('prop', name, x, y, props);
const label = (text: string, x: number, y: number, size = 20) => o('label', '', x, y, { text, size, color: '#7d8aa6' });
const note = (x: number, y: number, text: string) => o('note', '', x, y, { text });
const light = (x: number, y: number, kind: string, color: string, radius: number, extra: ObjSpec['props'] = {}) => o('light', '', x, y, { kind, color, radius, ...extra });
const sleeper = (type: string, x: number, y: number, tag: string) => o('enemy', type, x, y, { tag, dormant: true });
const desk = (x: number, y: number, glow = false) => { prop('desk', x, y); prop('office_chair', x, y + 1.15); if (glow) light(x, y - .2, 'lamp', '3d6bff', 90, { flicker: .15 }); };

// ---- lobby: Неля, the only working lamp, a vending machine
prop('elevator', 29.5, 35.1); prop('elevator', 34, 35.1);
for (let i = 0; i < 4; i++) o('spawn', 'player', 30 + (i % 2) * 2, 39.5 + Math.floor(i / 2) * 1.3);
o('npc', 'nelya', 33.5, 41, { title: 'Неля · бухгалтерия', mode: 'idle', hp: 120, story: true, essential: true, untargetable: true, weapon: 'pistol', angle: 180, lines: 'Тут Валера из IT выкрутил все лампочки.|Он даже на кофемашине тёмную тему включил.' });
light(31.5, 38, 'lamp', 'ffe2a8', 260, { flicker: 0.55 });
light(27, 42, 'emergency', 'ff2a1a', 200);
prop('vending', 36.3, 35.2); prop('plant', 26.6, 35.3); prop('water_cooler', 27.3, 42.6);
label('ЭТАЖ 8 · ТЁМНАЯ ТЕМА', 31.5, 37.4, 22);
o('pickup', 'health', 36.5, 42.5); o('pickup', 'ammo', 26.8, 39);
note(35.5, 37, 'Объявление: «С понедельника весь этаж переходит на тёмную тему. Лампы сданы в IT. — Валера»');

// ---- corridor: a sleeping row, the vent scare, a flicker that shows what stands there
for (const [x, t] of [[6, 'normal'], [9, 'fast'], [17, 'normal'], [22, 'normal'], [40, 'normal'], [45, 'fast'], [56, 'normal'], [59, 'spitter']] as const) sleeper(t, x, 30, 'corridor');
for (const x of [8, 20, 43, 58]) light(x, 29.2, 'emergency', 'ff2a1a', 150);
o('trigger', 'scare_flicker', 24, 29, {}, [16, 3]);
o('trigger', 'scare_vent', 29, 23, {}, [4, 4]);
o('spawner', 'vent', 30.5, 25, { how: 'vent' }); o('spawner', 'vent', 31.5, 25.5, { how: 'vent' });
for (const [x, y] of [[4, 30], [60, 30], [30.5, 18]]) o('spawner', 'dark', x, y, { how: 'vent', corridorOnly: true });

// ---- west wing: accounting desks and the archive maze; the west safety release in the far corner
for (const x of [5.5, 11, 17]) desk(x, 23, x === 11);
for (const x of [5.5, 17]) desk(x, 18);
prop('printer', 12, 17.3); o('trigger', 'scare_printer', 9, 16, {}, [7, 5]);
for (const [x, y] of [[4.5, 8], [8, 8], [16, 8], [19.5, 8], [4.5, 12], [19.5, 12]]) prop('cabinet', x, y - .7);
prop('shelf', 12, 4); prop('shelf', 14, 4);
for (const [x, y, t] of [[6, 21, 'normal'], [15, 21, 'normal'], [20, 18, 'fast'], [10, 12, 'normal'], [13, 9, 'spitter'], [6, 4.5, 'normal'], [19, 4.5, 'fast'], [3.6, 16, 'normal'], [12, 25.5, 'normal']] as const) sleeper(t, x, y, 'west');
prop('terminal', 4.5, 3.6); o('use', 'lock_w', 4.5, 4.4, { hint: 'взвести западный размыкатель' });
light(4.5, 4.3, 'lamp', 'ff4040', 110, { flicker: .3 });
label('БУХГАЛТЕРИЯ · АРХИВ', 12, 26.4);
note(13.5, 23.2, 'Квартальный отчёт: «Свет — 0 руб. Лампы — сданы. Нервы — на исходе»');
o('pickup', 'ammo', 21, 25.5); o('pickup', 'weapon', 21, 4.5, { weapon: 'shotgun' });
o('trigger', 'west', 3, 3, {}, [20, 25]);

// ---- east wing: sales, two glass meeting rooms; the phone scare; the east release
for (const x of [46, 50, 57]) desk(x, 24.5, x === 57);
for (const x of [46, 58]) desk(x, 17);
prop('table_long', 47.5, 9); prop('table_long', 57.5, 9);
prop('desk_phone', 47.2, 8.8);
o('trigger', 'scare_phone', 44, 14, {}, [17, 6]);
o('trigger', 'phone_near', 44, 6, {}, [7, 6]);
o('enemy', 'normal', 47.5, 10.4, { tag: 'phone', dormant: true });
for (const [x, y, t] of [[48, 22.5, 'normal'], [56, 22, 'fast'], [52, 16, 'normal'], [59.5, 16, 'spitter'], [45, 4.5, 'fast'], [57, 5, 'normal'], [59.5, 11, 'normal'], [52.5, 4.5, 'armored']] as const) sleeper(t, x, y, 'east');
prop('terminal', 59, 3.6); o('use', 'lock_e', 59, 4.4, { hint: 'взвести восточный размыкатель' });
light(59, 4.3, 'lamp', 'ff4040', 110, { flicker: .3 });
label('ОТДЕЛ ПРОДАЖ', 52, 26.4);
label('ПЕРЕГОВОРНАЯ «ОПТИМИЗМ»', 47.5, 12.2, 14); label('ПЕРЕГОВОРНАЯ «РЕАЛИЗМ»', 57.5, 12.2, 14);
note(50, 24.9, 'Стикер на мониторе: «Сделка века: продать фонарик Валере». Зачёркнуто.');
o('pickup', 'health', 44.6, 26); o('pickup', 'armor', 60, 18);
o('trigger', 'east', 44, 3, {}, [17, 25]);

// ---- the den: Валера at his desk, the breaker on the north wall
prop('server_rack', 26, 3.6); prop('server_rack', 27.2, 3.6); prop('server_rack', 35.8, 9.6);
prop('desk', 30.5, 9); prop('office_chair', 30.5, 10.2); prop('desk_phone', 29.6, 8.8);
o('npc', 'valera', 30.5, 10.3, { title: 'Валера · тимлид тёмной темы', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 90 });
light(30.5, 8.7, 'lamp', '3d6bff', 150, { flicker: .1 });
prop('breaker', 34.5, 3.1); o('use', 'breaker', 34.5, 4.1, { hint: 'включить рубильник' });
o('trigger', 'den', 25, 11, {}, [12, 6]);
for (const [x, y] of [[26, 15.5], [36, 15.5], [26, 5], [36, 4.5]]) o('spawner', 'den', x, y, { how: 'vent' });
label('СЕРВЕРНАЯ ТЁМНОЙ ТЕМЫ', 30.5, 14.6, 18);
note(32.5, 8.6, 'На мониторе: «Не включайте свет. У меня мигрень, дедлайн и тёмная тема». Ниже: «Артём, перезвони»');
o('pickup', 'ammo', 26.5, 12.5); o('pickup', 'health', 35.5, 12.5);

// ---- service lift
prop('elevator', 40, 3.6);
o('trigger', 'lift8', 38, 3, { once: false, all: true }, [5, 8]);
label('СЛУЖЕБНЫЙ ЛИФТ', 40, 9.6, 16);

const level: LevelSource = {
  id: 'office8', theme: 'dark', mapProps: { ambient: 0.94, wallFace: 'dark', stealth: true, redEyes: true }, grid: p.rows(), objects,
  legend: {
    '#': { wall: true }, l: { floor: [511] }, c: { floor: [511] }, a: { floor: [511] }, s: { floor: [511] }, d: { floor: [511] },
    D: { floor: [511], door: { id: 'dark_door', locked: 'script', theme: 'dark' } },
    S: { floor: [511], door: { id: 'service', locked: 'script', theme: 'dark' } },
    W: { floor: [511], door: { id: 'west_door', theme: 'dark' } },
    E: { floor: [511], door: { id: 'east_door', theme: 'dark' } },
    L: { floor: [511], door: { id: 'lobby_door', theme: 'dark' } },
  },
};
export default level;
