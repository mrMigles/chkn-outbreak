import type { LevelScript } from './types';
import type { World } from '../sim/World';
import type { EnemyType } from '../enemies';
import { dist } from '../math';

/**
 * Floor 11 «Начальство» (D69). Жанна lets nobody in without three visas, collected in any order (a team can
 * split): finance (clear Борис's department), HR (three satisfaction forms for Ирина — who then mutates) and
 * legal (escort Пунктович from the archive to reception). Then a 75-second board meeting in three waves, the
 * executive director as an elite chicken, his pass and his private lift to the 12th-floor cafe.
 */
const VISAS = ['visa_fin', 'visa_hr', 'visa_law'];
const MEETING = 75;
const has = (w: World, k: string) => w.players.some(p => p.keys.includes(k));
const give = (w: World, k: string, x: number, y: number) => w.addPickup('keycard', x, y, { key: k, ttl: -1 });
const directorEnemy = (w: World) => w.enemies.find(e => e.appearance?.npcId === 'director');
const irinaEnemy = (w: World) => w.enemies.find(e => e.appearance?.npcId === 'irina');
const forms = (w: World) => ['form1', 'form2', 'form3'].filter(f => w.flags[f]).length;

function objective(w: World) {
  if (w.finished) return;
  const visas = VISAS.filter(k => has(w, k)).length;
  if (!w.flags.metZhanna) { w.setObjective('Приёмная: узнать, как попасть к директору', 'zhanna'); return; }
  if (visas < 3) {
    const t: (string | { x: number; y: number })[] = [];
    const parts: string[] = [];
    const drop = (k: string) => w.pickups.find(q => q.key === k);
    if (!has(w, 'visa_fin')) { const d = drop('visa_fin'); t.push(d ? { x: d.x, y: d.y } : 'boris'); parts.push('финансы'); }
    if (!has(w, 'visa_hr')) {
      const d = drop('visa_hr'), e = irinaEnemy(w);
      if (d) t.push({ x: d.x, y: d.y });
      else if (e) t.push({ x: e.x, y: e.y });
      else if (w.flags.irinaAsked && forms(w) < 3) for (const f of ['form1', 'form2', 'form3']) { const k = w.pickups.find(q => q.key === f); if (!w.flags[f] && k) t.push({ x: k.x, y: k.y }); }
      else t.push('irina');
      parts.push(w.flags.irinaAsked && !w.flags.irinaTurned ? `HR (анкеты ${forms(w)}/3)` : 'HR');
    }
    if (!has(w, 'visa_law')) {
      const d = drop('visa_law'), n = w.npc('punktovich')!;
      // escorting: lead to reception, but back to the lawyer when he falls behind
      const behind = n.mode === 'follow' && !w.humanPlayers.some(p => dist(p.x, p.y, n.x, n.y) < 450);
      t.push(d ? { x: d.x, y: d.y } : n.mode === 'follow' && !behind ? 'reception' : 'punktovich'); parts.push(w.npc('punktovich')?.mode === 'follow' ? 'юрист → в приёмную' : 'юристы'); }
    w.setObjective(`Собрать три визы (${visas}/3): ${parts.join(', ')}`, t.map(x => typeof x === 'string' ? x : `@${Math.round(x.x)},${Math.round(x.y)}`));
    return;
  }
  if (!w.flags.meeting) { w.setObjective('Три визы есть. К Жанне — пусть запишет к директору', 'zhanna'); return; }
  if (!w.flags.meetingDone) {
    const left = Math.max(0, Math.ceil(w.flags.meetingEnd - w.time));
    const part = left > 50 ? 'отдел продаж' : left > 25 ? 'бухгалтерия' : 'служба безопасности';
    w.setObjective(`Совещание: продержаться ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · ${part}`);
    return;
  }
  const d = directorEnemy(w);
  if (!w.flags.directorDead) { w.setObjective('Уволить Петуха-директора', d ? { x: d.x, y: d.y } : 'director'); return; }
  const pass = w.pickups.find(k => k.key === 'f12');
  if (pass) { w.setObjective('Подобрать пропуск директора на 12 этаж', { x: pass.x, y: pass.y }); return; }
  w.setObjective('В личный лифт директора — на 12 этаж, в кафе', 'lift11');
}

function startMeeting(w: World) {
  w.flags.meeting = true;
  w.flags.meetingEnd = w.time + MEETING;
  w.openDoor('board_door');
  w.setAlarm(true);
  w.say('pa', 'Внимание! Совещание начинается. Явка обязательна. Опоздавшие будут склёваны.', 5);
  w.msg('СОВЕЩАНИЕ', '75 секунд. Три отдела. Ни одного перерыва', 3);
  // D72: twice the chickens, arriving in packs, more heavy ones — still a 75-second fight, not a wall
  const waves: [number, EnemyType[], EnemyType[]][] = [
    [0, ['normal', 'fast', 'fast', 'normal'], ['armored', 'normal', 'fast']],
    [25, ['spitter', 'normal', 'exploder', 'fast'], ['fat', 'armored', 'spitter', 'normal']],
    [50, ['armored', 'normal', 'fast', 'normal', 'fat'], ['armored', 'fat', 'exploder', 'armored', 'fast']],
  ];
  for (const [at, types, heavy] of waves) w.after(at, () => {
    if (w.flags.meetingDone) return;
    w.spawnWave('meeting', types, 6 + 3 * w.players.length, .12, true, 'meeting');
    w.after(4, () => { if (!w.flags.meetingDone) w.spawnWave('meeting', heavy, 4 + 2 * w.players.length, .15, true, 'meeting'); });
    w.say('pa', ['Отдел продаж — на совещание!', 'Бухгалтерия — с отчётами!', 'Служба безопасности — проверить пропуска!'][at / 25], 3);
  });
  w.every(5, () => {
    if (w.flags.meetingDone || !w.flags.meeting) return;
    const t = w.time - (w.flags.meetingEnd - MEETING);
    if (w.countTag('meeting') < 16 + 5 * w.players.length) w.spawnWave('meeting', t < 25 ? ['normal', 'fast', 'fast', 'armored'] : t < 50 ? ['spitter', 'normal', 'fast', 'armored'] : ['armored', 'fast', 'normal', 'fat'], 4 + w.players.length, .14, true, 'meeting');
  });
  w.addPickup('health', 32.5 * 64, 32 * 64, { ttl: -1 });
  objective(w);
}

/** D72: a little scene around each satisfaction form. */
const SCENES: Record<string, { names: [string, string][]; look: string[]; lines: string[]; chicks?: number }> = {
  scene1: { names: [['Хэдхантер · высиживает анкету', 'arkady'], ['Кандидат в резерв', 'manBlue']], look: [], lines: ['Не трогать! Я высиживаю кадровый резерв!', 'Кандидаты, на собеседование! Вопрос первый: КО?'], chicks: 3 },
  scene2: { names: [['Тамада корпоратива', 'scientist'], ['Хор отдела закупок', 'womanGreen']], look: [], lines: ['А сейчас — хит года: «Анкета моя, анкета»!', 'КО-КО-КО-О-О! Все вместе! Припев!'] },
  scene3: { names: [['Петух-нотариус', 'punktovich'], ['Присяжный', 'manOld']], look: [], lines: ['Пункт три: «Довольны ли вы руководством?» Ответ: «КО». Протестую!', 'Суд удаляется на совещание. С клювом!'] },
};
function scene(w: World, id: string, by: string) {
  if (w.flags[id]) return;
  w.flags[id] = true;
  const s = SCENES[id];
  const list = w.enemies.filter(e => w.enemyTags.get(e.id) === id);
  const lead = list[0];
  if (!lead) return;
  w.say(String(lead.id), s.lines[0], 3.5);
  w.after(2.2, () => {
    const q = list.find(e => e !== lead && e.hp > 0);
    if (q) w.say(String(q.id), s.lines[1], 3);
  });
  w.after(3.4, () => {
    for (const e of list) { e.dormant = false; e.aggro = true; }
    if (s.chicks && lead.hp > 0) for (let i = 0; i < s.chicks + w.players.length; i++) w.spawnEnemy('chick', lead.x + (i - 1.5) * 26, lead.y + 30, { how: 'egg', aggro: true, tag: id });
    w.spawnWave('hr', ['normal', 'fast', 'spitter', 'normal'], 2 + 2 * w.players.length, .3, true, 'hr');
  });
  w.moment(by, id === 'scene1' ? 'Отобрал(а) анкету у петуха-хэдхантера, пока тот высиживал' : id === 'scene2' ? 'Сорвал(а) караоке на корпоративе отдела закупок' : 'Прервал(а) заседание петушиного суда');
}

const office11: LevelScript = {
  id: 'office11', title: 'Этаж 11. Начальство', rev: 2,
  subtitle: 'Без записи не входить. С перьями — тем более',
  next: 'cafe12', enemyDamage: .85,

  onStart(w) {
    objective(w);
    for (const [id, s] of Object.entries(SCENES)) {
      const list = w.enemies.filter(e => w.enemyTags.get(e.id) === id);
      list.forEach((e, i) => { const [name, kind] = s.names[i === 0 ? 0 : 1]; e.appearance = { npcId: `${id}_${i}`, kind, name }; });
    }
    w.after(1.5, () => w.say('pa', 'Добро пожаловать на этаж руководства. Сохраняйте субординацию и спокойствие. Именно в этом порядке.', 5));
    w.after(6, () => w.say(w.anyPlayer?.id ?? 'pa', 'Тихо, ковры, портреты… Здесь даже петухи в галстуках?', 3));
  },

  onTick(w, dt) {
    const sec = Math.floor(w.time) !== Math.floor(w.time - dt);
    if (sec) objective(w);
    // corridor stragglers until the meeting
    if (!w.flags.meeting && w.time >= (w.flags.strayAt ?? 24)) {
      // D72: the floor felt empty — stragglers come more often and in bigger groups
      w.flags.strayAt = w.time + 15;
      if (w.countTag('stray') < 10) w.spawnWave('corridor', ['normal', 'fast', 'spitter', 'normal', 'armored'], 3 + w.players.length, .4, true, 'stray', true);
    }
    // the intern with 40 slides
    const g = w.npc('intern11');
    if (g && !g.mutation && g.mode === 'idle' && w.humanPlayers.some(p => dist(p.x, p.y, g.x, g.y) < 260)) {
      w.say(g.id, 'Слайд сорок один: «Мы все… ко-ко-команда»!', 3);
      w.infect(g, 'fast', 'stray');
    }
    const irina = irinaEnemy(w);
    if (irina && !w.flags.irinaScaled) { w.flags.irinaScaled = true; irina.hp = irina.maxHp = 420 * (1 + .4 * (w.players.length - 1)); irina.speedMul = 1.25; w.setBoss(irina, 'HR-петух · Ирина Тимбилдинговна'); }
    if (w.flags.meeting && !w.flags.meetingDone && w.time >= w.flags.meetingEnd) {
      w.flags.meetingDone = true;
      w.setAlarm(false);
      w.openDoor('director_door');
      const n = w.npc('director')!;
      w.say(n.id, 'Совещание окончено. Теперь окончены ВЫ. Без выходного пособия!', 4);
      w.infect(n, 'fat', 'director');
      w.msg('ИСПОЛНИТЕЛЬНЫЙ ДИРЕКТОР', 'Принимает лично', 3);
      objective(w);
    }
    const d = directorEnemy(w);
    if (d && !w.flags.directorScaled) {
      w.flags.directorScaled = true;
      d.hp = d.maxHp = 2300 * (1 + .45 * (w.players.length - 1)); d.speedMul = 1.3; d.abilityCd = 4;
      w.setBoss(d, 'Петух-директор · исполнительный');
      w.flags.supportAt = w.time + 10;
    }
    if (d && w.time >= w.flags.supportAt) {
      w.flags.supportAt = w.time + 14;
      if (w.countTag('board11') < 12) w.spawnWave('board11', ['fast', 'normal', 'armored', 'spitter'], 3 + w.players.length, .3, true, 'board11');
      w.say(String(d.id), w.rng.pick(['Внеочередное совещание!', 'Премии не будет! НИКОМУ!', 'Отдел кадров — ко мне!']), 2.5);
    }
    if (d && !w.flags.directorHalf && d.hp < d.maxHp / 2) {
      w.flags.directorHalf = true;
      w.say(String(d.id), 'Я… не курица! Я — ВЕРТИКАЛЬ ВЛАСТИ!', 3);
      w.spawnWave('board11', ['fast', 'fast', 'exploder', 'normal'], 4 + 2 * w.players.length, .3, true, 'board11');
      w.addPickup('health', d.x, d.y + 40, { ttl: 30 });
    }
    const lift = w.object('lift11');
    if (w.flags.directorDead && has(w, 'f12') && lift && !w.finished && w.humanPlayers.length && w.humanPlayers.every(p => p.x >= lift.x && p.x <= lift.x + lift.w && p.y >= lift.y && p.y <= lift.y + lift.h)) {
      w.say('radio', 'Неля: Двенадцатый — кафе! Там панорамные окна и… пахнет курочкой. Подозрительно.', 5);
      w.completeLevel('cafe12');
    }
  },

  onTrigger(w, id, by) {
    if (id in SCENES) scene(w, id, by.id);
    if (id === 'finance' && !w.flags.finSeen) {
      w.flags.finSeen = true;
      w.say('boris', 'Сюда! Отдел сам себя оптимизировал! Сократите их — подпишу что угодно!', 4);
      w.spawnWave('fin', ['normal', 'fast', 'normal'], 4 + w.players.length, .5, true, 'fin');
      for (const e of w.enemies) if (w.enemyTags.get(e.id) === 'fin') e.aggro = true;
    }
    if (id === 'archive' && !w.flags.lawSeen) {
      w.flags.lawSeen = true;
      w.say('punktovich', 'Согласно пункту 4.2 — я здесь! И я боюсь!', 3);
      for (const e of w.enemies) if (w.enemyTags.get(e.id) === 'law') e.aggro = true;
    }
    if (id === 'reception' && w.npc('punktovich')?.mode === 'follow' && !w.flags.lawDone) {
      w.flags.lawDone = true;
      const n = w.npc('punktovich')!;
      n.mode = 'idle'; n.follow = null;
      w.say(n.id, 'Виза юридического отдела. Подпись, печать, ещё печать. Не благодарите — это пункт 7.', 4);
      give(w, 'visa_law', n.x + 40, n.y + 30);
      objective(w);
    }
    if (id === 'boardroom' && w.flags.meeting && !w.flags.boardSaid) { w.flags.boardSaid = true; w.say(by.id, 'Длинный стол, пустые стулья. Сейчас начнётся…', 2.5); }
  },

  onRescue(w, n, by) {
    if (n.id === 'boris') {
      n.mode = 'idle';
      w.say(n.id, 'Сокращение штата — моя специальность. Держите визу. И чек на… а, нет, бюджет урезан.', 5);
      give(w, 'visa_fin', n.x - 50, n.y + 40);
      objective(w);
    }
    if (n.id === 'punktovich') {
      n.mode = 'follow'; n.follow = by.id;
      w.say(n.id, 'Проводите меня в приёмную. Визу ставлю только там — регламент!', 4);
      objective(w);
    }
  },

  onNpcUse(w, n) {
    if (n.id === 'zhanna') {
      const visas = VISAS.filter(k => has(w, k)).length;
      if (!w.flags.metZhanna) {
        w.flags.metZhanna = true;
        w.say(n.id, 'Без записи к директору нельзя. Запись — по трём визам: финансы, HR и юристы. Как всегда.', 6);
        w.after(6, () => w.say(n.id, 'Финансы — запад, HR — восток, юристы — архив на юго-западе. Не перепутайте этажи, у нас их одиннадцать.', 6));
      } else if (visas < 3) w.say(n.id, `Виз: ${visas} из трёх. Я никуда не тороплюсь. У меня обед до шести.`, 4);
      else if (!w.flags.meeting) {
        w.say(n.id, 'Три визы… Безупречно. Директор примет вас. Но сначала — совещание. Проходите в переговорную.', 5);
        startMeeting(w);
      } else w.say(n.id, 'Директор занят. Он… кудахчет.', 3);
      objective(w);
      return true;
    }
    if (n.id === 'irina') {
      if (!w.flags.irinaAsked) {
        w.flags.irinaAsked = true;
        w.say(n.id, 'Виза HR? Сначала три анкеты удовлетворённости! Они где-то на этаже. Без анкет — никакого счастья.', 6);
      } else if (forms(w) < 3) w.say(n.id, `Анкет: ${forms(w)} из трёх. Ваша удовлетворённость важна для нас!`, 3);
      else if (!w.flags.irinaTurned) {
        w.flags.irinaTurned = true;
        w.say(n.id, 'Так… «Удовлетворены ли вы петухами?» — «НЕТ»… Ваша удовлетворённость… КО-КО-КОЛЛЕКТИВНАЯ!', 5);
        w.infect(n, 'spitter', 'hr');
        w.spawnWave('hr', ['fast', 'normal', 'normal'], 4 + w.players.length, .4, true, 'hr');
      }
      objective(w);
      return true;
    }
    if (n.id === 'director' || n.id === 'boris' || n.id === 'punktovich') {
      if (n.id === 'director') w.say(n.id, 'Запишитесь у Жанны.', 2);
      else if (n.id === 'boris' && n.mode === 'cower') w.say(n.id, 'Сначала оптимизируйте этих!', 2);
      else if (n.id === 'boris') w.say(n.id, 'Виза у вас. Бюджет — нет.', 2);
      else if (n.id === 'punktovich' && n.mode === 'cower') w.say(n.id, 'Пока они рядом — я под столом. Пункт 1.1.', 2);
      else if (n.id === 'punktovich' && !w.flags.lawDone) { n.mode = 'follow'; return; }
      return true;
    }
  },

  onPickup(w, k, by) {
    if (k.kind === 'doc' && k.key && !w.flags[k.key]) {
      w.flags[k.key] = true;
      const n = forms(w);
      w.say(by.id, ['Анкета: «Как вы оцениваете эпидемию по шкале от 1 до КО»?', 'Анкета: «Ваш руководитель — петух? Да / Скорее да»', 'Третья анкета. Ирина будет счастлива. Наверное.'][n - 1], 3.5);
      w.spawnWave('hr', ['normal', 'fast', 'spitter'], 3 + w.players.length, .4, true, 'hr');
      if (n === 3) w.say('radio', 'Неля: Три анкеты! Неси Ирине — она в стеклянном кабинете HR.', 4);
      objective(w);
      return;
    }
    if (k.kind !== 'keycard') return;
    if (VISAS.every(v => has(w, v)) && !w.flags.bureaucrat) { w.flags.bureaucrat = true; w.award('bureaucrat'); w.say('radio', 'Неля: Три визы! Бегом к Жанне, пока она не ушла на обед.', 4); }
    objective(w);
  },

  onKill(w, e) {
    if (e.appearance?.npcId === 'irina' && !w.flags.irinaDead) {
      w.flags.irinaDead = true;
      give(w, 'visa_hr', e.x, e.y);
      w.say('radio', 'Неля: Ирина оставила визу. HR всегда оставляет бумаги после себя!', 4);
      objective(w);
    }
    if (e.appearance?.npcId === 'director' && !w.flags.directorDead) {
      w.flags.directorDead = true;
      w.cancelWaves();
      w.award('exec_order');
      w.addPickup('keycard', e.x, e.y, { key: 'f12', ttl: -1 });
      w.msg('ДИРЕКТОР УВОЛЕН', 'Исполнительный лист исполнен', 4);
      objective(w);
    }
  },

};
export default office11;
