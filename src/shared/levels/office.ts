import type { LevelScript } from './types';
import type { World } from '../sim/World';
import type { EnemyType } from '../enemies';

const hasKey = (w: World, k: string) => w.players.some((p) => p.keys.includes(k));
const giveKey = (w: World, k: string) => { for (const p of w.players) if (!p.keys.includes(k)) p.keys.push(k); };

// D66 (rules ≥ 4; older room saves replay the floor as it was): more chickens, coworkers turning in the
// corridor and a comic lift-hall «планёрка» that turns when the power comes back.
const fresh = (w: World) => w.rules >= 4;
const T = 64;
const CORRIDOR: [string, string, string, number, EnemyType, string, string][] = [
  ['courier', 'manBlue', 'Гена, курьер с пиццей', 27, 'fast', 'Кто заказывал «Четыре сыра»? Ко?..', 'Пицца… с перьями… КО-КО!'],
  ['zina', 'womanGreen', 'Зина, бухгалтерия', 38, 'normal', 'Я только за степлером вышла!', 'Квартальный отчёт… кудах-тах-тах!'],
  ['vitya', 'manBrown', 'Витя, сисадмин', 47, 'normal', 'Вы перезагрузить пробовали?', 'Синий экран… синий гребешок… КО!'],
];
const MEETING: [string, string, string, number, number, EnemyType, string][] = [
  ['coach', 'hitman', 'Вадим, коуч', 0, 0, 'fat', 'Итак, коллеги, планёрка в лифте — наш новый формат!'],
  ['sales1', 'manBlue', 'Отдел продаж', -1.5, 0.9, 'normal', 'А можно я уже домой? Пятница же…'],
  ['sales2', 'womanGreen', 'Отдел продаж', 1.5, 0.9, 'fast', 'Предлагаю закукарекать этот вопрос.'],
  ['intern', 'manBrown', 'Стажёр Петя', 0, 1.8, 'normal', 'Я веду протокол: «ко», «ко», «ко-ко»…'],
];

const office: LevelScript = {
  id: 'office',
  title: 'Этаж 6. Офис «Курникс Групп»',
  subtitle: 'Пятница, 17:55. До выходных — пять минут',
  chapter: 'Глава 1 · Офис',
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
      // D69: fast teams may already be past the open space (corridor, blue pass): never step back
      if (w.objective.startsWith('Что происходит')) w.setObjective('Выжить. Выбраться из опенспейса');
    });
  },

  onKill(w, _e, tag) {
    if (tag === 'os' && w.countTag('os') === 0 && !w.flags.osClear) {
      w.flags.osClear = true;
      // D69: only while the opening objective still stands: clearing the open space late must not send the
      // arrow back to the locked lifts after the server/blue-pass chain has started
      if (w.objective.startsWith('Выжить') || w.objective.startsWith('Что происходит')) w.setObjective('Найти выход. Лифты — в конце коридора', 'elevator');
      const p = w.anyPlayer;
      if (p) w.say(p.id, 'Так. Пятница отменяется.');
    }
    if (tag === 'lobby' && w.countTag('lobby') === 0) w.flags.lobbyClear = true;
  },

  onTrigger(w, id, by) {
    switch (id) {
      case 'kitchen_enter':
        w.spawnWave('kitchen', ['normal', 'normal', 'fast'], fresh(w) ? 6 : 4, 0.8, true, 'kitchen');
        w.after(0.3, () => w.say(by.id, 'Они в холодильнике!!'));
        break;
      case 'corridor':
        if (w.flags.power) break;
        if (fresh(w)) {
          // coworkers in the corridor who also had the free КУКАРЕКС
          const cy = 15.5 * T;
          CORRIDOR.forEach(([id, kind, name, tx, turn, say1, say2], i) => {
            const n = w.addNpc(id, kind, name, tx * T, cy, { angle: 180, tag: 'corr', turn });
            w.after(1.2 + i * 1.6, () => w.say(n.id, say1, 2.4));
            w.after(3.6 + i * 1.6, () => { w.say(n.id, say2, 1.6); w.infect(n, turn, 'corr'); });
          });
          // and a few strays keep coming down the corridor until the server reboot
          w.every(18, () => {
            if (w.flags.rebooted || w.countTag('patrol6') >= 5) return;
            w.spawnWave('corridor', ['normal', 'normal', 'fast'], 3, 0.8, true, 'patrol6');
          });
        }
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
        w.spawnWave('caf', ['normal', 'normal', 'normal', 'fast', 'spitter'], fresh(w) ? 14 : 10, 0.7, true, 'caf');
        break;
      case 'lobby':
        if (!w.flags.galina) {
          w.say('galina', 'Помогите!!! Они ломятся через главный вход!', 3);
          w.spawnWave('entrance', ['normal', 'fast', 'normal', 'normal'], fresh(w) ? 12 : 9, 0.7, true, 'lobby');
        }
        break;
      case 'elevator': {
        // the lift-hall meeting must be over before anyone rides down… up
        if (fresh(w) && (w.countTag('meeting') > 0 || !w.flags.meetingDone)) {
          w.rearmTrigger('elevator');
          if (!w.flags.meetingNag) { w.flags.meetingNag = true; w.say(by.id, 'Сначала разгоним планёрку. Потом лифт.'); }
          break;
        }
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
      // D55: the reboot is the floor's main defence — an opening rush, then waves every 5 s
      // that grow and split between two directions; a live cap keeps it readable.
      let t = 0;
      const groups = ['near', 'srv', 'kitchen', 'near', 'corridor', 'srv'];
      const pool: EnemyType[] = ['normal', 'normal', 'normal', 'fast', 'fast', 'spitter'];
      const late: EnemyType[] = [...pool, 'fat'];
      w.spawnWave('srv', ['normal', 'normal', 'fast'], 5, 0.5, true, 'blackout');
      w.spawnWave('near', pool, 4, 0.6, true, 'blackout');
      w.every(5, () => {
        if (!w.blackout) return;
        t += 5;
        if (w.countTag('blackout') >= 18) return;
        const g = groups[Math.floor(t / 5) % groups.length];
        w.spawnWave(g, t >= 20 ? late : pool, 3 + Math.floor(t / 12), 0.5, true, 'blackout');
        if (t >= 15) w.spawnWave(groups[(Math.floor(t / 5) + 3) % groups.length], pool, 3, 0.6, true, 'blackout');
      });
      w.after(40, () => {
        w.setBlackout(false);
        w.setAlarm(false);
        w.flags.power = true;
        w.openDoor('elevator');
        w.say('pa', 'Сервер перезагружен. Лифты снова работают. Хороших выходных!', 4);
        w.setObjective('К лифтам!', 'elevator');
        if (fresh(w)) {
          // D66: behind the lift doors — a meeting nobody could leave during the blackout
          const hall = w.objects('trigger', 'elevator')[0];
          const cx = hall ? hall.x + hall.w / 2 : 53.5 * T, cy = hall ? hall.y + hall.h + 1.6 * T : 7.6 * T;
          const team = MEETING.map(([id, kind, name, dx, dy, turn, line]) => ({ n: w.addNpc(id, kind, name, cx + dx * T, cy + dy * T, { angle: dy > 0 ? -90 : 90, tag: 'meeting', turn }), turn, line }));
          w.setObjective('Лифтовый холл: там… планёрка?', 'coach');
          team.forEach(({ n, line }, i) => w.after(1 + i * 1.7, () => w.say(n.id, line, 2.6)));
          const t0 = 1 + team.length * 1.7 + 0.6;
          w.after(t0, () => w.say('coach', 'И последний пункт повестки… КО-КО-КО-КУКАРЕКУ!', 2.6));
          w.after(t0 + 0.4, () => w.say('pa', 'Напоминаем: совещания в лифтах запрещены регламентом. Нарушители будут ощипаны.', 4.5));
          team.forEach(({ n, turn }, i) => w.after(t0 + 0.8 + i * 0.35, () => w.infect(n, turn, 'meeting')));
          w.after(t0 + 2.4, () => {
            const p = w.anyPlayer;
            if (p) w.say(p.id, 'Даже в лифте планёрка. Даже сейчас.', 2.8);
            w.setObjective('Разогнать планёрку и к лифтам!', 'elevator');
          });
          w.after(t0 + 1, () => { w.flags.meetingDone = true; });
        }
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
