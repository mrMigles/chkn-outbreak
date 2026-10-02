import type { LevelScript } from './types';
import type { World } from '../sim/World';
import type { EnemyType } from '../enemies';

const hasKey = (w: World, k: string) => w.players.some((p) => p.keys.includes(k));
const giveKey = (w: World, k: string) => { for (const p of w.players) if (!p.keys.includes(k)) p.keys.push(k); };

const office: LevelScript = {
  id: 'office',
  title: 'Этаж 6. Офис «Курникс Групп»',
  subtitle: 'Пятница, 17:55. До выходных — пять минут',
  next: 'office7',
  // the first level is a gentle introduction: softer chickens, smaller waves (D30)
  enemyHp: 0.85,
  enemyDamage: 0.65,

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
      w.setObjective('Найти выход. Лифты — в конце коридора', 'elevator');
      const p = w.anyPlayer;
      if (p) w.say(p.id, 'Так. Пятница отменяется.');
    }
    if (tag === 'lobby' && w.countTag('lobby') === 0) w.flags.lobbyClear = true;
  },

  onTrigger(w, id, by) {
    switch (id) {
      case 'kitchen_enter':
        w.spawnWave('kitchen', ['normal', 'normal', 'fast'], 4, 0.8, true, 'kitchen');
        w.after(0.3, () => w.say(by.id, 'Они в холодильнике!!'));
        break;
      case 'corridor':
        if (w.flags.power) break;
        w.say('pa', 'Внимание! Из-за перегрузки лифты обесточены. Перезагрузите сервер. Или не перезагружайте. Нам уже всё равно.', 5);
        w.setObjective('Лифты обесточены. Перезагрузить сервер (серверная — у лифтов)', 'reboot');
        break;
      case 'server_door':
        if (!hasKey(w, 'server')) {
          if (!w.flags.serverHint) { w.flags.serverHint = true; w.say(by.id, 'Заперто. Ключ должен быть у охраны.'); }
          // never step back: once we know the guard room needs the blue pass, keep that objective
          if (!w.flags.petrovich && !w.flags.needBlue) w.setObjective('Взять ключ от серверной у охраны (вниз по коридору)', 'security_door');
        }
        break;
      case 'security_door':
        if (!hasKey(w, 'blue') && !w.flags.petrovich && !w.flags.needBlue) {
          w.flags.needBlue = true;
          w.say(by.id, 'Нужен синий пропуск. У айтишников всегда есть лишний.');
          w.setObjective('Найти синий пропуск у айтишников (переговорные)', 'marat');
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
          w.after(1, () => w.setObjective('Перезагрузить сервер (серверная — у лифтов)', 'reboot'));
        }
        break;
      }
      case 'toilet':
        w.say('semyon', 'Я тут с обеда сижу. Что-то пропустил?', 3);
        break;
      case 'cafeteria':
        w.msg('СТОЛОВАЯ «НАСЕСТ»', 'Обед начался раньше', 2.5);
        w.spawnWave('caf', ['normal', 'normal', 'normal', 'fast', 'spitter'], 10, 0.7, true, 'caf');
        break;
      case 'lobby':
        if (!w.flags.galina) {
          w.say('galina', 'Помогите!!! Они ломятся через главный вход!', 3);
          w.spawnWave('entrance', ['normal', 'fast', 'normal', 'normal'], 9, 0.7, true, 'lobby');
        }
        break;
      case 'elevator': {
        const g = w.npc('galina');
        const pt = w.npc('petrovich');
        const saved = [g, pt].filter((n) => n && n.mode === 'follow').map((n) => n!.name);
        w.msg('ЛИФТ НА 7-Й', saved.length ? 'С вами: ' + saved.join(', ') : 'Серёга просит забрать друзей этажом выше.', 3);
        w.say('radio', 'Серёга: Мы на седьмом! Не уезжай без нас — Влад на кухне, остальные в офисе!', 5);
        w.flags.saved = saved.length;
        w.completeLevel('office7');
        break;
      }
    }
  },

  onRescue(w, n, by) {
    if (n.id === 'marat') {
      w.flags.marat = true;
      w.say(n.id, 'Спасибо! Вот пропуск охраны. Не спрашивай, откуда он у меня.', 4);
      const card = w.addPickup('keycard', n.x + 20, n.y - 30, { key: 'blue', ttl: -1 });
      w.setObjective('Подобрать синий пропуск', { x: card.x, y: card.y });
    }
    if (n.id === 'galina') {
      w.flags.galina = true;
      w.say(n.id, 'Спасибо!!! Я с вами. Только не бегите — у меня каблуки!', 4);
      n.mode = 'follow'; n.follow = by.id;
    }
  },

  onPickup(w, k) {
    if (k.kind !== 'keycard') return;
    if (k.key === 'blue' && !w.flags.petrovich) w.setObjective('Синий пропуск получен. Охрана — по коридору', 'security_in');
    if (k.key === 'server' && !w.flags.rebooted) w.setObjective('Перезагрузить сервер (серверная — у лифтов)', 'reboot');
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
      const pool: EnemyType[] = ['normal', 'normal', 'normal', 'fast', 'spitter'];
      w.every(7, () => {
        if (!w.blackout) return;
        t += 7;
        const g = groups[Math.floor(t / 7) % groups.length];
        w.spawnWave(g, pool, 2 + Math.floor(t / 20), 0.6, true, 'blackout');
      });
      w.after(40, () => {
        w.setBlackout(false);
        w.setAlarm(false);
        w.flags.power = true;
        w.openDoor('elevator');
        w.say('pa', 'Сервер перезагружен. Лифты снова работают. Хороших выходных!', 4);
        w.setObjective('К лифтам!', 'elevator');
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
    w.setObjective('Подобрать пропуск: ' + (key === 'blue' ? 'охрана' : 'серверная'), { x: n.x, y: n.y });
  },
};

export default office;
