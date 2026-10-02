import type { LevelScript } from './types';
import type { World } from '../sim/World';

/**
 * Floor 12, the cafe (D69): a breather that ends chapter 1. Lunch heals everyone and earns «Бизнес-ланч»;
 * the scene runs on timers (no enemies): the chef's chicken joke, a helicopter falling past the windows,
 * Капитан Крылов on the radio. Then the lift goes down to the street.
 */
const speaker = (w: World, i: number) => (w.players[i % Math.max(1, w.players.length)] ?? w.players[0])?.id ?? 'radio';

function lunch(w: World, by: string) {
  if (w.flags.lunch) return;
  w.flags.lunch = true;
  w.award('business_lunch');
  for (const p of w.players) if (p.state === 'alive') { p.hp = p.maxHp; p.supplies.medkit = Math.max(p.supplies.medkit, 1); }
  w.emit({ e: 'notice', tone: 'reward', text: '🍗 БИЗНЕС-ЛАНЧ', sub: 'Здоровье команды восстановлено. Вкус… знакомый.' });
  w.setObjective('Обед. Наслаждайтесь видом из окна');
  const nelya = w.npc('nelya');
  const say = (t: number, who: string, text: string, d = 3.6) => w.after(t, () => w.say(who, text, d));
  say(0.2, by, 'Наконец-то обед! Курочка гриль, говорите?');
  say(3.6, 'chef', 'Фирменная! Свежайшая! Утром ещё бегала по бухгалтерии!', 3.8);
  say(7.6, speaker(w, 1), '…Шеф. А эта курица… КАКАЯ именно?');
  say(11.2, 'chef', 'Обычная! С птицефабрики! Ну… почти обычная. На вкус — как KPI.', 4);
  if (nelya && nelya.mode !== 'gone' && nelya.mode !== 'dead') say(15.4, nelya.id, 'Я, пожалуй, салатик. Капуста не мутирует. Надеюсь.');
  else say(15.4, speaker(w, 2), 'Хрустит, как квартальный отчёт. Беру добавку.');
  say(19, 'pa', 'Уважаемые сотрудники! Обеденный перерыв продлён до конца эпидемии. Приятного аппетита.', 4.5);
  w.after(23.5, () => { w.say(speaker(w, 0), 'Смотрите! В окне! ВЕРТОЛЁТ!', 3); w.cine('heli'); });
  w.after(29.2, () => { w.emit({ e: 'shake', s: 0.04 }); w.say('chef', 'Это… это был мой поставщик курочки.', 3.5); });
  say(33, 'radio', 'Капитан Крылов, МЧС: …приём! Упал у фонтана на площади. В кабине… курица. Это был мой второй пилот! Кто-нибудь слышит?!', 7);
  w.after(40.5, () => {
    w.flags.down = true;
    w.say(nelya && nelya.mode !== 'gone' ? nelya.id : speaker(w, 0), 'Вниз! У пилота рация — может, он знает, откуда всё это.', 4);
    w.setObjective('Спуститься на улицу: лифт', 'exit12');
  });
}

const cafe12: LevelScript = {
  id: 'cafe12', title: 'Этаж 12. Кафе с панорамой',
  subtitle: 'Обеденный перерыв. Наконец-то',
  next: 'street1',
  chapterEnd: { title: 'ГЛАВА 1 «ОФИС» ПРОЙДЕНА', text: 'Шесть этажей, два директора и одна курочка гриль. Дальше — город.', award: 'chapter_office' },

  onStart(w) {
    w.setObjective('Пообедать у окна: курочка гриль', 'lunch');
    w.after(1.5, () => w.say('chef', 'Заходите, заходите! Кухня работает при любой эпидемии!', 4));
  },

  onTick(w) {
    // nobody presses E: sitting down by the window starts lunch anyway
    if (!w.flags.lunch && w.flags.atWindow && w.time > 20) lunch(w, speaker(w, 0));
    const lift = w.object('exit12');
    if (w.flags.down && lift && !w.finished && w.humanPlayers.length && w.humanPlayers.every(p => p.x >= lift.x && p.x <= lift.x + lift.w && p.y >= lift.y && p.y <= lift.y + lift.h)) {
      w.msg('ГЛАВА 1 ПРОЙДЕНА', 'Офис позади. Впереди — город', 4);
      w.completeLevel('street1');
    }
  },

  onTrigger(w, id) { if (id === 'window') w.flags.atWindow = true; },

  onUse(w, id, by) { if (id === 'lunch') lunch(w, by.id); },

  onNpcUse(w, n) {
    if (n.id === 'chef') { w.say(n.id, w.flags.lunch ? 'Добавки? Только после пожарной тревоги.' : 'Садитесь у окна, курочка уже на столе!', 3); return true; }
  },
};
export default cafe12;
