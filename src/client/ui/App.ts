import Phaser from 'phaser';
import { sfx } from '../audio/Sfx';
import { LocalSession, Session } from '../net/Session';
import { LEVELS, FIRST_LEVEL } from '../../shared/levels';
import type { Carry } from '../../shared/sim/World';
import type { TiledMap } from '../../shared/map';
import { settings, saveSettings } from '../settings';
import { Client, Room } from 'colyseus.js';
import { NetSession } from '../net/NetSession';
import { PLAYER_COLORS } from '../render/Actors';
import type { Snapshot } from '../../shared/protocol';
import type { SimEvent } from '../../shared/sim/types';
import { escapeHtml } from './Hud';
import type { GameSceneData } from '../scenes/GameScene';
import { openEditor, currentLook } from './Editor';
import { lookPortrait } from '../render/Looks';
import { encodeLook } from '../../shared/look';
import { resetTips } from './Tutorial';
import { telegramSession, telegramBack, type TgSession } from '../telegram';
import { music } from '../audio/Music';

/** Menus (HTML/CSS) + game flow (levels, retries, multiplayer lobby). */
export class App {
  ui = document.getElementById('ui')!;
  screen: HTMLDivElement | null = null;
  levelStartCarry: Carry | undefined;
  currentLevel = FIRST_LEVEL;
  booted = false;

  constructor(public game: Phaser.Game) {
    this.show(`<div class="boot"><div class="logo">CHKN<span>OUTBREAK</span></div><div class="boot-bar"><i></i></div></div>`);
    sfx.init();
    (window as any).__sfx = sfx;
    const unlock = () => { sfx.resume(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** Telegram chat room of this session (opened from a chat), if any. */
  tg: TgSession | null = null;

  async ready() {
    this.booted = true;
    // ?level=<id> jumps straight into a level (testing)
    const lv = new URLSearchParams(location.search).get('level');
    if (lv && LEVELS[lv]) { this.startSolo(lv); return; }
    const tg = await telegramSession(this.httpBase());
    if (tg && 'error' in tg) { this.mainMenu(); this.toastMenu('Telegram: ' + tg.error); return; }
    if (tg) { this.tg = tg; settings.name = tg.name; saveSettings(); this.chatRoom(); return; }
    this.mainMenu();
  }

  /** HTTP origin of the game server (Telegram API calls). */
  httpBase() { return this.serverUrl().replace(/^ws/, 'http'); }

  /** Opened from a Telegram chat: go straight into the chat's room. */
  async chatRoom(retry = true) {
    const tg = this.tg;
    if (!tg) return;
    const d = this.show(`<div class="panel center"><h2>КОМНАТА ЧАТА</h2><p class="flavor">${escapeHtml(tg.chatTitle || (tg.personal ? 'Личная комната' : 'Чат'))} · входим как ${escapeHtml(tg.name)}…</p><div class="err"></div>
      <button class="btn ghost" data-a="menu">В меню</button></div>`);
    d.addEventListener('click', (e) => { if ((e.target as HTMLElement).dataset.a === 'menu') this.leaveRoom(); });
    const ok = await this.connect('join', tg.code, d.querySelector('.err')!);
    if (!ok && retry && this.screen === d) {
      // the room may have closed between the session and the join: ask the server to raise it again
      const again = await telegramSession(this.httpBase());
      if (again && !('error' in again)) { this.tg = again; this.chatRoom(false); }
    }
  }

  show(html: string) {
    this.screen?.remove();
    // a menu/result panel replaces the game view: no tutorial card may stay on top of it
    this.ui.querySelectorAll('.tip-card').forEach((e) => e.remove());
    const d = document.createElement('div');
    d.className = 'overlay screen';
    d.innerHTML = html;
    this.ui.appendChild(d);
    this.screen = d;
    d.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => sfx.play('ui', { vol: 0.6 })));
    return d;
  }
  hide() { this.screen?.remove(); this.screen = null; }

  mainMenu() {
    this.stopGame();
    telegramBack(null);
    const d = this.show(`
      <div class="menu">
        <div class="logo big" data-a="logo">CHKN<span>OUTBREAK</span></div>
        <div class="tagline">ООО «Курятник» · пятница, 17:55 · эпидемия</div>
        <div class="me-card">
          <img class="me-portrait" src="${lookPortrait(encodeLook(currentLook()), false, 2)}" alt="">
          <div class="me-fields">
            <label class="field"><span>Имя сотрудника</span><input class="name" maxlength="14" value="${escapeHtml(settings.name)}"></label>
            <button class="btn tiny" data-a="look">Изменить внешность</button>
          </div>
        </div>
        ${this.tg ? `<button class="btn primary" data-a="chat">Играть с чатом · ${escapeHtml(this.tg.chatTitle || 'комната чата')}</button>` : ''}
        <button class="btn ${this.tg ? '' : 'primary'}" data-a="solo">Одиночная игра</button>
        <div class="row">
          <button class="btn" data-a="host">Создать комнату</button>
          <button class="btn" data-a="join">Войти по коду</button>
        </div>
        <button class="btn ghost" data-a="arena">Полигон (тест оружия)</button>
        ${localStorage.getItem('chkn-last-room') ? '<button class="btn ghost" data-a="resume-room">Продолжить последнюю комнату</button>' : ''}
        ${settings.dev ? `<div class="dev-box">
          <div class="dev-title">DEV-режим <button class="btn tiny ghost" data-a="devoff" title="Выключить">✕</button></div>
          <div class="row small">
            <select class="dev-level">${Object.values(LEVELS).map((l) => `<option value="${l.id}" ${l.id === settings.devLevel ? 'selected' : ''}>${escapeHtml(l.id + ' — ' + l.title)}</option>`).join('')}</select>
            <button class="btn tiny primary" data-a="devplay">Играть</button>
          </div>
          <div class="row small">
            <label class="field inline check"><input type="checkbox" class="dev-god" ${settings.devGod ? 'checked' : ''}><span>Бессмертие</span></label>
            <label class="field inline check"><input type="checkbox" class="dev-arsenal" ${settings.devArsenal ? 'checked' : ''}><span>Всё оружие</span></label>
          </div>
          <div class="dev-help">«Создать комнату» стартует с выбранного уровня. В игре (соло): F6 — бессмертие, F7 — всё оружие, F8 — убить всех, F9 — пройти уровень.</div>
        </div>` : ''}
        <div class="row small">
          <label class="field inline"><span>Громкость</span><input type="range" class="vol" min="0" max="1" step="0.05" value="${settings.volume}"></label>
          <label class="field inline"><span>Тряска</span><input type="range" class="shake" min="0" max="1.5" step="0.1" value="${settings.shake}"></label>
        </div>
        <div class="row small">
          <label class="field inline"><span>Музыка</span><input type="range" class="mus" min="0" max="1" step="0.05" value="${settings.music}"></label>
          <label class="field inline check"><input type="checkbox" class="tips" ${settings.tutorials ? 'checked' : ''}><span>Подсказки</span></label>
          <button class="btn tiny ghost" data-a="tipsreset" title="Показать все подсказки заново">↺</button>
        </div>
        <div class="controls-help">
          <b>ПК:</b> WASD — движение · мышь — прицел · ЛКМ — огонь · R — перезарядка · E — действие · колесо/1–7 — оружие<br>
          <b>Телефон:</b> левый стик — движение · правый стик — прицел и автоогонь
        </div>
        <a href="credits.html" target="_blank" rel="noopener" style="color:#acb4bd;font-size:13px">Авторы графики и лицензии</a>
      </div>`);
    const name = d.querySelector<HTMLInputElement>('.name')!;
    name.addEventListener('change', () => { settings.name = name.value.trim() || 'Сотрудник'; saveSettings(); });
    d.querySelector<HTMLInputElement>('.vol')!.addEventListener('input', (e) => { settings.volume = +(e.target as HTMLInputElement).value; sfx.setVolume(settings.volume); saveSettings(); });
    d.querySelector<HTMLInputElement>('.shake')!.addEventListener('input', (e) => { settings.shake = +(e.target as HTMLInputElement).value; saveSettings(); });
    d.querySelector<HTMLInputElement>('.mus')!.addEventListener('input', (e) => { settings.music = +(e.target as HTMLInputElement).value; saveSettings(); });
    d.querySelector<HTMLInputElement>('.tips')!.addEventListener('change', (e) => { settings.tutorials = (e.target as HTMLInputElement).checked; saveSettings(); });
    const devLevel = d.querySelector<HTMLSelectElement>('.dev-level');
    devLevel?.addEventListener('change', () => { settings.devLevel = devLevel.value; saveSettings(); });
    d.querySelector<HTMLInputElement>('.dev-god')?.addEventListener('change', (e) => { settings.devGod = (e.target as HTMLInputElement).checked; saveSettings(); });
    d.querySelector<HTMLInputElement>('.dev-arsenal')?.addEventListener('change', (e) => { settings.devArsenal = (e.target as HTMLInputElement).checked; saveSettings(); });
    let logoTaps = 0, logoT = 0;
    music.set('calm');
    sfx.setVolume(settings.volume);
    d.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      settings.name = name.value.trim() || 'Сотрудник'; saveSettings();
      if (a === 'solo') { this.levelStartCarry = undefined; this.startSolo(FIRST_LEVEL); }
      if (a === 'arena') { this.levelStartCarry = undefined; this.startSolo('arena'); }
      if (a === 'host' || a === 'join') this.multiplayer(a);
      if (a === 'resume-room') { this.multiplayer('join'); const input = this.screen?.querySelector<HTMLInputElement>('.code-input'); if (input) input.value = localStorage.getItem('chkn-last-room') || ''; }
      if (a === 'look') { const host = this.show(''); openEditor(host, () => this.mainMenu()); }
      if (a === 'tipsreset') { resetTips(); this.toastMenu('Подсказки будут показаны снова'); }
      if (a === 'chat') this.chatRoom();
      if (a === 'devplay') { this.levelStartCarry = undefined; this.startSolo(settings.devLevel); }
      if (a === 'devoff') { settings.dev = false; saveSettings(); this.mainMenu(); }
      if ((e.target as HTMLElement).closest('[data-a="logo"]')) {
        logoTaps = performance.now() - logoT < 600 ? logoTaps + 1 : 1; logoT = performance.now();
        if (logoTaps >= 5) { settings.dev = !settings.dev; saveSettings(); this.mainMenu(); this.toastMenu(settings.dev ? 'DEV-режим включён' : 'DEV-режим выключен'); }
      }
    });
  }

  private stopGame() {
    if (this.game.scene.isActive('game')) this.game.scene.stop('game');
  }

  startSolo(levelId: string, carry?: Carry) {
    this.currentLevel = levelId;
    this.levelStartCarry = carry;
    const json = this.game.cache.tilemap.get('map_' + levelId).data as TiledMap;
    const session = new LocalSession(levelId, json, settings.name, carry, 1, settings.look);
    if (settings.dev) {
      session.world.god = settings.devGod;
      if (settings.devArsenal) session.world.devArsenal(session.world.players[0]);
    }
    this.runSession(session);
  }

  runSession(session: Session) {
    this.hide();
    this.stopGame();
    const lvl = LEVELS[session.levelId];
    const data: GameSceneData = {
      session,
      onEnd: (ev) => {
        if (ev.kind === 'quit') { if (session.solo) this.mainMenu(); else this.leaveRoom(); return; }
        if (!session.solo) return; // multiplayer flow is driven by the server
        if (ev.kind === 'level') this.levelComplete(session, ev.next, ev.win);
        else this.gameOver(ev.reason ?? '');
      },
    };
    this.game.scene.start('game', data);
    this.titleCard(lvl?.title ?? '', lvl?.subtitle ?? '');
  }

  titleCard(title: string, sub: string) {
    this.ui.querySelectorAll('.title-card').forEach(card => card.remove());
    const d = document.createElement('div');
    d.className = 'title-card';
    d.innerHTML = `<div class="tc-title">${escapeHtml(title)}</div><div class="tc-sub">${escapeHtml(sub)}</div>`;
    this.ui.appendChild(d);
    setTimeout(() => d.remove(), 3600);
  }

  levelComplete(session: Session, next?: string, win?: boolean) {
    const me = session.view.players.find((p) => p.id === session.myId);
    const carry = session.carry();
    const d = this.show(`<div class="panel center">
      <h2>${win ? 'ПОБЕДА!' : 'ЭТАП ПРОЙДЕН'}</h2>
      <div class="stats"><div><b>${me?.kills ?? 0}</b><span>куриц оптимизировано</span></div><div><b>${Math.floor(me?.score ?? 0)}</b><span>KPI</span></div></div>
      ${win ? '<p class="flavor">Вы выбрались из «Курятника». Понедельник отменяется навсегда.</p>' : ''}
      <button class="btn primary" data-a="${win || !next || !LEVELS[next] ? 'menu' : 'next'}">${win || !next || !LEVELS[next] ? 'В главное меню' : 'Дальше'}</button></div>`);
    d.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === 'next' && next) this.startSolo(next, carry);
      if (a === 'menu') this.mainMenu();
    });
  }

  gameOver(reason: string) {
    this.stopGame();
    const d = this.show(`<div class="panel center">
      <h2 class="bad">КО-КО-КОНЕЦ</h2>
      <p class="flavor">${escapeHtml(reason)}</p>
      <button class="btn primary" data-a="retry">Заново с начала этапа</button>
      <button class="btn" data-a="menu">В главное меню</button></div>`);
    d.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === 'retry') this.startSolo(this.currentLevel, this.levelStartCarry);
      if (a === 'menu') this.mainMenu();
    });
  }

  // ------------------------------------------------------------------ multiplayer (Colyseus)
  room: Room | null = null;
  net: NetSession | null = null;
  private netResult = false;
  private resultHost = false;

  serverUrl() {
    if (settings.server) return settings.server;
    const secure = location.protocol === 'https:';
    // dev: Vite on 5280, Colyseus on 2580; prod: the game server also serves the client
    return import.meta.env.DEV ? `ws://${location.hostname}:2580` : `${secure ? 'wss' : 'ws'}://${location.host}`;
  }

  multiplayer(mode: 'host' | 'join') {
    if (mode === 'join') {
      const d = this.show(`<div class="panel center"><h2>ВОЙТИ ПО КОДУ</h2>
        <input class="code-input" maxlength="4" placeholder="ABCD" autocomplete="off" style="text-align:center;letter-spacing:10px;text-transform:uppercase">
        <div class="err"></div>
        <button class="btn primary" data-a="go">Войти</button>
        <button class="btn ghost" data-a="back">Назад</button></div>`);
      const inp = d.querySelector<HTMLInputElement>('.code-input')!;
      inp.focus();
      const go = () => this.connect('join', inp.value.trim().toUpperCase(), d.querySelector('.err')!);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      d.addEventListener('click', (e) => {
        const act = (e.target as HTMLElement).dataset.a;
        if (act === 'go') go();
        if (act === 'back') this.mainMenu();
      });
      return;
    }
    const d = this.show(`<div class="panel center"><h2>СОЗДАНИЕ КОМНАТЫ</h2><p class="flavor">Подключаемся к серверу…</p><div class="err"></div>
      <button class="btn ghost" data-a="back">Назад</button></div>`);
    d.addEventListener('click', (e) => { if ((e.target as HTMLElement).dataset.a === 'back') this.leaveRoom(); });
    this.connect('host', '', d.querySelector('.err')!);
  }

  private async connect(mode: 'host' | 'join', code: string, err: Element): Promise<boolean> {
    try {
      const client = new Client(this.serverUrl());
      if (mode === 'join') await fetch(this.httpBase() + '/api/rooms/resume', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ code }) }).catch(() => null);
      const room = mode === 'host'
        ? await client.create('game', { name: settings.name, look: settings.look, ...(settings.dev && LEVELS[settings.devLevel] ? { level: settings.devLevel } : {}) })
        : await client.joinById(code, { name: settings.name, look: settings.look });
      this.bindRoom(room, client);
      localStorage.setItem('chkn-last-room', room.roomId);
      if (room.state.phase === 'lobby') this.lobby();
      return true;
    } catch (e) {
      err.textContent = mode === 'join' ? 'Комната не найдена или заполнена.' : 'Сервер недоступен (запустите npm run server).';
      console.warn(e);
      return false;
    }
  }

  private bindRoom(room: Room, client: Client) {
    this.room = room;
    this.netResult = false;
    let recoveredPhase = '';
    const restorePhase = () => {
      if (this.room !== room) return;
      if (room.state.phase === 'lobby' && !this.game.scene.isActive('game')) this.lobby();
      // Initial state also recovers if the start message arrived during rejoin.
      if (room.state.phase === 'playing' && !this.net && (!this.netResult || recoveredPhase === 'defeat' || recoveredPhase === 'between')) this.netStart(room.state.level);
      if (!this.net && room.state.phase !== recoveredPhase) {
        if (room.state.phase === 'between' && !this.netResult) {
          const panel = this.show('<div class="panel center"><h2>КОМАНДА НА ПЕРЕДЫШКЕ</h2><p class="flavor">Соединение восстановлено. Ждём начала следующего боя…</p><button class="btn ghost">Выйти в меню</button></div>');
          panel.querySelector('button')!.addEventListener('click', () => this.leaveRoom());
        }
        if (room.state.phase === 'over') this.netEnd({ kind: 'win', stats: [] });
      }
      if (!this.net && room.state.phase === 'defeat' && (!this.netResult || !!room.state.players.get(room.sessionId)?.host !== this.resultHost)) this.netEnd({ kind: 'gameover', reason: room.state.reason, stats: [] });
      recoveredPhase = room.state.phase;
    };
    room.onStateChange(restorePhase);
    room.onMessage('start', (m: { level: string }) => { if (this.room === room) this.netStart(m.level); });
    room.onMessage('snap', (snap: Snapshot) => { if (this.room === room) this.net?.onSnapshot(snap); });
    room.onMessage('ev', (ev: SimEvent[]) => { if (this.room === room) this.net?.onEvents(ev); });
    room.onMessage('end', (m: NetEnd) => { if (this.room === room) this.netEnd(m); });
    room.onMessage('lobby', () => { if (this.room === room) { this.stopGame(); this.net = null; this.lobby(); } });
    room.onLeave(() => { if (this.room === room) void this.reconnect(room, client); });
    restorePhase();
  }

  private async reconnect(old: Room, client: Client) {
    const token = old.reconnectionToken;
    this.stopGame(); this.net = null;
    const panel = this.show(`<div class="panel center"><h2>ВОЗВРАЩАЕМСЯ В БОЙ</h2><p class="flavor">Восстанавливаем соединение… Команда ждёт до 25 секунд.</p><button class="btn ghost" data-a="leave">Выйти в меню</button></div>`);
    panel.querySelector('button')!.addEventListener('click', () => this.leaveRoom());
    const deadline = Date.now() + 24000;
    while (this.room === old && Date.now() < deadline) {
      try {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const attempt = client.reconnect(token);
        // Promise.race does not cancel the SDK handshake. Close a connection
        // that completes after the user leaves or after the retry window ends.
        void attempt.then(room => {
          if (this.room !== old || Date.now() >= deadline) void room.leave(true);
        }, () => {});
        const room = await Promise.race([
          attempt,
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Rejoin deadline')), Math.max(1, deadline - Date.now())); }),
        ]).finally(() => clearTimeout(timeout));
        // A cancelled/expired UI must not leave a late successful connection alive.
        if (Date.now() >= deadline) { void room.leave(true); break; }
        if (this.room !== old) { void room.leave(true); return; }
        this.bindRoom(room, client);
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 700));
      }
    }
    if (this.room !== old) return;
    this.room = null; this.mainMenu(); this.toastMenu('Не удалось вернуться. Войдите в комнату по коду.');
  }

  private toastMenu(text: string) {
    const el = this.screen?.querySelector('.tagline');
    if (el) el.textContent = text;
  }

  leaveRoom() {
    const r = this.room;
    this.room = null; this.net = null;
    r?.leave(true);
    this.mainMenu();
  }

  lobby() {
    const room = this.room;
    if (!room) return;
    telegramBack(() => this.leaveRoom());
    const st = room.state;
    const me = st.players.get(room.sessionId);
    const list: string[] = [];
    let allReady = true;
    st.players.forEach((p: any) => {
      if (!p.ready && !p.host) allReady = false;
      const col = '#' + PLAYER_COLORS[p.slot % 4].toString(16).padStart(6, '0');
      const status = (p.host ? 'ведущий' : p.ready ? 'готов' : 'не готов') + (p.connected ? '' : ' · переподключается');
      list.push(`<div class="pl" style="--c:${col}"><b>${escapeHtml(p.name)}${p.id === room.sessionId ? ' (вы)' : ''}</b><span class="st ${p.ready || p.host ? 'ok' : ''}">${status}</span></div>`);
    });
    const action = me?.host
      ? `<button class="btn primary" data-a="start" ${allReady ? '' : 'disabled'}>${allReady ? 'Играть / продолжить' : 'Ждём готовности…'}</button>`
      : `<button class="btn ${me?.ready ? 'ready' : 'primary'}" data-a="ready">${me?.ready ? 'Готов ✓' : 'Готов'}</button>`;
    const chat = (st as any).chat as string;
    const d = this.show(`<div class="panel center">
      <h2>${chat ? 'КОМНАТА ЧАТА' : 'ЛОББИ'}</h2>
      ${chat
        ? `<div class="flavor">«${escapeHtml(chat)}» — все, кто откроет игру из этого чата, попадут сюда. Код для остальных:</div>`
        : '<div class="flavor">Код комнаты — продиктуйте коллегам:</div>'}
      <div class="code">${escapeHtml(st.code)}</div>
      <div class="plist">${list.join('')}</div>
      <div class="flavor" style="font-size:13px">1–4 игрока против стаи. E: нажать — поделиться патронами, держать — лечить или поднять. После смерти вы вернётесь человеком в передышку. Берегитесь: даже союзные сотрудники могут превратиться!</div>
      ${action}
      <button class="btn ghost" data-a="leave">Выйти</button></div>`);
    d.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).dataset.a;
      if (act === 'ready') room.send('ready', { ready: !me?.ready });
      if (act === 'start') room.send('start');
      if (act === 'leave') this.leaveRoom();
    });
  }

  private netStart(level: string) {
    const room = this.room;
    if (!room) return;
    if (this.net?.levelId === level && this.game.scene.isActive('game')) return;
    const json = this.game.cache.tilemap.get('map_' + level)?.data as TiledMap | undefined;
    if (!json) return;
    this.netResult = false;
    const net = new NetSession(room, level, json);
    this.net = net;
    this.runSession(net);
  }

  private netEnd(m: NetEnd) {
    const rows = [...m.stats].sort((a, b) => b.score - a.score).map((p) => {
      const col = '#' + PLAYER_COLORS[p.slot % 4].toString(16).padStart(6, '0');
      return `<div class="pl" style="--c:${col}"><b>${escapeHtml(p.name)}</b><span class="st">☠ ${p.kills} · ★ ${p.score}</span></div>`;
    }).join('');
    const isHost = !!this.room?.state.players.get(this.room.sessionId)?.host;
    this.resultHost = isHost;
    const title = m.kind === 'win' ? 'ПОБЕДА!' : m.kind === 'level' ? 'ЭТАП ПРОЙДЕН' : 'КО-КО-КОНЕЦ';
    const sub = m.kind === 'win' ? 'Корпорация повержена. Понедельник отменён.'
      : m.kind === 'level' ? 'Следующий этап через 5 секунд…' : `${m.reason ?? ''} Повтор — с начала этого этажа. ${isHost ? 'Начните, когда команда готова.' : 'Ждём решения ведущего.'}`;
    this.stopGame();
    this.net = null; this.netResult = true;
    const d = this.show(`<div class="panel center"><h2 class="${m.kind === 'gameover' ? 'bad' : ''}">${title}</h2>
      <p class="flavor">${escapeHtml(sub)}</p><div class="plist">${rows}</div>
      ${m.kind === 'win' && isHost ? '<button class="btn primary" data-a="lobby">В лобби</button>' : ''}
      ${m.kind === 'gameover' && isHost ? '<button class="btn primary" data-a="retry-room">Заново с начала этажа</button>' : ''}
      <button class="btn ghost" data-a="leave">Выйти в меню</button></div>`);
    d.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).dataset.a;
      if (act === 'lobby') this.room?.send('lobby');
      if (act === 'retry-room') this.room?.send('retry');
      if (act === 'leave') this.leaveRoom();
    });
  }
}

interface NetEnd { kind: string; next?: string; reason?: string; stats: { name: string; kills: number; score: number; slot: number }[] }
