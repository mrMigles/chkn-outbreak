// Floor 11 «Начальство» (D69): reception, three visas (finance, HR, legal), a 75-second board meeting and the
// executive director. His private lift goes up to the 12th-floor cafe.
import { F, type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';

const p = new Painter(66, 46);
p.rect(28, 2, 37, 8, 'l');     // lift hall (arrival)
p.rect(31, 9, 34, 9, 'l');
p.rect(25, 10, 40, 18, 'r');   // reception
p.rect(31, 19, 34, 19, 'c');
p.rect(3, 20, 62, 22, 'c');    // main corridor
p.rect(3, 3, 19, 17, 'w');     // finance (Борис)
p.rect(10, 18, 11, 19, 'c');
p.rect(44, 3, 62, 17, 'w');    // HR open space + Ирина's office
p.rect(52, 18, 53, 19, 'c');
p.rect(54, 3, 54, 12, '#'); p.set(54, 8, 'w'); p.set(54, 9, 'w'); // Ирина's glass office wall with a gap
p.rect(3, 24, 20, 42, 'a');    // legal archive (Пунктович)
p.rect(10, 23, 11, 23, 'c');
for (const y of [28, 32, 36]) { p.rect(4, y, 9, y, '#'); p.rect(13, y, 19, y, '#'); }
p.rect(24, 26, 41, 42, 'b');   // boardroom
p.rect(31, 23, 34, 25, 'c');
p.rect(44, 26, 62, 42, 'x');   // director's office
p.rect(42, 33, 43, 34, 'x');
// doors
p.rect(31, 25, 34, 25, 'B');   // boardroom double door (three visas)
p.set(42, 33, 'X'); p.set(42, 34, 'X'); // boardroom → director (after the meeting)
p.rect(10, 18, 11, 18, 'f'); p.rect(52, 18, 53, 18, 'h'); p.rect(10, 23, 11, 23, 'g');

const objects: ObjSpec[] = [];
const o = (type: string, name: string, x: number, y: number, props?: ObjSpec['props'], size?: [number, number]) => objects.push({ type, name, at: [x, y], props, size });
const prop = (name: string, x: number, y: number, props?: ObjSpec['props']) => o('prop', name, x, y, props);
const label = (text: string, x: number, y: number, size = 20) => o('label', '', x, y, { text, size, color: '#6b5440' });
const note = (x: number, y: number, text: string) => o('note', '', x, y, { text });
const enemy = (type: string, x: number, y: number, tag: string) => o('enemy', type, x, y, { tag });
const desk = (x: number, y: number) => { prop('desk_b', x, y); prop('office_chair', x, y + 1.15); };

// ---- lift hall
prop('elevator', 31, 3.1); prop('elevator', 34.5, 3.1);
for (let i = 0; i < 4; i++) o('spawn', 'player', 31.5 + (i % 2) * 2, 5.8 + Math.floor(i / 2) * 1.2);
prop('plant', 28.6, 3.3); prop('plant', 37.4, 3.3); prop('painting_wide', 32.75, 2.6);
label('ЭТАЖ 11 · РУКОВОДСТВО', 32.75, 7.6, 22);
note(36.5, 6, 'Табличка: «Посторонним и пернатым — только по записи»');

// ---- reception: Жанна
prop('reception', 32.5, 12.6);
o('npc', 'zhanna', 32.5, 11.6, { title: 'Жанна Аркадьевна · приёмная', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 90 });
prop('sofa_dark', 27.5, 16.6); prop('coffee_table', 27.5, 15.3); prop('sofa_dark', 37.5, 16.6); prop('plant', 39.4, 10.6); prop('plant', 25.6, 10.6);
prop('portrait_ceo', 32.5, 10.1);
prop('vending', 39.2, 14, { incident: 'coffee', incidentId: 'incident_coffee11' });
o('use', 'incident_coffee11', 39.2, 14.8, { incident: 'coffee', hint: 'кофе: +15 HP и бег на 10 сек' });
label('ПРИЁМНАЯ', 32.5, 17.6);
o('trigger', 'reception', 25, 10, { npc: 'punktovich', once: false }, [16, 9]);
o('pickup', 'ammo', 26, 12); o('pickup', 'health', 39, 17);

// ---- corridor
for (const x of [6, 22, 44, 60]) prop('plant', x, 20.4);
o('npc', 'intern11', 46, 21, { title: 'Стажёр Гоша · 40 слайдов', kind: 'manBrown', mode: 'idle', hp: 80, turn: 'fast', lines: 'Я сорок слайдов готовил! Где совещание?' });
for (const [x, y] of [[4, 21], [61, 21], [24, 21.5], [41, 21.5]]) o('spawner', 'corridor', x, y, { how: 'rise', corridorOnly: true });

// ---- finance: Борис is barricaded, the department has «optimised» itself
for (const x of [5, 9, 13]) for (const y of [7, 12]) desk(x, y);
prop('cabinet', 17.5, 3.6); prop('cabinet', 18.6, 3.6); prop('table_big', 16.5, 13.5);
o('npc', 'boris', 17, 6, { title: 'Борис Сальдович · финдиректор', mode: 'cower', hp: 200, story: true, essential: true, untargetable: true, angle: 180, lines: 'Сократите их! Сократите их всех!' });
for (const [x, y, t] of [[6, 9.5, 'normal'], [11, 9.5, 'fast'], [14, 5, 'normal'], [7, 15, 'spitter'], [12, 15, 'normal'], [16, 10, 'fat']] as const) enemy(t, x, y, 'fin');
o('trigger', 'finance', 3, 3, {}, [17, 15]);
for (const [x, y] of [[4, 4], [4, 16]]) o('spawner', 'fin', x, y, { how: 'vent' });
label('ФИНАНСОВЫЙ ДЕПАРТАМЕНТ', 11, 16.6);
note(9, 7.8, 'Бюджет на 2025: «Курица — 0. Петух — 0. Антидот — не предусмотрен»');
o('pickup', 'ammo', 4, 10);

// ---- HR: open space with desks, Ирина's glass office; three forms lie around the floor
for (const x of [46, 50]) for (const y of [6, 11, 15]) desk(x, y);
prop('sofa_orange', 59, 15.6); prop('table_round', 59, 13); prop('plant', 61.5, 3.4); prop('whiteboard', 49, 3.1);
o('npc', 'irina', 59, 6.5, { title: 'Ирина Тимбилдинговна · HR', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 180 });
o('use', 'form1', 46, 15.7, { hint: 'взять анкету удовлетворённости' });
o('use', 'form2', 5, 21.6, { hint: 'взять анкету удовлетворённости' });
o('use', 'form3', 17.5, 40, { hint: 'взять анкету удовлетворённости' });
for (const [x, y] of [[44.5, 4], [62, 16.5], [3.5, 21], [18, 41]]) o('spawner', 'hr', x, y, { how: 'vent' });
label('HR · ОТДЕЛ СЧАСТЬЯ', 53, 16.6);
note(49, 4.1, 'Доска: «Ценности компании: 1. Лояльность 2. Перья 3. Синергия»');
o('pickup', 'health', 62, 10);

// ---- legal archive: Пунктович hides at the back
for (const x of [5, 8, 15, 18]) for (const y of [26, 30, 34]) prop('shelf', x, y + .2);
o('npc', 'punktovich', 5, 40.5, { title: 'Аркадий Пунктович · юрист', mode: 'cower', hp: 200, story: true, essential: true, untargetable: true, angle: 0, lines: 'Согласно пункту 4.2, я боюсь!' });
for (const [x, y, t] of [[7, 25.5, 'normal'], [16, 25.5, 'normal'], [12, 30, 'fast'], [6, 34, 'spitter'], [17, 34, 'normal'], [12, 38, 'armored'], [9, 41, 'fast']] as const) enemy(t, x, y, 'law');
o('trigger', 'archive', 3, 24, {}, [18, 19]);
label('ЮРИДИЧЕСКИЙ ОТДЕЛ · АРХИВ', 11.5, 43.2);
note(16, 41.5, 'Договор с поставщиком КУКАРЕКСА. Мелкий шрифт: «Возможны побочные эффекты: перья, гребень, кудахтанье»');
o('pickup', 'ammo', 19, 25); o('pickup', 'armor', 3.6, 30);

// ---- boardroom: the 75-second meeting
prop('table_big', 32.5, 34.5); prop('table_big', 32.5, 30);
for (const y of [29, 31, 34, 36]) { prop('office_chair', 30, y); prop('office_chair', 35, y); }
prop('tv', 32.5, 26.6); prop('whiteboard', 27, 26.1); prop('plant', 24.6, 41.4); prop('plant', 40.4, 41.4);
label('ПЕРЕГОВОРНАЯ СОВЕТА', 32.5, 40.8, 24);
note(28, 27, 'Повестка: 1. KPI. 2. Ещё раз KPI. 3. Кукарекс-брейк. 4. Кто съел мой йогурт');
for (const [x, y] of [[25, 27], [40, 27], [25, 41.5], [40, 41.5], [33, 41.5]]) o('spawner', 'meeting', x, y, { how: 'vent' });
o('trigger', 'boardroom', 24, 26, { once: false }, [18, 17]);
o('pickup', 'health', 25, 34); o('pickup', 'health', 40.5, 30); o('pickup', 'ammo', 40.5, 34); o('pickup', 'ammo', 25, 29); o('pickup', 'armor', 32.5, 27.6); o('pickup', 'weapon', 32.5, 38, { weapon: 'rifle' });

// ---- director's office and his private lift
prop('table_big', 53, 33); prop('office_chair', 53, 31); prop('portrait_ceo', 53, 26.1); prop('aquarium', 60, 39); prop('sofa_dark', 47, 40.6);
prop('elevator', 59.5, 27.1);
o('npc', 'director', 53, 31.6, { title: 'Исполнительный директор', mode: 'idle', hp: 300, story: true, essential: true, untargetable: true, angle: 90 });
o('trigger', 'lift11', 56, 26, { once: false, all: true }, [7, 5]);
for (const [x, y] of [[45, 27], [61.5, 41.5]]) o('spawner', 'board11', x, y, { how: 'vent' });
label('ЛИЧНЫЙ ЛИФТ · 12 ЭТАЖ', 59.5, 31.4, 14);
label('КАБИНЕТ ДИРЕКТОРА', 53, 41.6);

const level: LevelSource = {
  id: 'office11', theme: 'exec', mapProps: { ambient: 0, wallFace: 'exec' }, grid: p.rows(), objects,
  legend: {
    '#': { wall: true }, l: { floor: [512] }, r: { floor: [513] }, c: { floor: [512] }, w: { floor: F.wood }, a: { floor: F.woodLight },
    b: { floor: [512] }, x: { floor: F.wood },
    B: { floor: [512], door: { id: 'board_door', locked: 'script', theme: 'exec' } },
    X: { floor: F.wood, door: { id: 'director_door', locked: 'script', theme: 'exec' } },
    f: { floor: [512], door: { id: 'fin_door', theme: 'exec' } },
    h: { floor: [512], door: { id: 'hr_door', theme: 'exec' } },
    g: { floor: [512], door: { id: 'law_door', theme: 'exec' } },
  },
};
export default level;
