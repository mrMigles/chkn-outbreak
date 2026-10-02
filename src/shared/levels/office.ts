import type { LevelScript } from './types';
import type { World } from '../sim/World';
import type { EnemyType } from '../enemies';

const hasKey = (w: World, k: string) => w.players.some((p) => p.keys.includes(k));
const giveKey = (w: World, k: string) => { for (const p of w.players) if (!p.keys.includes(k)) p.keys.push(k); };

const office: LevelScript = {
  id: 'office',
  title: 'Этаж 7. Офис «Курникс Групп»',
  subtitle: 'Пятница, 17:55. До выходных — пять минут',
  next: 'lab',

  onStart(w) {
    w.setObjective('Что происходит? Осмотреться');
    w.after(1.2, () => w.say('pa', 'Уважаемые сотрудники! В честь пятницы на кухне бесплатный КУКАРЕКС. Пейте ответственно!', 4.5));
    w.after(4.5, () => w.say('oleg', 'Что-то мне нехорошо… Ко… ко-ко…', 2.5));
    w.after(7.2, () => {
      const n = w.npc('oleg');
      if (!n || n.mode === 'dead') return;
      w.infect(n, 'normal', 'os');
      w.msg('ЭПИДЕМИЯ', 'Коллеги превращаются в кур!', 3);
      const cw = w.npcs.filter((q) => q.tag === 'coworker');
      cw.forEach((q, i) => {
        w.after(0.2 + i * 0.12, () => w.say(q.id, ['Ко?!', 'КО-КО-КО!', 'Мне плохо…', 'Перья?!', 'Кукаре-е-е…'][i % 5], 1.2));
        w.after(1.1 + i * 0.45, () => w.infect(q, (q.props?.turn as EnemyType) || 'normal', 'os'));
      });
      w.setObjective('Выжить. Выбраться из опенспейса');
    });
  },

  onKill(w, _e, tag) {
    if (tag === 'os' && w.countTag('os') === 0 && !w.flags.osClear) {
      w.flags.osClear = true;
      w.setObjective('Найти выход. Лифты — в конце коридора');
      const p = w.anyPlayer;
      if (p) w.say(p.id, 'Так. Пятница отменяется.');
    }
    if (tag === 'lobby' && w.countTag('lobby') === 0) w.flags.lobbyClear = true;
  },

  onTrigger(w, id, by) {
    switch (id) {
      case 'kitchen_enter':
        w.spawnWave('kitchen', ['normal', 'fast', 'normal', 'normal'], 7, 0.35, true, 'kitchen');
        w.after(0.3, () => w.say(by.id, 'Они в холодильнике!!'));
        break;
      case 'corridor':
        if (w.flags.power) break;
        w.say('pa', 'Внимание! Из-за перегрузки лифты обесточены. Перезагрузите сервер. Или не перезагружайте. Нам уже всё равно.', 5);
        w.setObjective('Лифты обесточены. Перезагрузить сервер (серверная — у лифтов)');
        break;
      case 'server_door':
        if (!hasKey(w, 'server')) {
          w.say(by.id, 'Заперто. Ключ должен быть у охраны.');
          if (!w.flags.petrovich) w.setObjective('Взять ключ от серверной у охраны (вниз по коридору)');
        }
        break;
      case 'security_door':
        if (!hasKey(w, 'blue') && !w.flags.petrovich) {
          w.say(by.id, 'Нужен синий пропуск. У айтишников всегда есть лишний.');
          w.setObjective('Найти синий пропуск у айтишников (переговорные)');
        }
        break;
      case 'proryv':
        if (!w.flags.marat) w.say('marat', 'ПОМОГИТЕ! Я в «Синергии»! Они клюют мой ноутбук!', 3.5);
        break;
      case 'security_in': {
        w.flags.petrovich = true;
        const n = w.npc('petrovich');
        if (n && n.mode !== 'dead') {
          w.say(n.id, 'Наконец-то живые! Ключ от серверной? Держи. И я с тобой — сорок лет стажа!', 4.5);
          giveKey(w, 'server');
          n.mode = 'follow'; n.follow = by.id;
          w.emit({ e: 'pick', id: by.id, k: 'keycard', text: 'Ключ от серверной' });
          w.after(1, () => w.setObjective('Перезагрузить сервер (серверная — у лифтов)'));
        }
        break;
      }
      case 'toilet':
        w.say('semyon', 'Я тут с обеда сижу. Что-то пропустил?', 3);
        break;
      case 'cafeteria':
        w.msg('СТОЛОВАЯ «НАСЕСТ»', 'Обед начался раньше', 2.5);
        w.spawnWave('caf', ['normal', 'normal', 'fast', 'fast', 'fat', 'spitter'], 20, 0.28, true, 'caf');
        break;
      case 'lobby':
        if (!w.flags.galina) {
          w.say('galina', 'Помогите!!! Они ломятся через главный вход!', 3);
          w.spawnWave('entrance', ['normal', 'fast', 'normal', 'armored', 'normal'], 16, 0.45, true, 'lobby');
        }
        break;
      case 'elevator': {
        const g = w.npc('galina');
        const pt = w.npc('petrovich');
        const saved = [g, pt].filter((n) => n && n.mode === 'follow').map((n) => n!.name);
        if (saved.length) w.msg('ЛИФТ ВНИЗ', 'С вами: ' + saved.join(', '), 2.5);
        else w.msg('ЛИФТ ВНИЗ', 'Минус третий этаж. Лаборатория.', 2.5);
        w.flags.saved = saved.length;
        w.completeLevel('lab');
        break;
      }
    }
  },

  onRescue(w, n, by) {
    if (n.id === 'marat') {
      w.flags.marat = true;
      w.say(n.id, 'Спасибо! Вот пропуск охраны. Не спрашивай, откуда он у меня.', 4);
      w.addPickup('keycard', n.x + 20, n.y - 30, { key: 'blue', ttl: -1 });
      w.setObjective('Синий пропуск получен. Охрана — по коридору');
    }
    if (n.id === 'galina') {
      w.flags.galina = true;
      w.say(n.id, 'Спасибо!!! Я с вами. Только не бегите — у меня каблуки!', 4);
      n.mode = 'follow'; n.follow = by.id;
    }
  },

  onUse(w, id, by) {
    if (id !== 'reboot') return;
    if (w.flags.rebooted) { w.say(by.id, 'Уже перезагружается…'); return; }
    w.flags.rebooted = true;
    w.say(by.id, 'Выключить и включить. Классика.', 2.5);
    w.after(1.2, () => {
      w.setBlackout(true);
      w.setAlarm(true);
      w.say('pa', 'Перезагрузка серверов… Ориентировочное время: 40 секунд. Спасибо за терпение.', 4.5);
      w.setObjective('Продержаться, пока сервер перезагружается');
      let t = 0;
      const groups = ['near', 'srv', 'near', 'kitchen', 'srv', 'corridor'];
      const pool: EnemyType[] = ['normal', 'normal', 'fast', 'fast', 'spitter', 'fat'];
      w.every(4, () => {
        if (!w.blackout) return;
        t += 4;
        const g = groups[(t / 4) % groups.length];
        w.spawnWave(g, pool, 3 + Math.floor(t / 10), 0.3, true, 'blackout');
      });
      w.after(40, () => {
        w.setBlackout(false);
        w.setAlarm(false);
        w.flags.power = true;
        w.openDoor('elevator');
        w.say('pa', 'Сервер перезагружен. Лифты снова работают. Хороших выходных!', 4);
        w.setObjective('К лифтам!');
        if (!w.flags.galina) w.after(5, () => w.say('radio', 'Галина (ресепшн): Кто-нибудь! Я на ресепшене, их тут очень много!', 5));
      });
    });
  },

  onNpcDead(w, n) {
    const lines: Record<string, string> = {
      petrovich: 'Петрович пал смертью храбрых. Сорок лет стажа…',
      galina: 'Галина… Кто теперь будет спрашивать «вы записаны?»',
      marat: 'Марат… Он так и не перезагрузился.',
      semyon: 'Семён Аркадьевич ушёл на пенсию. Навсегда.',
    };
    if (lines[n.id]) w.msg('ПОТЕРЯ', lines[n.id], 3);
  },

  onNpcLost(w, n) {
    const key = n.id === 'marat' ? 'blue' : n.id === 'petrovich' ? 'server' : '';
    if (!key || hasKey(w, key) || w.flags['lostKey:' + key]) return;
    w.flags['lostKey:' + key] = true;
    w.addPickup('keycard', n.x, n.y, { key, ttl: -1 });
    w.setObjective('Подобрать пропуск: ' + (key === 'blue' ? 'охрана' : 'серверная'));
  },
};

export default office;
