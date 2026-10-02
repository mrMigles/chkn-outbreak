import type { LevelScript } from './types';
import type { World } from '../sim/World';
import type { EnemyType } from '../enemies';

/**
 * Chapter 2, street 2 (D69): through the market (Тётя Валя's eggs hatch), the park and the industrial zone
 * to the «Провансаль» checkpoint. Семёныч wants a pass: his relief Толик has it — and Толик is a chicken in the
 * garage now. The gate opens slowly (30 s) while the factory guard comes. Блогер Стёпа streams all the way
 * (or until he turns live on stream — a seeded coin toss).
 */
const GATE = 40;
const stepa = (w: World) => w.npc('blogger');
const STREAM = ['Ставьте лайк, если вы ещё не курица!', 'Чат пишет: «Стёпа, сзади!». Спасибо за донат!', 'Это не постановка! Петухи настоящие! Подписывайтесь!',
  'Коллаборация с курицами? Только по бартеру!', 'Минус подписчик… а, нет, это его клюнули.', 'Стрим идёт уже три часа. Батарея — восемь процентов.'];

function objective(w: World) {
  if (w.finished) return;
  const hasPass = w.players.some(p => p.keys.includes('gate'));
  if (!w.flags.backGate) {
    if (!w.flags.valyaTalked) { w.setObjective(w.flags.marketIn ? 'Как выйти с рынка? Спросить у тёти Вали (яйца)' : 'Объезд через рынок: к заводу «Провансаль»', 'valya'); return; }
    const e = w.enemies.filter(q => ['eggs', 'market'].includes(w.enemyTags.get(q.id) ?? '')).sort((a, c) => a.y - c.y)[0];
    w.setObjective('Отбиться от «свежих яиц» — потом тётя Валя откроет калитку', e ? { x: e.x, y: e.y } : 'valya');
    return;
  }
  if (!w.flags.atGate) { w.setObjective(w.flags.parkSeen ? 'Через сквер — к заводу «Провансаль» (юго-восток)' : 'Через калитку в сквер, к заводу «Провансаль»', w.flags.parkSeen ? 'semyonych' : 'park2'); return; }
  if (!hasPass && !w.flags.gateOpening) {
    const card = w.pickups.find(k => k.key === 'gate');
    const tolik = w.enemies.find(e => e.appearance?.npcId === 'tolik');
    w.setObjective(card ? 'Подобрать пропуск Толика' : 'Пропуск у сменщика Толика — в гараже вахты', card ? { x: card.x, y: card.y } : tolik ? { x: tolik.x, y: tolik.y } : 'garage');
    return;
  }
  if (!w.flags.gateOpening) { w.setObjective('Открыть ворота: пульт в будке вахты', 'gate_panel'); return; }
  if (!w.flags.gateOpen) {
    const pct = Math.min(99, Math.floor((w.time - w.flags.gateAt) / GATE * 100));
    w.setObjective(`Ворота открываются: ${pct}%. Отбить охрану «Провансаля»`);
    return;
  }
  w.setObjective('На завод «Провансаль»!', 'exit2');
}

function hatch(w: World) {
  if (w.flags.eggs) return;
  w.flags.eggs = true; w.flags.eggsAt = w.time; w.flags.valyaTalked = true;
  w.say('valya', 'Яйца! Свежие! Почти не вылу… ой. Вылупляются.', 4);
  w.hatchPods('eggs', 2.5);
  w.spawnWave('market', ['fast', 'normal', 'spitter'], 2 + 2 * w.players.length, .5, true, 'market');
}

const street2: LevelScript = {
  id: 'street2', title: 'Улица. Дорога к «Провансалю»',
  subtitle: 'Рынок, сквер и проходная. Пропуск обязателен',
  next: 'factory', enemyDamage: .85,
  chapterEnd: { title: 'ГЛАВА 2 «ГОРОД» ПРОЙДЕНА', text: 'Вертолёт, бабушка, шаурма и вахтёр позади. Впереди — завод «Провансаль», где всё началось.', award: 'chapter_city' },

  onStart(w) {
    objective(w);
    w.after(2, () => w.say('radio', 'Капитан Крылов: Дорогу к заводу перекрыла фура с майонезом. Идите через рынок. И… не покупайте яйца.', 6));
  },

  onTick(w, dt) {
    const sec = Math.floor(w.time) !== Math.floor(w.time - dt);
    if (sec) objective(w);
    // Стёпа streams; somewhere in the park he may turn live on stream (seeded, once)
    const s = stepa(w);
    if (s && s.mode === 'follow' && !s.mutation && w.time >= (w.flags.streamAt ?? 0)) {
      w.flags.streamAt = w.time + 14;
      w.say(s.id, STREAM[(w.flags.streamN = (w.flags.streamN ?? 0) + 1) % STREAM.length], 3.5, true);
    }
    if (s && s.mode === 'follow' && !s.mutation && w.flags.parkSeen && w.flags.stepaFate === undefined) {
      w.flags.stepaFate = w.rng.chance(.5) ? 'turn' : 'stay';
      if (w.flags.stepaFate === 'turn') w.after(9, () => { const q = stepa(w); if (q && q.mode === 'follow') { w.say(q.id, 'Подписывайтесь… жмите колокольчик… КО-КО-КОЛОКОЛЬЧИК!', 3); w.infect(q, 'fast', 'stepa'); } });
    }
    const mk = w.object('market')!;
    const inMarket = w.humanPlayers.some(p => p.x >= mk.x && p.x <= mk.x + mk.w && p.y >= mk.y && p.y <= mk.y + mk.h);
    if (inMarket && w.flags.marketIn && !w.flags.marketDone && w.time >= (w.flags.marketAt ?? 0)) {
      w.flags.marketAt = w.time + 13;
      if (w.countTag('market') < 8 + 2 * w.players.length) w.spawnWave('market', ['normal', 'fast', 'spitter', 'normal'], 3 + w.players.length, .5, true, 'market');
    }
    if (w.flags.valyaTalked && !w.flags.backGate && w.flags.eggsAt && w.time > w.flags.eggsAt + 4 && !w.countTag('eggs') && w.countTag('market') <= 2) {
      w.flags.backGate = w.flags.marketDone = true;
      w.openDoor('market_gate');
      w.say('valya', 'Ой, ну всё, рынок закрыт. Санитарный день. Калитку открыла — идите через сквер, деточки. И яйца не забудьте! Шучу.', 6);
      objective(w);
    }
    const tolik = w.enemies.find(e => e.appearance?.npcId === 'tolik');
    if (!tolik && w.flags.atGate && !w.flags.tolikSpawned) {
      // the relief is the armored sleeper in the garage: give it a face and a name
      const g = w.enemies.find(e => e.type === 'armored' && w.enemyTags.get(e.id) === 'garage');
      if (g) { g.appearance = { npcId: 'tolik', kind: 'guard', name: 'Сменщик Толик' }; g.hp = g.maxHp = 480 * (1 + .4 * (w.players.length - 1)); w.flags.tolikSpawned = true; }
    }
    if (w.flags.gateOpening && !w.flags.gateOpen) {
      const t = w.time - w.flags.gateAt;
      if (w.time >= w.flags.gateWaveAt) {
        w.flags.gateWaveAt = w.time + 4;
        const pool: EnemyType[] = t < 14 ? ['normal', 'fast', 'armored', 'spitter'] : ['armored', 'fast', 'normal', 'exploder', 'fat', 'spitter'];
        if (w.countTag('gate') < 14 + 4 * w.players.length) w.spawnWave('yard', pool, 3 + Math.floor(t / 13) + w.players.length, .3, true, 'gate');
      }
      if (t >= GATE) {
        w.flags.gateOpen = true;
        w.setAlarm(false);
        w.openDoor('gate');
        w.say('semyonych', 'Проходите. Пропуск отмечен. Время — записано. Петухов за вами — не пущу. Наверное.', 5);
        w.msg('ВОРОТА ОТКРЫТЫ', 'Завод «Провансаль»', 3);
        objective(w);
      }
    }
    const exit = w.object('exit2');
    if (w.flags.gateOpen && exit && !w.finished && w.humanPlayers.length && w.humanPlayers.every(p => p.y >= exit.y - 40)) {
      const q = stepa(w);
      if (q && q.mode === 'follow' && !q.mutation) { w.award('subscribed'); w.say(q.id, 'Стрим окончен! Всем спасибо, все свободны! Дальше — без меня, у меня монтаж.', 4); q.mode = 'gone'; }
      w.completeLevel('factory');
    }
  },

  onTrigger(w, id, by) {
    if (id === 'blogger' && !w.flags.stepaJoined) {
      const s = stepa(w);
      if (s) { w.flags.stepaJoined = true; s.mode = 'follow'; s.follow = by.id; s.rescued = true; w.flags.streamAt = w.time + 8; w.say(s.id, 'О! Живые люди! Я Стёпа, у меня стрим «Апокалипсис по пятницам». Можно с вами? Контент сам себя не снимет!', 6); }
    }
    if (id === 'market' && !w.flags.marketIn) {
      w.flags.marketIn = true;
      for (const e of w.enemies) if (w.enemyTags.get(e.id) === 'market') e.aggro = true;
      w.spawnWave('market', ['normal', 'fast', 'normal'], 3 + w.players.length, .5, true, 'market');
      w.say(by.id, 'Рынок. Свежие овощи, свежие яйца, свежие петухи.', 3);
    }
    if (id === 'eggstall' && !w.flags.eggs) hatch(w);
    if (id === 'park2' && !w.flags.parkSeen) {
      w.flags.parkSeen = true;
      for (const e of w.enemies) if (w.enemyTags.get(e.id) === 'park2') e.aggro = true;
      w.spawnWave('park2', ['normal', 'fast', 'spitter'], 3 + w.players.length, .5, true, 'park2');
    }
    if (id === 'yard' && !w.flags.atGate) {
      w.flags.atGate = true;
      w.say('semyonych', 'Стоять! Проходная! Пропуск? Нету? Пропуск у сменщика, у Толика. Он в гараже. Только он теперь… кукарекает.', 6);
      w.spawnWave('yard', ['normal', 'fast', 'normal'], 3 + w.players.length, .5, true, 'yardwave');
      objective(w);
    }
    if (id === 'garage' && !w.flags.garageSeen) {
      w.flags.garageSeen = true;
      for (const e of w.enemies) if (w.enemyTags.get(e.id) === 'garage') { e.dormant = false; e.aggro = true; }
      const t = w.enemies.find(e => e.appearance?.npcId === 'tolik');
      if (t) w.say(String(t.id), 'Пропуск? КО-КО-КОНТРОЛЬ!', 2.5);
    }
  },

  onUse(w, id, by) {
    if (id !== 'gate_panel') return;
    if (w.flags.gateOpening) { w.say(by.id, 'Ворота уже открываются. Медленно. Очень медленно.'); return; }
    if (!w.players.some(p => p.keys.includes('gate'))) { w.say(by.id, 'Пульт: «Приложите пропуск». Пропуска нет.', 3); return; }
    w.flags.gateOpening = true; w.flags.gateAt = w.time; w.flags.gateWaveAt = w.time + 1.5;
    w.setAlarm(true);
    w.say('pa', 'Внимание! Открытие ворот. Охране «Провансаля» прибыть на проходную. Посторонних — склевать.', 5);
    w.msg('ВОРОТА', `Открываются ${GATE} секунд`, 3);
    objective(w);
  },

  onNpcUse(w, n) {
    if (n.id === 'valya') {
      if (!w.flags.valyaTalked) {
        w.flags.valyaTalked = true;
        w.say(n.id, 'Выход в сквер? Через мою калитку. Открою — только сначала купите яйца! Свежие! Десяток — сто рублей…', 5);
        w.after(3, () => hatch(w));
      } else w.say(n.id, w.flags.backGate ? 'Калитка открыта, деточки.' : 'Не берёте яйца — берите ноги в руки!', 3);
      objective(w);
      return true;
    }
    if (n.id === 'rustam') {
      if (!w.flags.rustam) { w.flags.rustam = true; w.say(n.id, 'До завода не повезу — петухи на маршруте. Держи бронежилет, остался от пассажира. Пассажир… улетел.', 5); w.addPickup('armor', n.x - 50, n.y + 40, { ttl: -1 }); }
      else w.say(n.id, 'Только наличные!', 2);
      return true;
    }
    if (n.id === 'semyonych') { w.say(n.id, w.players.some(p => p.keys.includes('gate')) ? 'Пропуск вижу. Пульт — в будке.' : 'Пропуск у Толика. Толик в гараже. Толик — петух.', 3); return true; }
  },

  onKill(w, e) {
    if (e.appearance?.npcId === 'tolik' && !w.flags.tolikDead) {
      w.flags.tolikDead = true;
      w.addPickup('keycard', e.x, e.y, { key: 'gate', ttl: -1 });
      w.say('semyonych', 'Толик… Ну хоть пропуск не съел. Неси его сюда, в будку!', 4);
      objective(w);
    }
    if (e.appearance?.npcId === 'blogger') w.say(w.anyPlayer?.id ?? 'radio', 'Стрим окончен. Отписываемся.', 3);
  },

  onNpcLost(w, n) { if (n.id === 'blogger') w.msg('ЭФИР ПРЕРВАН', 'Стёпа стал контентом', 3); },

};
export default street2;
