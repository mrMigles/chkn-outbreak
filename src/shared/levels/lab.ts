import type { LevelScript } from './types';
import type { EnemyType } from '../enemies';

import type { World } from '../sim/World';

/**
 * The lab's exploration objective is derived from the state (scientist found, armory card, armory visited,
 * generator), so the order in which things happen can never leave a stale objective/arrow (D42).
 */
function labObjective(w: World) {
  if (w.flags.generator) return;
  const hasCard = w.players.some((p) => p.keys.includes('lab'));
  const card = w.pickups.find((k) => k.kind === 'keycard' && k.key === 'lab');
  let text: string, target: string | { x: number; y: number };
  if (!w.flags.omletov) { text = 'Найти учёных. Идти на свет'; target = 'omletov'; }
  else if (!hasCard && card) { text = 'Подобрать пропуск в оружейную'; target = { x: card.x, y: card.y }; }
  else if (!w.flags.armory && hasCard) { text = 'Оружейная — западный коридор. Затем генераторная (юго-запад)'; target = 'armory'; }
  else { text = 'Генераторная (юго-запад): запустить генератор'; target = 'generator'; }
  if (w.objective !== text) w.setObjective(text, target);
}

function lockBehind(w: World) {
  for (const id of ['arrival', 'decon']) {
    const d = w.doors.find(q => q.id === id);
    if (!d || w.flags['locked_' + id]) continue;
    if (w.players.every(p => p.state !== 'alive' || p.x > d.x + d.w + 40)) { w.flags['locked_' + id] = true; w.lockDoor(id); }
  }
}

const lab: LevelScript = {
  id: 'lab', rev: 2,
  title: 'Уровень −3. Лаборатория проекта «ЯЙЦО»',
  subtitle: 'Под заводом «Провансаль». Электричества нет. Фонарик есть',
  next: 'boss',

  onStart(w) {
    labObjective(w);
    w.after(2, () => w.say('radio', 'Проф. Омлетов: Если вы это слышите — вы ещё не курица. Поздравляю. Я в лаборатории Б. Идите через атриум.', 6));
  },

  onTrigger(w, id, by) {
    switch (id) {
      case 'decon':
        // doors lock behind, lights die, vents open. D69: a door only locks once every living teammate is past it
        // (a lagging colleague used to be shut out in the lift lobby for good)
        // D71 (rules 6): the doors no longer lock at all — the trap is the alarm and the wave, not a cage for teammates
        if (w.rules >= 6) { /* no lock */ }
        else if (w.rules >= 5) { w.flags.deconLock = true; lockBehind(w); }
        else { w.lockDoor('decon'); w.lockDoor('arrival'); }
        w.say(by.id, w.rules >= 6 ? 'Сирена… и вентиляция открылась. Это ловушка!' : 'Двери заблокировались… Это ловушка?', 2.5);
        w.say('pa', 'Внимание. Обнаружено заражение. Запуск протокола «Курятник».', 4);
        w.spawnWave('decon', ['fast', 'normal', 'fast', 'normal', 'spitter'], 12, 0.3, true, 'decon');
        w.flags.deconWave = true;
        break;
      case 'atrium':
        w.spawnWave('atrium', ['normal', 'fast', 'spitter', 'normal', 'fat'], 14, 0.4, true, 'atrium');
        break;
      case 'labb':
        if (!w.flags.omletov) w.say('omletov', 'Сюда! Только осторожно — у меня огнемёт и нервы!', 3);
        break;
      case 'inc_a': case 'inc_b': case 'inc_c':
        w.hatchPods(id, id === 'inc_a' ? 1.5 : 2.5);
        if (id === 'inc_a') w.say(by.id, 'Яйца… они вылупляются!', 2);
        // D72: a bigger hatch, and the incubator's pride — GMO roosters
        if (id === 'inc_b') { w.spawnWave('inc', ['normal', 'fast', 'chick', 'chick'], 6 + 2 * w.players.length, 0.35, true, 'inc'); w.say('pa', 'Внимание: партия «ГМО-бройлер» вылупилась досрочно. Не кормить. Не гладить. Бежать.', 5); }
        if (id === 'inc_c') { w.spawnWave('inc', ['normal', 'fast', 'exploder', 'gmo'], 10 + 2 * w.players.length, 0.45, true, 'inc'); }
        break;
      case 'armory':
        if (!w.flags.armory) {
          w.flags.armory = true; w.say(by.id, 'Пулемёт. Вот это я понимаю — техника безопасности.', 3);
          labObjective(w);
        }
        break;
      case 'gen_room':
        if (!w.flags.generator && w.flags.omletov) w.setObjective('Запустить генератор (пульт в центре)', 'generator');
        break;
      case 'freight':
        w.msg('ГРУЗОВОЙ ЛИФТ', 'Наверх, в ангар «Провансаля». Совет директоров ждёт', 3);
        w.completeLevel('boss');
        break;
    }
  },

  onTick(w, dt) {
    if (w.flags.deconLock) lockBehind(w);
    // self-heal once a second (e.g. the card was picked up by a teammate)
    if (Math.floor(w.time) !== Math.floor(w.time - dt)) labObjective(w);
  },

  onRescue(w, n, by) {
    if (n.id !== 'omletov') return;
    w.flags.omletov = true;
    w.say(n.id, 'Спасены! КУКАРЕКС — это мы. Простите. Антидот наверху уже льётся, но источник — Генеральный: он пьёт КУКАРЕКС литрами. Пропуск в оружейную — держите. И я иду с вами!', 7);
    const card = w.addPickup('keycard', n.x - 40, n.y, { key: 'lab', ttl: -1 });
    if (w.rules >= 6) {
      // D71: Омлетов's prototype — pierces everything in a line, twenty-odd charges for the whole floor
      w.addPickup('weapon', n.x - 40, n.y + 60, { weapon: 'laser', ttl: -1 });
      w.after(6.5, () => w.say(n.id, 'И возьмите «Омлет-3000». Лазерное ружьё. Прошивает всех в ряд. Зарядов мало — берегите для толстых.', 6));
    }
    n.mode = 'follow'; n.follow = by.id;
    void card;
    labObjective(w);
  },

  onPickup(w, k) {
    if (k.kind === 'keycard') labObjective(w);
  },

  onUse(w, id, by) {
    if (id !== 'generator') return;
    if (w.flags.generator) { w.say(by.id, 'Генератор уже раскручивается.'); return; }
    w.flags.generator = true;
    w.setBlackout(true);
    w.say(by.id, 'Ну давай, родной… Заводись!', 2);
    w.setAlarm(true);
    w.say('pa', 'Генератор: прогрев 35 секунд. Свет погас. Образцы бегут ИЗ КОРИДОРОВ. Удачной пятницы.', 5);
    w.setObjective('Защищать генератор, пока он прогревается');
    // D72: the GMO roosters come for the generator too
    const pool: EnemyType[] = ['normal', 'fast', 'fast', 'spitter', 'exploder', 'fat', 'armored'];
    let t = 0;
    w.spawnWave('gen_corridor', ['fast', 'normal', 'fast'], 8, .25, true, 'gen', true);
    w.after(6, () => { if (w.alarm) { w.spawnWave('gen_corridor', ['gmo'], 1 + Math.ceil(w.players.length / 2), .8, true, 'gen', true); w.say('pa', 'Генератор привлёк ГМО-образцы. Они любят электричество. И вас.', 4); } });
    w.after(22, () => { if (w.alarm) w.spawnWave('gen_corridor', ['gmo', 'armored'], 2 + w.players.length, .6, true, 'gen', true); });
    w.every(2.5, () => {
      if (!w.alarm) return;
      t += 2.5;
      w.spawnWave('gen_corridor', pool, 4 + Math.floor(t / 8), .22, true, 'gen', true);
    });
    w.after(35, () => {
      w.setAlarm(false);
      w.setBlackout(false);
      w.flags.power = true;
      w.openDoor('freight');
      w.msg('ПИТАНИЕ ВОССТАНОВЛЕНО', 'Грузовой лифт работает', 3);
      w.setObjective('К грузовому лифту (юг)', 'freight');
    });
  },

  onKill(w, e) {
    if (e.type !== 'gmo') return;
    w.flags.gmoKills = (w.flags.gmoKills ?? 0) + 1;
    if (w.flags.gmoKills === 1) w.say('omletov', 'ГМО-петух! Модифицирован под стойкость к офисной мебели. Цельтесь в гребень!', 4);
    if (w.flags.gmoKills >= 5 && !w.flags.noGmo) { w.flags.noGmo = true; w.award('no_gmo'); }
  },

  onNpcDead(w, n) {
    if (n.id === 'omletov') w.msg('ПОТЕРЯ', 'Профессор Омлетов… Рецепт антидота придётся вспоминать самим.', 3);
  },
  onNpcLost(w, n) {
    if (n.id !== 'omletov') return;
    // D72: a professor lost before his rescue no longer freezes «Найти учёных»: his card and his prototype stay
    if (!w.flags.omletov) {
      w.flags.omletov = true;
      if (w.rules >= 6) w.addPickup('weapon', n.x + 40, n.y + 30, { weapon: 'laser', ttl: -1 });
      w.say('radio', 'Неля: Профессор… не успели. У него в халате пропуск в оружейную. И какой-то лазер.', 5);
    }
    if (w.flags.lostLabKey || w.players.some(p => p.keys.includes('lab'))) { labObjective(w); return; }
    w.flags.lostLabKey = true;
    w.addPickup('keycard', n.x, n.y, { key: 'lab', ttl: -1 });
    labObjective(w);
  },
};

export default lab;
