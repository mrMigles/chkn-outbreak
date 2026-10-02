import type { LevelScript } from './types';
import type { EnemyType } from '../enemies';

const factory: LevelScript = {
  id: 'factory',
  title: 'Завод «Курникс-Агро»',
  subtitle: 'Сто тысяч банок КУКАРЕКСА в день. Сегодня — ноль',
  next: 'boss',

  onStart(w) {
    w.setObjective('Добраться до цеха розлива (юг)');
    w.after(2, () => w.say('radio', 'Проф. Омлетов: В цехе розлива три вентиля синтеза. Откройте все — и линия начнёт выпускать антидот вместо КУКАРЕКСА.', 6));
  },

  onTrigger(w, id, by) {
    switch (id) {
      case 'yard':
        for (const e of w.enemies) e.aggro = true;
        w.spawnWave('yard', ['normal', 'normal', 'fast', 'armored', 'exploder', 'spitter'], 22, 0.3, true, 'yard');
        w.after(1, () => w.say(by.id, 'Бочки. Много бочек. Отлично.', 2.5));
        break;
      case 'warehouse':
        w.say('mihalych', 'Ну наконец-то люди! Я тут с обеда отстреливаюсь! Прикрой!', 3.5);
        w.spawnWave('wh', ['normal', 'fast', 'fat', 'normal'], 14, 0.35, true, 'wh');
        break;
      case 'hall':
        w.setObjective('Открыть три вентиля синтеза (0/3)');
        w.msg('ЦЕХ РОЗЛИВА', 'Линия захвачена', 2.5);
        w.spawnWave('hall', ['normal', 'fast', 'spitter', 'normal'], 12, 0.4, true, 'hall');
        break;
      case 'exit':
        w.msg('АНГАР', 'Там, где стоит вертолёт директора…', 2.5);
        w.completeLevel('boss');
        break;
    }
  },

  onKill(w, _e, tag) {
    if (tag === 'wh' && w.countTag('wh') === 0 && !w.flags.mihalych) {
      w.flags.mihalych = true;
      const n = w.npc('mihalych');
      const p = w.anyPlayer;
      if (n && n.mode !== 'dead' && p) {
        n.mode = 'follow'; n.follow = p.id;
        w.say(n.id, 'Спасибо, салага. Иду с тобой — план по курам сам себя не выполнит.', 4);
      }
    }
  },

  onUse(w, id, by) {
    if (!id.startsWith('valve')) return;
    if (w.flags[id]) { w.say(by.id, 'Этот уже открыт.'); return; }
    w.flags[id] = true;
    const n = ['valve1', 'valve2', 'valve3'].filter((v) => w.flags[v]).length;
    w.say(by.id, ['Первый пошёл!', 'Второй готов!', 'Третий! Запускаем!'][n - 1], 2);
    w.setObjective(`Открыть три вентиля синтеза (${n}/3)`);
    w.spawnWave('hall', ['normal', 'fast', 'exploder', 'armored'], 6 + n * 2, 0.3, true, 'hall');
    if (n < 3) return;
    w.setAlarm(true);
    w.say('pa', 'Внимание! Перенастройка линии. Синтез антидота: 30 секунд.', 4);
    w.setObjective('Защищать линию, пока синтезируется антидот');
    const pool: EnemyType[] = ['normal', 'fast', 'fat', 'spitter', 'exploder', 'armored', 'fast'];
    let t = 0;
    w.every(3, () => {
      if (!w.alarm) return;
      t += 3;
      w.spawnWave('hall', pool, 3 + Math.floor(t / 7), 0.3, true, 'syn');
    });
    w.after(30, () => {
      w.setAlarm(false);
      w.flags.antidote = true;
      w.openDoor('storage');
      // the antidote mist cures every chicken player
      for (const p of w.players) if (p.state === 'chicken' || p.state === 'dead' || p.state === 'downed') w.cure(p);
      w.msg('АНТИДОТ ГОТОВ', 'Курицы-игроки снова люди. Склад открыт', 3.5);
      w.setObjective('Через склад — к ангару (юг)');
    });
  },

  onNpcDead(w, n) {
    if (n.id === 'mihalych') w.msg('ПОТЕРЯ', 'Михалыч ушёл на заслуженный отдых.', 3);
  },
};

export default factory;
