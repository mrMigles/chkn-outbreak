// Floor 12 cafe (D69): the end of chapter 1. Lunch by the panoramic windows, a joke about the chicken,
// a helicopter falling into the street outside, then down to the city.
import { type LevelSource, type ObjSpec } from './types';
import { Painter } from './_paint';

const p = new Painter(34, 22);
p.rect(2, 3, 31, 18, 'f');     // the cafe hall
const objects: ObjSpec[] = [];
const o = (type: string, name: string, x: number, y: number, props?: ObjSpec['props'], size?: [number, number]) => objects.push({ type, name, at: [x, y], props, size });
const prop = (name: string, x: number, y: number, props?: ObjSpec['props']) => o('prop', name, x, y, props);
const label = (text: string, x: number, y: number, size = 20) => o('label', '', x, y, { text, size, color: '#6b5440' });

// panoramic windows along the whole north wall (the cutscene helicopter flies behind them)
for (let i = 0; i < 12; i++) prop('pano_' + (i % 3), 3 + i * 2, 3.1);
o('zone', 'windows', 2, 1.6, { cine: true }, [24, 1.6]);
// tables by the windows: the team's table in the middle with the famous roast chicken
for (const [x, y] of [[6, 7], [11, 7], [22, 7], [6, 12], [11, 12]]) {
  prop('table_round', x, y); prop('chair_1_90', x - 1, y); prop('chair_1_270', x + 1, y);
}
prop('table_long', 16.5, 8); prop('chicken_plate', 15.6, 7.6); prop('chicken_plate', 17.4, 7.6); prop('coffee_cup', 16.5, 8.4);
for (const x of [14.5, 16.5, 18.5]) { prop('chair_2', x, 9.2); prop('chair_2_180', x, 6.8); }
o('use', 'lunch', 16.5, 9.4, { hint: 'пообедать: курочка гриль' });
prop('chicken_plate', 6, 6.7); prop('chicken_plate', 22, 6.7); prop('coffee_cup', 11, 6.8);
// counter and the chef
for (let i = 0; i < 4; i++) prop(i === 1 ? 'stove' : i === 2 ? 'sink' : 'counter_a', 26 + i * 1, 16.4);
prop('vending_b', 30.4, 15.2); prop('plant', 2.6, 17.4); prop('plant', 31.4, 9.4);
for (const x of [24, 25.5]) prop('bar_stool', x, 17.6);
o('npc', 'chef', 27.5, 15.2, { title: 'Шеф Гриль Иваныч', mode: 'idle', hp: 200, story: true, essential: true, untargetable: true, angle: 90, lines: 'Курочка гриль! Свежайшая!|Фирменное блюдо этажа!' });
label('КАФЕ «12 ЭТАЖ» · ПАНОРАМА', 16.5, 13.4, 24);
o('note', '', 21, 12.4, { text: 'Меню: «Курочка гриль — 450 ₽. Курочка гриль (бывший сотрудник) — бесплатно». Вторая строка зачёркнута.' });
// the lift (arrival and the way down)
prop('elevator', 29.5, 3.1); label('ЛИФТ', 29.5, 5.6, 14);
for (let i = 0; i < 4; i++) o('spawn', 'player', 28.5 + (i % 2) * 1.6, 6.2 + Math.floor(i / 2) * 1.2);
o('trigger', 'exit12', 27, 3, { once: false, all: true }, [5, 4]);
o('trigger', 'window', 3, 4, {}, [22, 6]);
o('pickup', 'health', 3, 16); o('pickup', 'ammo', 30, 9);

const level: LevelSource = {
  id: 'cafe12', theme: 'cafe', mapProps: { ambient: 0, wallFace: 'cafe' }, grid: p.rows(), objects,
  legend: { '#': { wall: true }, f: { floor: [513] } },
};
export default level;
