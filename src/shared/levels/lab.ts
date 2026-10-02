import type { LevelScript } from './types';
import type { EnemyType } from '../enemies';

const lab: LevelScript = {
  id: 'lab',
  title: 'Уровень −3. Лаборатория проекта «ЯЙЦО»',
  subtitle: 'Электричества нет. Фонарик есть. Удачи',
  next: 'factory',

  onStart(w) {
    w.setObjective('Найти учёных. Идти на свет');
    w.after(2, () => w.say('radio', 'Проф. Омлетов: Если вы это слышите — вы ещё не курица. Поздравляю. Я в лаборатории Б. Идите через атриум.', 6));
  },

  onTrigger(w, id, by) {
    switch (id) {
      case 'decon':
        // doors lock behind, lights die, vents open
        w.lockDoor('decon');
        w.lockDoor('arrival');
        w.say(by.id, 'Двери заблокировались… Это ловушка?', 2.5);
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
        if (id === 'inc_c') w.spawnWave('inc', ['normal', 'fast', 'exploder'], 8, 0.5, true, 'inc');
        break;
      case 'armory':
        if (!w.flags.armory) { w.flags.armory = true; w.say(by.id, 'Пулемёт. Вот это я понимаю — техника безопасности.', 3); }
        break;
      case 'gen_room':
        if (!w.flags.generator) w.setObjective('Запустить генератор (пульт в центре)');
        break;
      case 'freight':
        w.msg('ГРУЗОВОЙ ЛИФТ', 'Наверх, на завод «Курникс-Агро»', 2.5);
        w.completeLevel('factory');
        break;
    }
  },

  onRescue(w, n, by) {
    if (n.id !== 'omletov') return;
    w.flags.omletov = true;
    w.say(n.id, 'Спасены! КУКАРЕКС — это мы. Простите. Антидот можно сварить на заводе, в цехе розлива. Пропуск в оружейную — держите. И я иду с вами!', 6);
    w.addPickup('keycard', n.x - 40, n.y, { key: 'lab', ttl: -1 });
    n.mode = 'follow'; n.follow = by.id;
    w.setObjective('Оружейная — западный коридор. Затем генераторная (юго-запад)');
  },

  onUse(w, id, by) {
    if (id !== 'generator') return;
    if (w.flags.generator) { w.say(by.id, 'Генератор уже раскручивается.'); return; }
    w.flags.generator = true;
    w.say(by.id, 'Ну давай, родной… Заводись!', 2);
    w.setAlarm(true);
    w.say('pa', 'Генератор: прогрев 35 секунд. Шум привлечёт образцы.', 4);
    w.setObjective('Защищать генератор, пока он прогревается');
    const pool: EnemyType[] = ['normal', 'fast', 'fast', 'spitter', 'exploder', 'fat', 'armored'];
    let t = 0;
    w.every(3.5, () => {
      if (!w.alarm) return;
      t += 3.5;
      w.spawnWave('gen', pool, 3 + Math.floor(t / 9), 0.35, true, 'gen');
    });
    w.after(35, () => {
      w.setAlarm(false);
      w.flags.power = true;
      w.openDoor('freight');
      w.msg('ПИТАНИЕ ВОССТАНОВЛЕНО', 'Грузовой лифт работает', 3);
      w.setObjective('К грузовому лифту (юг)');
    });
  },

  onNpcDead(w, n) {
    if (n.id === 'omletov') w.msg('ПОТЕРЯ', 'Профессор Омлетов… Рецепт антидота придётся вспоминать самим.', 3);
  },
};

export default lab;
