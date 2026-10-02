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
      else if (w.flags.irinaAsked && forms(w) < 3) for (const f of ['form1', 'form2', 'form3']) { if (!w.flags[f]) t.push(f); }
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
  const waves: [number, EnemyType[]][] = [[0, ['normal', 'fast', 'fast', 'normal']], [25, ['spitter', 'normal', 'exploder', 'fast']], [50, ['armored', 'normal', 'fast', 'normal', 'fat']]];
  for (const [at, types] of waves) w.after(at, () => {
    if (w.flags.meetingDone) return;
    w.spawnWave('meeting', types, 5 + 3 * w.players.length, .4, true, 'meeting');
    w.say('pa', ['Отдел продаж — на совещание!', 'Бухгалтерия — с отчётами!', 'Служба безопасности — проверить пропуска!'][at / 25], 3);
  });
  w.every(5, () => {
    if (w.flags.meetingDone || !w.flags.meeting) return;
    const t = w.time - (w.flags.meetingEnd - MEETING);
    if (w.countTag('meeting') < 9 + 3 * w.players.length) w.spawnWave('meeting', t < 25 ? ['normal', 'fast'] : t < 50 ? ['spitter', 'normal', 'fast'] : ['armored', 'fast', 'normal'], 2 + Math.floor(w.players.length / 2), .4, true, 'meeting');
  });
  objective(w);
}

const office11: LevelScript = {
  id: 'office11', title: 'Этаж 11. Начальство',
  subtitle: 'Без записи не входить. С перьями — тем более',
  next: 'cafe12', enemyDamage: .85,

  onStart(w) {
    objective(w);
    w.after(1.5, () => w.say('pa', 'Добро пожаловать на этаж руководства. Сохраняйте субординацию и спокойствие. Именно в этом порядке.', 5));
    w.after(6, () => w.say(w.anyPlayer?.id ?? 'pa', 'Тихо, ковры, портреты… Здесь даже петухи в галстуках?', 3));
  },

  onTick(w, dt) {
    const sec = Math.floor(w.time) !== Math.floor(w.time - dt);
    if (sec) objective(w);
    // corridor stragglers until the meeting
    if (!w.flags.meeting && w.time >= (w.flags.strayAt ?? 30)) {
      w.flags.strayAt = w.time + 20;
      if (w.countTag('stray') < 6) w.spawnWave('corridor', ['normal', 'fast', 'spitter'], 2 + w.players.length, .5, true, 'stray', true);
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
      d.hp = d.maxHp = 2000 * (1 + .45 * (w.players.length - 1)); d.speedMul = 1.3; d.abilityCd = 4;
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

  onUse(w, id, by) {
    if (!id.startsWith('form')) return;
    if (w.flags[id]) return;
    w.flags[id] = true;
    const n = forms(w);
    w.say(by.id, ['Анкета: «Как вы оцениваете эпидемию по шкале от 1 до КО»?', 'Анкета: «Ваш руководитель — петух? Да / Скорее да»', 'Третья анкета. Ирина будет счастлива. Наверное.'][n - 1], 3.5);
    w.spawnWave('hr', ['normal', 'fast', 'spitter'], 3 + w.players.length, .4, true, 'hr');
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

  onPickup(w, k) {
    if (k.kind !== 'keycard') return;
    if (VISAS.every(v => has(w, v)) && !w.flags.bureaucrat) { w.flags.bureaucrat = true; w.award('bureaucrat'); w.say('radio', 'Неля: Три визы! Бегом к Жанне, пока она не ушла на обед.', 4); }
    objective(w);
  },
};
export default office11;
