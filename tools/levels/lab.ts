// Level 2 — the dark underground lab of project «ЯЙЦО». Power is down, flashlights on.
import { F, type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';

const P = new Painter(64, 48);
P.rect(2, 2, 10, 9, 'a');      // arrival lift lobby
P.rect(12, 4, 29, 6, '.');     // decontamination corridor
P.rect(31, 2, 46, 16, 'h');    // atrium (hub)
P.rect(48, 2, 61, 10, 'b');    // lab B
P.rect(16, 14, 29, 16, '.');   // west corridor
P.rect(2, 12, 14, 22, 'g');    // security checkpoint / armory
P.rect(31, 18, 61, 30, 'i');   // incubator hall
P.rect(21, 27, 29, 29, '.');   // south-west corridor
P.rect(2, 25, 19, 36, 'p');    // generator room
P.rect(2, 38, 20, 46, 'a');    // freight lift
P.rect(22, 33, 44, 46, 'v');   // vivarium
P.rect(46, 33, 61, 46, 'b');   // cold storage
// pillars / structure
for (const [x, y] of [[35, 6], [42, 6], [35, 12], [42, 12]]) P.rect(x, y, x + 1, y + 1, '#');
for (const x of [36, 44, 52]) P.rect(x, 23, x + 1, 25, '#');
P.rect(22, 40, 30, 40, '#'); P.rect(34, 40, 44, 40, '#');  // vivarium cage rows
P.rect(54, 2, 54, 6, '#');                                // lab B partition
// doors
P.rect(11, 5, 11, 5, 'A');     // arrival → decon
P.rect(21, 4, 21, 6, 'B');     // decon mid door (locks behind)
P.rect(30, 4, 30, 6, 'C');     // decon → atrium (3 wide)
P.rect(47, 5, 47, 6, 'D');     // atrium → lab B
P.set(30, 15, 'E');            // atrium → west corridor
P.set(15, 15, 'G');            // west corridor → armory (key: lab)
P.rect(38, 17, 40, 17, 'H');   // atrium → incubator hall
P.set(30, 28, 'J');            // incubator → SW corridor
P.set(20, 28, 'K');            // SW corridor → generator
P.rect(9, 37, 12, 37, 'L');    // generator → freight lift (power)
P.rect(38, 31, 40, 32, '.');   // incubator → vivarium opening
P.set(38, 32, 'M'); P.set(39, 32, 'M'); P.set(40, 32, 'M');
P.set(45, 39, 'N');            // vivarium → cold storage
// Two corridor approaches during the generator defence; no monsters hatch beside its console.
P.rect(20, 34, 22, 35, '.');
P.set(20, 34, 'O'); P.set(20, 35, 'O');

const objs: ObjSpec[] = [];
const at = (x: number, y: number): [number, number] => [x, y];
const prop = (name: string, x: number, y: number, rot = 0, props?: ObjSpec['props']) => objs.push(name === 'hazard_barrel' ? { type: 'barrel', at: at(x, y + .25) } : { type: 'prop', name, at: at(x, y), rot, props });
const note = (x: number, y: number, text: string) => objs.push({ type: 'note', at: at(x, y), props: { text } });
const label = (x: number, y: number, text: string, size = 24) => objs.push({ type: 'label', at: at(x, y), props: { text, size, color: '#bfe9ff' } });
const enemy = (type: string, x: number, y: number, tag = '', extra: ObjSpec['props'] = {}) => objs.push({ type: 'enemy', name: type, at: at(x, y), props: { tag, ...extra } });
const pickup = (name: string, x: number, y: number, props?: ObjSpec['props']) => objs.push({ type: 'pickup', name, at: at(x, y), props });
const spawner = (name: string, x: number, y: number, how = 'vent') => objs.push({ type: 'spawner', name, at: at(x, y), props: { how } });
const trigger = (name: string, x: number, y: number, w: number, h: number, props?: ObjSpec['props']) => objs.push({ type: 'trigger', name, at: at(x, y), size: [w, h], props });
const light = (x: number, y: number, kind: string, color: string, radius: number, extra: ObjSpec['props'] = {}) => objs.push({ type: 'light', at: at(x, y), props: { kind, color, radius, ...extra } });
const pod = (x: number, y: number, tag: string, hatch = 'chick') => objs.push({ type: 'pod', at: at(x, y), props: { tag, hatch } });
const zone = (x: number, y: number, w: number, h: number, dark: number) => objs.push({ type: 'zone', at: at(x, y), size: [w, h], props: { dark } });

// ---------------------------------------------------------------- arrival
prop('elevator', 6, 3.1);
objs.push({ type: 'spawn', name: 'player', at: at(5, 6.5) }, { type: 'spawn', name: 'player', at: at(6.4, 6.5) }, { type: 'spawn', name: 'player', at: at(7.8, 6.5) }, { type: 'spawn', name: 'player', at: at(5.7, 7.8) });
light(6, 6, 'lamp', 'ffe2a8', 300, { flicker: 0.4 });
label(6, 8.8, 'УРОВЕНЬ −3', 20);
note(9.5, 2.6, 'Табличка: «Проект ЯЙЦО. Посторонним вход строго воспрещён. Курам — тем более»');
pickup('ammo', 9.4, 8.6); pickup('health', 2.6, 8.6);
// A recovery beat before decontamination; no new threats in the arrival lobby.
prop('vending', 8.8, 3.3, 0, { incident: 'coffee', incidentId: 'incident_coffee_lab' });
objs.push({ type: 'use', name: 'incident_coffee_lab', at: at(8.8, 4.1), props: { incident: 'coffee', hint: 'кофе: +15 HP и бег на 10 сек' } });
label(7.5, 5.5, 'КОФЕ БЕЗ КУКАРЕКСА', 18);
note(9.5, 5.4, 'На автомате: «Двойной эспрессо. Ноль мутаций. Проверял лаборант — пока человек».');

// ---------------------------------------------------------------- decon corridor
light(15, 5, 'emergency', 'ff2a1a', 220); light(26, 5, 'emergency', 'ff2a1a', 220);
prop('hazard_barrel', 13, 4.3); prop('hazard_barrel', 28.7, 6.6);
note(16, 4.3, 'Табло: «ДЕЗИНФЕКЦИЯ… ОШИБКА… ДЕЗИНФЕКЦИЯ… КО-КО»');
spawner('decon', 25, 4.2); spawner('decon', 27, 6.8); spawner('decon', 29, 5);
trigger('decon', 22, 4, 4, 3);

// ---------------------------------------------------------------- atrium
for (const [x, y] of [[33, 3.5], [44.5, 3.5], [33, 15], [44.5, 15]]) light(x, y, 'lamp', '9fd6ff', 260, { flicker: 0.25 });
prop('lab_bench', 38.5, 4); prop('lab_bench', 38.5, 14.4); prop('lab_console', 32.2, 9, 90); prop('lab_console', 45.6, 9, 270);
prop('hazard_barrel', 40.5, 9.5); objs.push({ type: 'barrel', at: at(37.8, 9.4) }, { type: 'barrel', at: at(43.2, 2.8) });
prop('crate', 45.4, 15.3); prop('crate_small', 44.5, 15.6);
label(38.5, 9.4, 'АТРИУМ', 30);
note(38.5, 4.8, 'Журнал: «День 41. Куры научились открывать двери. День 42. Куры научились закрывать двери за нами»');
enemy('normal', 34, 9, 'atrium'); enemy('normal', 41, 5, 'atrium'); enemy('spitter', 44, 12, 'atrium'); enemy('fast', 39, 12, 'atrium'); enemy('normal', 36, 15, 'atrium');
spawner('atrium', 46, 2.5); spawner('atrium', 31.5, 2.5); spawner('atrium', 46, 15.5);
trigger('atrium', 31, 2, 16, 15);

// ---------------------------------------------------------------- lab B (Omletov)
prop('lab_bench', 51, 3); prop('lab_bench', 58, 3); prop('lab_console', 60.5, 8.5, 270); prop('cabinet', 49.2, 9.4);
prop('egg_pod_broken', 57.5, 8.3);
light(51, 6, 'lamp', 'b7ff9a', 220, { flicker: 0.6 });
objs.push({ type: 'npc', name: 'omletov', at: at(58.5, 6.2), props: { kind: 'manOld', title: 'Профессор Омлетов', mode: 'cower', weapon: 'flamethrower', hp: 140, angle: 180, lines: 'КУКАРЕКС — побочный продукт проекта «ЯЙЦО». Простите.|Антидот можно синтезировать в цехе розлива.|Не стойте под вытяжкой. Оттуда что-то клюёт.' } });
enemy('normal', 52, 7, 'labb'); enemy('fast', 56, 4.6, 'labb'); enemy('spitter', 60, 2.8, 'labb'); enemy('normal', 50, 4.5, 'labb');
note(51, 3.8, 'Формула на доске: «C₈H₁₀N₄O₂ + 🐔 = 🐔🐔🐔». Подпись: «Почти готово!»');
label(55, 9.4, 'ЛАБОРАТОРИЯ Б', 18);
trigger('labb', 48, 2, 14, 9);

// ---------------------------------------------------------------- west corridor & armory
light(22, 15, 'emergency', 'ff2a1a', 220);
prop('cabinet', 3, 12.6); prop('cabinet', 6.2, 12.6); prop('shelf', 11.5, 12.6);
prop('lab_console', 13.5, 21.3);
pickup('weapon', 8, 17, { weapon: 'machinegun' }); pickup('armor', 4, 21); pickup('ammo', 12, 21); pickup('ammo', 3, 16);
light(8, 17, 'lamp', 'ffb347', 220);
label(8, 19.5, 'ОРУЖЕЙНАЯ', 22);
note(11.5, 13.4, 'Опись: «Пулемёт — 1 шт. Назначение: усмирение лабораторных образцов»');
trigger('armory', 2, 12, 13, 11);

// ---------------------------------------------------------------- incubator hall
for (const [i, x] of [33, 38.5, 41, 46.5, 49, 54.5, 57, 60].entries()) for (const [j, y] of [19.6, 21.6, 26.8, 28.8].entries()) {
  if ((i + j) % 3 === 2) continue;
  pod(x, y, x < 44 ? 'inc_a' : x < 52 ? 'inc_b' : 'inc_c', (i * 7 + j) % 5 === 0 ? 'normal' : (i + j) % 4 === 0 ? 'fast' : 'chick');
}
light(37, 24, 'lamp', '7dff8a', 260, { flicker: 0.3 }); light(48, 24, 'lamp', '7dff8a', 260); light(58, 24, 'lamp', '7dff8a', 260, { flicker: 0.5 });
label(46, 24.4, 'ИНКУБАТОРНАЯ', 30);
note(46, 22.8, 'Табличка: «Не стучите по яйцам. Они стучат в ответ»');
trigger('inc_a', 31, 18, 12, 13); trigger('inc_b', 43, 18, 8, 13); trigger('inc_c', 52, 18, 10, 13);
spawner('inc', 61, 18.5); spawner('inc', 61, 29.5); spawner('inc', 31.5, 29.5);

// ---------------------------------------------------------------- generator room
prop('generator', 6, 27.2); prop('generator', 15, 27.2); prop('machine', 11, 33.5); prop('pipe_h', 3, 31); prop('pipe_h', 19, 31);
prop('lab_console', 11, 29.6);
objs.push({ type: 'use', name: 'generator', at: at(11, 29.6), props: { hint: 'запустить генератор' } });
light(11, 31, 'alarm', 'ff3b1f', 420); light(3, 35, 'alarm', 'ff3b1f', 360); light(19, 35, 'alarm', 'ff3b1f', 360);
light(11, 30.5, 'lamp', 'ffb347', 200, { flicker: 0.7 });
objs.push({ type: 'barrel', at: at(3, 26) }, { type: 'barrel', at: at(19, 26) }, { type: 'barrel', at: at(3, 35.5) });
label(11, 35.6, 'ГЕНЕРАТОРНАЯ', 22);
for (const [x, y] of [[25, 28], [32, 29], [24, 35], [38, 35], [44, 29]]) {
  objs.push({ type: 'spawner', name: 'gen_corridor', at: at(x, y), props: { how: 'rise', corridorOnly: true } });
}
trigger('gen_room', 2, 25, 19, 12);

// ---------------------------------------------------------------- freight lift
prop('elevator', 11, 44.9); prop('crate', 3, 39); prop('crate_rot', 4, 40); prop('pallet', 18.5, 39.5);
label(11, 41.5, 'ГРУЗОВОЙ ЛИФТ', 20);
light(11, 42, 'emergency', 'ff2a1a', 260);
trigger('freight', 2, 38, 19, 9, { all: true });

// ---------------------------------------------------------------- vivarium
for (const x of [23.5, 26, 28.5]) { prop('crate', x, 41.6); }
for (const x of [35, 38, 41]) { prop('egg_pod_broken', x, 37); }
prop('feather_pile', 26, 36); prop('feather_pile', 41, 44); prop('blood_trail', 32, 43.4);
pickup('weapon', 25, 44.5, { weapon: 'grenade' }); pickup('health', 43, 45); pickup('ammo', 23, 34);
enemy('exploder', 30, 37, 'viv'); enemy('exploder', 40, 44, 'viv'); enemy('spitter', 24, 38.5, 'viv'); enemy('normal', 32, 44, 'viv'); enemy('fat', 36, 35, 'viv'); enemy('armored', 42, 36, 'viv');
light(33, 38, 'lamp', 'b7ff9a', 240, { flicker: 0.5 });
label(33, 42.6, 'ВИВАРИЙ', 26);
note(32, 34, 'Табличка: «Образцы 1–40: агрессивны. Образцы 41–80: тоже»');
// Side objective: enough space to circle away from the terminal, then return to it.
prop('terminal', 26.8, 34.5, 0, { incident: 'cache', incidentId: 'incident_cache_lab' });
objs.push({ type: 'use', name: 'incident_cache_lab', at: at(26.8, 35.25), props: { incident: 'cache', group: 'inc', hint: 'припасы: держаться рядом 12 сек' } });
label(26.8, 33.4, 'ПРИПАСЫ · НЕОБЯЗАТЕЛЬНО', 18);
note(27.8, 36.5, 'Терминал: «Ваши патроны очень важны для нас. Оставайтесь на линии». Вентиляция уже подключилась.');

// ---------------------------------------------------------------- cold storage
prop('shelf', 50, 33.6); prop('shelf', 57, 33.6); prop('crate', 60.4, 45.4); prop('crate_small', 59.5, 45.6);
pickup('health', 48, 45); pickup('ammo', 60, 40); pickup('armor', 53.5, 40);
enemy('fast', 52, 42, 'cold'); enemy('fast', 56, 38, 'cold'); enemy('normal', 59, 43, 'cold');
light(53.5, 40, 'lamp', 'cfe8ff', 240, { flicker: 0.2 });
label(53.5, 37.6, 'ХОЛОДИЛЬНИК', 20);
note(57, 34.4, 'Наклейка: «Окорочка. Не размораживать. Они шевелятся»');

zone(2, 2, 9, 8, 0.4);

const level: LevelSource = {
  id: 'lab',
  theme: 'lab',
  mapProps: { ambient: 0.86 },
  grid: P.rows(),
  legend: {
    '#': { wall: true },
    'a': { floor: F.concreteBlue },
    '.': { floor: F.labPlain },
    'h': { floor: [270, 271, 297, 298] },
    'b': { floor: F.labTile },
    'g': { floor: F.asphalt },
    'i': { floor: [324, 325, 351] },
    'p': { floor: F.asphalt },
    'v': { floor: F.dirt },
    'A': { floor: F.labPlain, door: { id: 'arrival' } },
    'B': { floor: F.labPlain, door: { id: 'decon' } },
    'C': { floor: F.labPlain, door: { id: 'atrium' } },
    'D': { floor: F.labPlain, door: { id: 'labb' } },
    'E': { floor: F.labPlain, door: { id: 'westc' } },
    'G': { floor: F.labPlain, door: { id: 'armory', locked: 'lab' } },
    'H': { floor: F.labPlain, door: { id: 'incubator' } },
    'J': { floor: F.labPlain, door: { id: 'swc' } },
    'K': { floor: F.labPlain, door: { id: 'gen' } },
    'L': { floor: F.labPlain, door: { id: 'freight', locked: 'script' } },
    'M': { floor: F.labPlain, door: { id: 'vivarium' } },
    'N': { floor: F.labPlain, door: { id: 'cold' } },
    'O': { floor: F.labPlain, door: { id: 'gen_east' } },
  },
  objects: objs,
};
export default level;
