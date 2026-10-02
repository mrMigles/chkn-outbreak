// Level 1 — the office of «Курникс Групп». Friday 17:55, the new energy drink «КУКАРЕКС» kicks in.
import { F, type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';

const P = new Painter(60, 40);
// rooms
P.rect(1, 1, 23, 12, ',');    // open space «Инкубатор»
P.rect(25, 1, 36, 12, 'k');   // kitchen
P.rect(38, 1, 46, 12, 's');   // server room
P.rect(48, 1, 58, 12, 'e');   // elevator hall
P.rect(1, 14, 58, 16, '.');   // corridor
P.rect(1, 18, 20, 38, 'r');   // lobby / reception
P.rect(22, 18, 30, 26, 'g');  // security
P.rect(22, 28, 30, 38, 'w');  // toilet
P.rect(32, 18, 40, 26, 'm');  // meeting room «Прорыв»
P.rect(32, 28, 40, 38, 'm');  // meeting room «Синергия»
P.rect(42, 18, 58, 38, 'c');  // cafeteria «Насест»
// structure inside rooms
P.rect(11, 5, 11, 6, '#');    // open-space pillars
P.rect(47, 24, 47, 25, '#'); P.rect(53, 24, 53, 25, '#'); P.rect(47, 31, 47, 32, '#'); P.rect(53, 31, 53, 32, '#');
P.rect(22, 33, 25, 33, '#'); P.rect(22, 30, 23, 30, '#'); P.rect(26, 30, 27, 30, '#'); // toilet stalls
// doors
P.rect(10, 13, 11, 13, 'A');  // open space → corridor
P.rect(24, 5, 24, 6, 'B');    // open space → kitchen
P.rect(30, 13, 31, 13, 'C');  // kitchen → corridor
P.set(42, 13, 'D');           // server room (key: server)
P.rect(52, 13, 55, 13, 'E');  // elevator hall (power)
P.rect(9, 17, 11, 17, 'G');   // corridor → lobby
P.set(26, 17, 'H');           // security (key: blue)
P.set(21, 34, 'J');           // lobby → toilet
P.set(36, 17, 'K');           // corridor → «Прорыв»
P.set(36, 27, 'L');           // «Прорыв» → «Синергия»
P.rect(48, 17, 50, 17, 'M');  // corridor → cafeteria
P.set(41, 35, 'N');           // «Синергия» → cafeteria

const at = (x: number, y: number): [number, number] => [x, y];
const objs: ObjSpec[] = [];
const prop = (name: string, x: number, y: number, rot = 0, props?: ObjSpec['props']) => objs.push({ type: 'prop', name, at: at(x, y), rot, props });
const note = (x: number, y: number, text: string) => objs.push({ type: 'note', at: at(x, y), props: { text } });
const label = (x: number, y: number, text: string, size = 26) => objs.push({ type: 'label', at: at(x, y), props: { text, size } });
const enemy = (type: string, x: number, y: number, tag: string, aggro = false) => objs.push({ type: 'enemy', name: type, at: at(x, y), props: { tag, aggro } });
const pickup = (name: string, x: number, y: number, props?: ObjSpec['props']) => objs.push({ type: 'pickup', name, at: at(x, y), props });
const spawner = (name: string, x: number, y: number, how = 'vent') => objs.push({ type: 'spawner', name, at: at(x, y), props: { how } });
const trigger = (name: string, x: number, y: number, w: number, h: number, props?: ObjSpec['props']) => objs.push({ type: 'trigger', name, at: at(x, y), size: [w, h], props });
const light = (x: number, y: number, kind: string, color = 'ff2a1a', radius = 230) => objs.push({ type: 'light', at: at(x, y), props: { kind, color, radius } });

// ---------------------------------------------------------------- open space «Инкубатор»
for (const [i, x] of [3.2, 7.4, 15.4, 19.6].entries()) for (const [j, y] of [2.6, 6.2, 9.8].entries()) {
  prop((i + j) % 2 ? 'desk' : 'desk_b', x, y);
  prop('office_chair', x + ((i + j) % 3 - 1) * 0.15, y + 0.85, (i * 40 + j * 70) % 360);
}
prop('plant', 1.6, 1.5); prop('plant', 22.4, 11.4); prop('plant', 12.6, 11.5);
prop('printer', 22.2, 1.6); prop('water_cooler', 22.4, 6.2); prop('cabinet', 12.4, 1.5);
prop('whiteboard', 7.4, 1.15);
note(7.4, 1.6, 'Доска: «Цель квартала — +300% яйценоскости. Кто не несётся — тот не с нами»');
note(22.2, 2.2, 'Принтер: «Замятие бумаги. И перьев»');
note(12.4, 2.0, 'Плакат: «Улыбайтесь! Ваш KPI видит вас»');
label(11.8, 7.9, 'ОПЕНСПЕЙС «ИНКУБАТОР»');
objs.push({ type: 'spawn', name: 'player', at: at(3.0, 11.6) }, { type: 'spawn', name: 'player', at: at(4.4, 11.6) }, { type: 'spawn', name: 'player', at: at(5.8, 11.6) }, { type: 'spawn', name: 'player', at: at(7.2, 11.6) });
objs.push({ type: 'npc', name: 'oleg', at: at(9.6, 10.9), props: { kind: 'manBrown', title: 'Олег из бухгалтерии', angle: -90, mode: 'idle', lines: 'Что-то мне нехорошо…|Этот КУКАРЕКС какой-то странный…|Ко… кхм. Извини.' } });
const coworker = (name: string, kind: string, title: string, x: number, y: number, turn: string, lines: string) =>
  objs.push({ type: 'npc', name, at: at(x, y), props: { kind, title, angle: -90, mode: 'idle', tag: 'coworker', turn, lines } });
coworker('sveta', 'womanGreen', 'Света, маркетинг', 15.4, 3.5, 'normal', 'Кто-нибудь пробовал КУКАРЕКС? Бодрит!|У меня чешется шея…');
coworker('dima', 'manBlue', 'Дима, стажёр', 19.6, 7.1, 'fast', 'Я выпил три банки! Я ВСЁ МОГУ!|Ко! Ко-ко! Ой.');
coworker('arkady', 'hitman', 'Аркадий, менеджер', 7.4, 3.5, 'fat', 'Где квартальный отчёт?!|Я не толстый, я — синергичный.');
coworker('olga', 'womanGreen', 'Ольга, HR', 19.0, 10.6, 'normal', 'Тимбилдинг в субботу обязателен!|Почему у всех перья?');
coworker('kirill', 'manBrown', 'Кирилл, дизайнер', 15.6, 10.6, 'normal', 'Сделайте логотип покрупнее… и покурнее.|Мне нужен пиксель-перфект клюв.');

// ---------------------------------------------------------------- kitchen «Зерно истины»
prop('counter_a', 25.5, 1.5); prop('stove', 26.5, 1.5); prop('hob', 27.5, 1.5); prop('counter_b', 28.5, 1.5); prop('sink', 29.5, 1.5); prop('counter_a', 30.5, 1.5);
prop('vending', 34.6, 1.5); note(34.6, 2.2, 'Автомат: «КУКАРЕКС — энергия, от которой хочется нестись!»');
prop('table_long', 30.6, 6.4); prop('chair_1', 29.2, 5.5, 180); prop('chair_2', 31.9, 5.5, 180); prop('chair_0', 29.2, 7.3); prop('chair_3', 31.9, 7.3);
prop('table_round', 27, 10.4); prop('chair_0', 27, 11.4); prop('chair_1', 27, 9.4, 180);
prop('table_round', 34.2, 10.4); prop('chair_2', 34.2, 11.4); prop('chair_3', 34.2, 9.4, 180);
prop('crate_small', 36.2, 6.0); prop('crate_small', 36.2, 6.8); prop('crate_small_rot', 35.5, 6.4);
note(35.8, 6.4, 'Ящики «КУКАРЕКС». Наклейка: «Экспериментальная партия. Не для людей»');
note(28.5, 2.2, 'Объявление: «Обед строго с 13:00 до 13:07»');
pickup('weapon', 30.6, 6.4, { weapon: 'smg' });
pickup('health', 25.8, 11.4);
label(30.8, 4.0, 'КУХНЯ «ЗЕРНО ИСТИНЫ»', 22);
spawner('kitchen', 36.2, 3.5, 'vent');
trigger('kitchen_enter', 25, 3, 2, 5);

// ---------------------------------------------------------------- server room
for (const y of [2.4, 5.0, 7.6]) for (const x of [39.5, 40.5, 41.5, 43.5, 44.5, 45.5]) prop('server_rack', x, y);
prop('lab_console', 42.5, 11.3); prop('cabinet', 39.2, 11.3);
objs.push({ type: 'use', name: 'reboot', at: at(42.5, 11.3), props: { hint: 'перезагрузить сервер' } });
note(45.6, 11.2, 'Табличка: «Перезагрузка решает 90% проблем. Остальные 10% — тоже»');
label(42.5, 9.4, 'СЕРВЕРНАЯ', 20);
light(42.5, 6.5, 'lamp', '5fb6ff', 240);
spawner('srv', 46.3, 11.4, 'vent'); spawner('srv', 38.6, 1.4, 'vent');
spawner('near', 36.5, 15.5, 'vent'); spawner('near', 49.5, 15.5, 'vent');

// ---------------------------------------------------------------- elevator hall
prop('elevator', 51, 2.1); prop('elevator', 55.6, 2.1);
prop('plant', 48.6, 11.3); prop('plant', 58.3, 11.3); prop('sofa_dark', 53.3, 11.4);
note(53.3, 3.8, 'Табличка: «Максимальная нагрузка: 8 человек или 40 кур»');
label(53.3, 7, 'ЛИФТЫ', 26);
trigger('elevator', 48, 1, 11, 5, { all: true });

// ---------------------------------------------------------------- corridor
for (const x of [5, 17, 29, 41, 53]) light(x, 14.3, 'emergency');
prop('poster', 6, 14.15); note(6, 14.5, 'Плакат: «Корпоративная ценность №1: Мы — одна семья. Семья кур»');
prop('poster_b', 20, 14.15); note(20, 14.5, 'Плакат: «Пятничный дресс-код: перья приветствуются»');
prop('poster', 44, 14.15); note(44, 14.5, 'Плакат: «Курникс Групп — несём будущее!»');
prop('plant', 1.5, 16.4); prop('plant', 58.5, 16.4); prop('water_cooler', 33.5, 16.4);
trigger('corridor', 1, 14, 58, 3);
trigger('server_door', 41, 14, 3, 3, { once: false });
trigger('security_door', 25, 14, 3, 3, { once: false });
spawner('corridor', 1.6, 15, 'vent'); spawner('corridor', 58.3, 15, 'vent');

// ---------------------------------------------------------------- lobby / reception
prop('reception', 10.5, 23.2);
note(10.5, 22.3, 'Табличка: «Опоздание = минус яйцо из премии»');
prop('sofa_green', 4, 33.6); prop('coffee_table', 4, 32.2); prop('sofa_orange', 16.8, 33.6); prop('coffee_table', 16.8, 32.2);
prop('plant', 1.6, 18.6); prop('plant', 19.4, 18.6); prop('plant', 1.6, 38.3); prop('plant', 19.4, 38.3); prop('aquarium', 10.5, 29.5);
label(10.5, 26.6, 'РЕСЕПШН', 28);
objs.push({ type: 'npc', name: 'galina', at: at(10.5, 21.9), props: { kind: 'womanGreen', title: 'Галина, ресепшн', mode: 'cower', angle: 90, lines: 'Вы записаны?|Только не бегите, у меня каблуки!' } });
spawner('entrance', 6.5, 37.6, 'vent'); spawner('entrance', 10.5, 37.6, 'vent'); spawner('entrance', 14.5, 37.6, 'vent');
trigger('lobby', 1, 18, 20, 21);

// ---------------------------------------------------------------- security
prop('lab_console', 24.5, 18.6); prop('lab_console', 27.6, 18.6); prop('cabinet', 29.6, 22, 90); prop('chair_blue', 26, 20);
note(26, 19.5, 'Мониторы видеонаблюдения: везде курицы. На всех камерах. Даже в лифте.');
objs.push({ type: 'npc', name: 'petrovich', at: at(26, 22.4), props: { kind: 'soldier', title: 'Петрович, охрана', mode: 'guard', weapon: 'shotgun', hp: 160, angle: -90, lines: 'Сорок лет охраняю этот курятник. Не думал, что в прямом смысле.|Пропуск! А, ладно.' } });
pickup('weapon', 23.4, 25.6, { weapon: 'shotgun' }); pickup('armor', 29.5, 25.6); pickup('ammo', 26.5, 25.6);
label(26, 24.0, 'ОХРАНА', 20);
trigger('security_in', 22, 18, 9, 9);

// ---------------------------------------------------------------- toilet
prop('sink', 29.5, 28.5); prop('sink', 28.5, 28.5); prop('bin', 29.6, 31);
note(28.8, 29.2, 'Табличка: «Не бросайте перья в унитаз»');
objs.push({ type: 'npc', name: 'semyon', at: at(24, 36.5), props: { kind: 'manOld', title: 'Семён Аркадьевич', mode: 'idle', angle: 0, lines: 'Я тут с обеда сижу. Что-то пропустил?|Молодой человек, у вас перо на плече.|В мои годы куры знали своё место — в бульоне.' } });
pickup('health', 29.5, 37.5); pickup('health', 27, 37.5);
label(27.5, 35.3, 'WC', 30);
trigger('toilet', 22, 28, 9, 11);

// ---------------------------------------------------------------- meeting room «Прорыв»
prop('table_big', 36, 22.4);
for (const [x, y, r] of [[34.6, 21.2, 90], [34.6, 23.6, 90], [37.4, 21.2, 270], [37.4, 23.6, 270], [36, 20.4, 180], [36, 24.5, 0]] as const) prop('chair_' + Math.round(x + y) % 4, x, y, r);
prop('whiteboard', 36, 18.15); note(36, 18.6, 'Доска: «Совещание "Как повысить яйценоскость" перенесено на понедельник»');
prop('plant', 32.5, 18.5); prop('plant', 39.5, 25.5);
label(36, 25.6, 'ПЕРЕГОВОРНАЯ «ПРОРЫВ»', 16);
trigger('proryv', 32, 18, 9, 9);

// ---------------------------------------------------------------- meeting room «Синергия»
prop('table_long', 36, 32.4); prop('chair_0', 34.6, 31.4, 180); prop('chair_1', 36, 31.4, 180); prop('chair_2', 37.4, 31.4, 180); prop('chair_3', 34.6, 33.4); prop('chair_0', 36, 33.4); prop('chair_1', 37.4, 33.4);
prop('tv', 36, 28.3);
note(36, 28.9, 'Экран: «Синергия — это когда 1 + 1 = курица»');
objs.push({ type: 'npc', name: 'marat', at: at(33.4, 37.4), props: { kind: 'manBlue', title: 'Марат, айтишник', mode: 'cower', angle: -45, lines: 'Вы пробовали выключить и включить?|У меня есть пропуск охраны. Не спрашивай откуда.' } });
enemy('normal', 35, 36, 'syn'); enemy('normal', 37.5, 36.5, 'syn'); enemy('fast', 34, 34.8, 'syn'); enemy('normal', 38.5, 30, 'syn'); enemy('spitter', 39.3, 37.2, 'syn');
label(36, 29.8, 'ПЕРЕГОВОРНАЯ «СИНЕРГИЯ»', 16);

// ---------------------------------------------------------------- cafeteria «Насест»
for (const x of [44.5, 50, 56]) for (const y of [21, 28.2, 35.4]) {
  prop('table_round', x, y); prop('chair_0', x - 0.9, y, 90); prop('chair_1', x + 0.9, y, 270); prop('chair_2', x, y - 0.9, 180); prop('chair_3', x, y + 0.9);
}
prop('vending', 43.6, 18.5); prop('vending', 45.4, 18.5); prop('counter_c', 57.5, 23); prop('counter_d', 57.5, 24); prop('counter_c', 57.5, 25);
note(44.5, 19.2, 'Автомат: «КУКАРЕКС ZERO — 0% сахара, 100% перьев»');
pickup('weapon', 50, 25, { weapon: 'rifle' }); pickup('ammo', 44, 37.5); pickup('ammo', 57, 37.5); pickup('health', 50.2, 31.6);
label(50.2, 32.2, 'СТОЛОВАЯ «НАСЕСТ»', 24);
spawner('caf', 57.6, 37.6, 'vent'); spawner('caf', 42.6, 37.6, 'vent'); spawner('caf', 57.6, 18.6, 'vent');
trigger('cafeteria', 42, 18, 17, 21);
for (const [x, y] of [[50, 22], [50, 34], [44, 29], [57, 29]]) light(x, y, 'emergency', 'ff2a1a', 260);
for (const [x, y] of [[12, 6.5], [30.5, 6], [53, 6], [10.5, 30], [36, 22], [36, 33], [26, 31]]) light(x, y, 'emergency', 'ff2a1a', 240);

const level: LevelSource = {
  id: 'office',
  theme: 'office',
  mapProps: { ambient: 0 },
  grid: P.rows(),
  legend: {
    '#': { wall: true },
    ',': { floor: F.woodLight },
    '.': { floor: F.wood },
    'k': { floor: F.white },
    's': { floor: F.labTile },
    'e': { floor: F.concreteBlue },
    'r': { floor: F.orangeDirt },
    'g': { floor: F.labPlain },
    'w': { floor: F.white },
    'm': { floor: F.woodRed },
    'c': { floor: F.woodLightV },
    'A': { floor: F.wood, door: { id: 'os' } },
    'B': { floor: F.wood, door: { id: 'kitchen_os' } },
    'C': { floor: F.wood, door: { id: 'kitchen' } },
    'D': { floor: F.wood, door: { id: 'server', locked: 'server' } },
    'E': { floor: F.wood, door: { id: 'elevator', locked: 'script' } },
    'G': { floor: F.wood, door: { id: 'lobby' } },
    'H': { floor: F.wood, door: { id: 'security', locked: 'blue' } },
    'J': { floor: F.wood, door: { id: 'toilet' } },
    'K': { floor: F.wood, door: { id: 'proryv' } },
    'L': { floor: F.wood, door: { id: 'synergy' } },
    'M': { floor: F.wood, door: { id: 'cafeteria' } },
    'N': { floor: F.wood, door: { id: 'syn_caf' } },
  },
  rugs: [[2, 30, 5, 4, 'green'], [14, 30, 5, 4, 'orange'], [33, 19, 7, 7, 'green']],
  objects: objs,
};
export default level;
