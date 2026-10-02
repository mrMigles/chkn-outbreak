import type { LevelScript } from './types';

const boss: LevelScript = {
  id: 'boss',
  title: 'Ангар «Провансаля». Совет директоров',
  subtitle: 'Генеральный директор хочет обсудить ваши KPI',

  onStart(w) {
    w.flags.reinforcementsAt = w.time + 10;
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

  onTick(w) {
    const e = w.enemies.find(e => e.type === 'boss');
    // D70 (rules 5): the trade-union medkit — the final fight is long, a supply now and then keeps it fair
    if (e && w.rules >= 5 && w.time >= (w.flags.medkitAt ?? w.time + 1)) {
      if (w.flags.medkitAt !== undefined && !w.pickups.some(k => k.kind === 'health')) {
        const sp = w.objects('spawner', 'boss_spawn')[0];
        w.addPickup('health', w.map.pw / 2, sp ? sp.cy + 600 : w.map.ph / 2, { ttl: 20 });
        w.say('pa', w.rng.pick(['Профсоюз напоминает: аптечка в центре зала.', 'Отдел охраны труда выдал аптечку. Распишитесь.', 'Аптечка от профсоюза. Не благодарите, это из ваших взносов.']), 3.5, true);
      }
      w.flags.medkitAt = w.time + 24;
    }
    if (!e || w.time < w.flags.reinforcementsAt) return;
    if (w.rules >= 5) {
      // D70: smaller, slightly rarer reinforcements (the old stream buried even a full arsenal in ~25 s)
      w.flags.reinforcementsAt = w.time + (e.phase === 2 ? 7 : 10);
      if (w.enemies.length < 50) w.spawnWave('boss', ['normal', 'fast', 'fast', 'spitter', 'armored'], 4 + e.phase * 2 + Math.round(w.players.length * 1.5), .25, true, 'board');
      return;
    }
    w.flags.reinforcementsAt = w.time + (e.phase === 2 ? 6 : 9);
    if (w.enemies.length < 65) w.spawnWave('boss', ['normal', 'fast', 'fast', 'spitter', 'armored'], 6 + e.phase * 3 + w.players.length * 2, .23, true, 'board');
  },

  onBossPhase(w, e, phase) {
    if (phase === 1) {
      w.say(String(e.id), 'Вы уволены! ВСЕ уволены!', 2.5);
      w.msg('ФАЗА 2', 'Директор вызвал отдел продаж', 2);
      w.spawnWave('boss', ['normal', 'fast', 'armored', 'spitter'], w.rules >= 5 ? 8 + 2 * w.players.length : 14, .23, true, 'board');
    }
    if (phase === 2) {
      w.say(String(e.id), 'Я… не… курица… Я — ЭФФЕКТИВНЫЙ МЕНЕДЖЕР!', 3);
      w.msg('ЯРОСТЬ', 'Последний квартал', 2);
      w.spawnWave('boss', ['exploder', 'fast', 'fast', 'armored'], w.rules >= 5 ? 10 + 3 * w.players.length : 20, .2, true, 'board');
    }
  },

  onBossDead(w) {
    for (const p of w.players) {
      if (p.state !== 'alive') w.cure(p);
      (p.buffs ??= {}).invincible = Math.max(10, p.buffs.invincible ?? 0);
    }
    w.cancelWaves();
    w.setAlarm(false);
    for (const e of [...w.enemies]) w.killEnemy(e, 0, '', true, false);
    w.enemies.length = 0; w.projectiles.length = 0;
    w.after(4, () => {
      w.msg('ПОБЕДА', 'Антидот разлит по банкам. Понедельник отменён', 4);
      w.after(3, () => w.completeLevel(''));
    });
  },
};

export default boss;
