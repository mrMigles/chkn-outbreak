import type { LevelScript } from './types';

const boss: LevelScript = {
  id: 'boss',
  title: 'Ангар. Совет директоров',
  subtitle: 'Генеральный директор хочет обсудить ваши KPI',

  onStart(w) {
    w.setObjective('Выжить на совещании');
    w.after(1.5, () => w.say('pa', 'Генеральный директор: Сотрудники! Вы сорвали квартальный план. Это… КО-КО-КОНЕЦ вашей карьеры!', 5));
    w.after(4.5, () => {
      const sp = w.objects('spawner', 'boss_spawn')[0];
      const e = w.spawnEnemy('boss', sp?.cx ?? w.map.pw / 2, sp?.cy ?? 300, { how: 'rise', aggro: true, tag: 'boss' });
      w.say(String(e.id), 'КУ-КА-РЕ-КУ-У-У!!!', 2);
      w.emit({ e: 'fuse', id: e.id });
      w.setAlarm(true);
      w.msg('ГЕНЕРАЛЬНЫЙ ПЕТУХ', 'Председатель совета директоров', 3);
      w.setObjective('Уволить Генерального Петуха');
    });
  },

  onBossPhase(w, e, phase) {
    if (phase === 1) {
      w.say(String(e.id), 'Вы уволены! ВСЕ уволены!', 2.5);
      w.msg('ФАЗА 2', 'Директор вызвал отдел продаж', 2);
    }
    if (phase === 2) {
      w.say(String(e.id), 'Я… не… курица… Я — ЭФФЕКТИВНЫЙ МЕНЕДЖЕР!', 3);
      w.msg('ЯРОСТЬ', 'Последний квартал', 2);
      w.spawnWave('boss', ['exploder', 'fast', 'fast'], 8, 0.3, true, 'boss');
    }
  },

  onBossDead(w) {
    w.setAlarm(false);
    for (const e of [...w.enemies]) w.killEnemy(e, 0, '', true, false);
    w.after(4, () => {
      w.msg('ПОБЕДА', 'Антидот разлит по банкам. Понедельник отменён', 4);
      w.after(3, () => w.completeLevel(''));
    });
  },
};

export default boss;
