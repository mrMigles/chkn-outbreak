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
import { preferencesMarkup, bindPreferences } from './Preferences';
import { ACHIEVEMENTS, isRare, type AchievementKey } from '../../shared/achievements';
import { earnedAchievements, achievementsMarkup } from './AchievementProfile';
import { telegramSession, telegramBack, isTelegramDesktop, openExternal, type TgSession } from '../telegram';
import { music } from '../audio/Music';
import { loadSolo, saveSolo, clearSolo, loadRoom, saveRoom, levelCaption, activeRoom, setActiveRoom, clearActiveRoom, browserPid } from '../progress';
import { initPwa, isStandalone, isIos, canPromptInstall, promptInstall, installUrl, onInstallChange, shareLink } from '../pwa';
import { controlsMarkup } from './ControlsHelp';
import { reloadIfOutdated } from '../version';

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
    initPwa();
  }

  /** Seat key on the server: the Telegram user, else this browser profile (D59). */
  pid() { return this.tg?.pid || browserPid(); }

  /** Telegram chat room of this session (opened from a chat), if any. */
  tg: TgSession | null = null;

  async ready() {
    this.booted = true;
    if (await reloadIfOutdated()) return;
    // a tab left open across a deploy updates itself when the player comes back to the menu
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.room && !this.game.scene.isActive('game')) void reloadIfOutdated();
    });
    // ?level=<id> jumps straight into a level (testing)
    const params = new URLSearchParams(location.search);
    const lv = params.get('level');
    if (lv && LEVELS[lv]) { this.startSolo(lv); return; }
    const tg = await telegramSession(this.httpBase());
    if (tg && 'error' in tg) { this.mainMenu(); this.toastMenu('Telegram: ' + tg.error); return; }
    if (tg) { this.tg = tg; settings.name = tg.name; saveSettings(); this.chatRoom(); return; }
    // D61: the shareable install link
    if (params.has('install')) { this.installScreen(); return; }
    // «Пригласить» link from a lobby
    const invite = (params.get('room') ?? '').toUpperCase();
    if (/^[A-Z]{4}$/.test(invite)) { history.replaceState(null, '', location.pathname); void this.resumeRoom(invite); return; }
    // D59: a closed tab / crashed browser comes back to its room (the server kept the seat)
    const active = activeRoom();
    if (active) { void this.resumeRoom(active, true); return; }
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
    // the server already knows the room is running: say so while connecting
    const info = (tg as TgSession & { room?: { phase?: string } }).room;
    if (info?.phase && info.phase !== 'lobby') d.querySelector('.flavor')!.textContent += ' Команда уже в бою — подключаемся к ней.';
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
    const solo = loadSolo(), room = loadRoom();
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
        ${this.desktopBanner()}
        ${this.tg ? `<button class="btn primary" data-a="chat">Играть с чатом · ${escapeHtml(this.tg.chatTitle || 'комната чата')}</button>` : ''}
        <div class="menu-group">
          <div class="menu-label">Одиночная игра</div>
          <div class="row">
            <button class="btn cont ${solo && !this.tg ? 'primary' : ''}" data-a="solo-continue" ${solo ? '' : 'disabled'}>Продолжить<small>${solo ? escapeHtml(levelCaption(solo.level)) : 'нет сохранения'}</small></button>
            <button class="btn cont ${solo || this.tg ? '' : 'primary'}" data-a="solo">Новая игра<small>${solo ? 'сохранение сотрётся' : escapeHtml(levelCaption(FIRST_LEVEL))}</small></button>
          </div>
        </div>
        <div class="menu-group">
          <div class="menu-label">С коллегами · 1–4 игрока</div>
          <div class="row">
            <button class="btn cont" data-a="resume-room" ${room ? '' : 'disabled'}>Продолжить<small>${room ? escapeHtml(`Комната ${room.code}${room.level ? ' · ' + levelCaption(room.level) : ''}`) : 'нет комнаты'}</small></button>
            <button class="btn cont" data-a="host">Новая игра<small>новая комната</small></button>
          </div>
          <button class="btn ghost" data-a="join">Войти по коду коллеги</button>
        </div>
        <button class="btn ghost" data-a="arena">Полигон (тест оружия)</button>
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
        <div class="menu-extras">
          <button class="btn ghost" data-a="preferences">Настройки</button>
          <button class="btn ghost" data-a="achievements">Достижения · ${earnedAchievements().length}/${Object.keys(ACHIEVEMENTS).length}</button>
        </div>
        <div class="menu-extras">
          <button class="btn ghost" data-a="controls">Как управлять</button>
          ${isStandalone() ? '' : '<button class="btn ghost" data-a="install">📲 Установить игру</button>'}
        </div>
        <a href="credits.html" target="_blank" rel="noopener" style="color:#acb4bd;font-size:13px">Авторы графики и лицензии</a>
      </div>`);
    const name = d.querySelector<HTMLInputElement>('.name')!;
    name.addEventListener('change', () => { settings.name = name.value.trim() || 'Сотрудник'; saveSettings(); });
    const devLevel = d.querySelector<HTMLSelectElement>('.dev-level');
    devLevel?.addEventListener('change', () => { settings.devLevel = devLevel.value; saveSettings(); });
    d.querySelector<HTMLInputElement>('.dev-god')?.addEventListener('change', (e) => { settings.devGod = (e.target as HTMLInputElement).checked; saveSettings(); });
    d.querySelector<HTMLInputElement>('.dev-arsenal')?.addEventListener('change', (e) => { settings.devArsenal = (e.target as HTMLInputElement).checked; saveSettings(); });
    let logoTaps = 0, logoT = 0;
    music.set('calm');
    sfx.setVolume(settings.volume);
    d.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      const a = btn?.dataset.a;
      if (btn instanceof HTMLButtonElement && btn.disabled) return;
      settings.name = name.value.trim() || 'Сотрудник'; saveSettings();
      if (a === 'solo') {
        // an existing save is only overwritten on a second, deliberate tap
        const b = btn!;
        if (solo && !b.classList.contains('confirm')) { b.classList.add('confirm'); b.innerHTML = 'Точно заново?<small>нажмите ещё раз</small>'; return; }
        this.levelStartCarry = undefined; this.startSolo(FIRST_LEVEL);
      }
      if (a === 'solo-continue' && solo) this.startSolo(solo.level, solo.carry);
      if (a === 'arena') { this.levelStartCarry = undefined; this.startSolo('arena'); }
      if (a === 'host' || a === 'join') this.multiplayer(a);
      if (a === 'resume-room' && room) void this.resumeRoom(room.code);
      if (a === 'controls') this.controls();
      if (a === 'install') this.installScreen();
      if (a === 'browser') this.openInBrowser(btn!);
      if (a === 'banner-close') this.closeBanner(btn!);
      if (a === 'look') { const host = this.show(''); openEditor(host, () => this.mainMenu()); }
      if (a === 'preferences') this.preferences();
      if (a === 'achievements') this.achievements();
      if (a === 'chat') this.chatRoom();
      if (a === 'devplay') { this.levelStartCarry = undefined; this.startSolo(settings.devLevel); }
      if (a === 'devoff') { settings.dev = false; saveSettings(); this.mainMenu(); }
      if ((e.target as HTMLElement).closest('[data-a="logo"]')) {
        logoTaps = performance.now() - logoT < 600 ? logoTaps + 1 : 1; logoT = performance.now();
        if (logoTaps >= 5) { settings.dev = !settings.dev; saveSettings(); this.mainMenu(); this.toastMenu(settings.dev ? 'DEV-режим включён' : 'DEV-режим выключен'); }
      }
    });
  }

  private controls() {
    const d = this.show(`<div class="panel controls-panel"><h2>КАК УПРАВЛЯТЬ</h2>${controlsMarkup()}<button class="btn primary" data-a="back">Понятно</button></div>`);
    d.querySelector('[data-a="back"]')!.addEventListener('click', () => this.mainMenu());
  }

  /** «Продолжить» for rooms: the server rebuilds the room from its save if it was closed. */
  private async resumeRoom(code: string, auto = false) {
    const d = this.show(`<div class="panel center"><h2>КОМНАТА ${escapeHtml(code)}</h2><p class="flavor">${auto ? 'Игра закрылась без «Выйти» — возвращаем вас на ваше место…' : 'Возвращаемся к команде…'}</p><div class="err"></div>
      <button class="btn ghost" data-a="back">${auto ? 'Не надо, в меню' : 'Назад'}</button></div>`);
    d.addEventListener('click', (e) => { if ((e.target as HTMLElement).dataset.a === 'back') { clearActiveRoom(); this.leaveRoom(); } });
    const ok = await this.connect('join', code, d.querySelector('.err')!);
    if (!ok && auto && this.screen === d) { clearActiveRoom(); this.mainMenu(); this.toastMenu(`Комната ${code} уже закрыта.`); }
  }

  // ------------------------------------------------------------------ D60: Telegram on a computer
  /** Banner «open in the browser» for the small Telegram desktop window (dismissible per session). */
  private desktopBanner() {
    if (!this.tg?.link || !isTelegramDesktop()) return '';
    try { if (sessionStorage.getItem('chkn-tg-banner')) return ''; } catch { /* ignore */ }
    return `<div class="tg-desktop"><button class="x" data-a="banner-close" aria-label="Скрыть">✕</button>
      <b>🖥 На компьютере удобнее в браузере</b><span>Окно Telegram маленькое. Откройте игру на весь экран — вы останетесь в той же комнате, на своём месте.</span>
      <button class="btn primary" data-a="browser">Открыть в браузере</button></div>`;
  }
  private closeBanner(btn: HTMLElement) {
    try { sessionStorage.setItem('chkn-tg-banner', '1'); } catch { /* ignore */ }
    btn.closest('.tg-desktop')?.remove();
  }
  private openInBrowser(btn: HTMLElement) {
    if (!this.tg?.link) return;
    const url = `${location.origin}/?tg=${encodeURIComponent(this.tg.link)}`;
    openExternal(url);
    const box = btn.closest('.tg-desktop') ?? btn.parentElement!;
    box.querySelector('.tg-link')?.remove();
    const note = document.createElement('div');
    note.className = 'tg-link';
    note.innerHTML = `Браузер открывается… Когда вы войдёте там, это окно отдаст своё место. Не открылся? <button class="btn tiny" data-copy>Скопировать ссылку</button>`;
    note.querySelector('[data-copy]')!.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await shareLink(url, 'CHKN OUTBREAK', 'Моя комната');
      (e.target as HTMLElement).textContent = r === 'failed' ? url : 'Скопировано ✓';
    });
    box.appendChild(note);
  }

  // ------------------------------------------------------------------ D61: install as an app
  installScreen() {
    this.stopGame();
    let off = () => {};
    const render = () => {
      const standalone = isStandalone(), inTg = !!this.tg || /[?&]tg=|tgWebAppData=/.test(location.href);
      const how = isIos()
        ? 'iPhone/iPad: откройте ссылку в Safari → «Поделиться» → «На экран „Домой“».'
        : /android/i.test(navigator.userAgent)
          ? 'Android: меню браузера ⋮ → «Установить приложение» (или «Добавить на главный экран»).'
          : 'Компьютер: Chrome/Edge — значок установки справа в адресной строке или меню ⋮ → «Установить».';
      const d = this.show(`<div class="panel center install-panel"><h2>CHKN КАК ПРИЛОЖЕНИЕ</h2>
        <img class="install-icon" src="/icons/icon-192.png" alt="" width="96" height="96">
        <p class="flavor">Иконка на рабочем столе, игра на весь экран без адресной строки. Сохранения, комнаты и достижения — те же.</p>
        ${standalone ? '<p class="ok-line">Уже установлено ✓ Вы играете в приложении.</p>'
          : inTg ? `<p class="flavor">Внутри Telegram установить нельзя — откройте ссылку в браузере.</p><button class="btn primary" data-a="ext">Открыть в браузере</button>`
          : canPromptInstall() ? '<button class="btn primary" data-a="prompt">📲 Установить</button>'
          : `<p class="install-how">${escapeHtml(how)}</p>`}
        <button class="btn" data-a="share">Поделиться ссылкой на установку</button>
        <div class="err"></div>
        <button class="btn ghost" data-a="menu">${this.room ? 'Назад' : 'В меню'}</button></div>`);
      d.addEventListener('click', async (e) => {
        const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
        if (a === 'prompt') { const ok = await promptInstall(); render(); if (!ok) this.screen?.querySelector('.err')?.replaceChildren('Установка отменена.'); }
        if (a === 'ext') openExternal(installUrl());
        if (a === 'share') {
          const r = await shareLink(installUrl(), 'CHKN OUTBREAK', 'Установи игру про офисных петушков');
          d.querySelector('.err')!.textContent = r === 'copied' ? 'Ссылка скопирована: ' + installUrl() : r === 'shared' ? '' : installUrl();
        }
        if (a === 'menu') { off(); if (this.room) this.lobby(); else this.mainMenu(); }
      });
    };
    off = onInstallChange(() => { if (this.screen?.querySelector('.install-panel')) render(); });
    render();
  }

  private preferences() {
    const d = this.show(`<div class="panel preferences-panel"><h2>НАСТРОЙКИ</h2>${preferencesMarkup()}<button class="btn primary" data-a="back">Готово</button></div>`);
    bindPreferences(d);
    d.querySelector('[data-a="back"]')!.addEventListener('click', () => this.mainMenu());
  }

  private achievements(back: () => void = () => this.mainMenu()) {
    const d = this.show(`<div class="panel achievements-panel"><h2>ДОСТИЖЕНИЯ</h2>${achievementsMarkup()}<button class="btn primary" data-a="back">Назад</button></div>`);
    d.querySelector('[data-a="back"]')!.addEventListener('click', back);
  }

  private stopGame() {
    if (this.game.scene.isActive('game')) this.game.scene.stop('game');
    // D67: menus and lobbies are HTML: let the renderer sleep instead of drawing an empty scene 60 times a second
    clearTimeout(this.sleepTimer);
    this.sleepTimer = setTimeout(() => { if (this.booted && !this.game.scene.isActive('game') && this.game.loop.running) this.game.loop.sleep(); }, 250);
  }
  private sleepTimer: ReturnType<typeof setTimeout> | undefined;
  private wakeRenderer() { clearTimeout(this.sleepTimer); if (!this.game.loop.running) this.game.loop.wake(); }

  startSolo(levelId: string, carry?: Carry) {
    this.currentLevel = levelId;
    this.levelStartCarry = carry;
    saveSolo(levelId, carry);
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
    this.wakeRenderer();
    this.game.scene.start('game', data);
    this.titleCard(lvl?.title ?? '', lvl?.subtitle ?? '', lvl?.chapter);
  }

  /** D69: «Глава 1 «Офис» пройдена» on the result panel of a chapter's last floor. */
  private chapterBanner(levelId: string | undefined) {
    const end = levelId ? LEVELS[levelId]?.chapterEnd : undefined;
    return end ? `<div class="chapter-banner"><b>${escapeHtml(end.title)}</b><span>${escapeHtml(end.text)}</span></div>` : '';
  }

  titleCard(title: string, sub: string, chapter?: string) {
    this.ui.querySelectorAll('.title-card').forEach(card => card.remove());
    const d = document.createElement('div');
    d.className = 'title-card';
    d.innerHTML = `${chapter ? `<div class="tc-chapter">${escapeHtml(chapter)}</div>` : ''}<div class="tc-title">${escapeHtml(title)}</div><div class="tc-sub">${escapeHtml(sub)}</div>`;
    this.ui.appendChild(d);
    setTimeout(() => d.remove(), 3600);
  }

  levelComplete(session: Session, next?: string, win?: boolean) {
    const me = session.view.players.find((p) => p.id === session.myId);
    const carry = session.carry();
    if (session.solo) { if (win || !next || !LEVELS[next]) clearSolo(); else saveSolo(next, carry); }
    const d = this.show(`<div class="panel center">
      <h2>${win ? 'ПОБЕДА!' : 'ЭТАП ПРОЙДЕН'}</h2>
      ${this.chapterBanner(session.levelId)}
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
  /** a sub-screen of the lobby (editor, achievements, controls) is open: state patches must not redraw */
  private lobbySub = false;
  /** the server gave our seat to the same player's newer connection (another tab / the browser) */
  private replaced: Room | null = null;
  /** rare achievements earned in this room and not yet told to the chat (D62) */
  private pendingShare = new Set<AchievementKey>();
  private portraits = new Map<string, string>();

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

  private joinOptions() {
    return { name: settings.name, look: settings.look, pid: this.pid(), ach: earnedAchievements().length };
  }

  private async connect(mode: 'host' | 'join', code: string, err: Element): Promise<boolean> {
    try {
      const client = new Client(this.serverUrl());
      if (mode === 'join') await fetch(this.httpBase() + '/api/rooms/resume', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ code }) }).catch(() => null);
      const room = mode === 'host'
        ? await client.create('game', { ...this.joinOptions(), ...(settings.dev && LEVELS[settings.devLevel] ? { level: settings.devLevel } : {}) })
        : await client.joinById(code, this.joinOptions());
      this.bindRoom(room, client);
      saveRoom(room.roomId, room.state.level);
      setActiveRoom(room.roomId);
      if (room.state.phase === 'lobby') this.lobby();
      return true;
    } catch (e) {
      const msg = String((e as Error)?.message ?? '');
      err.textContent = mode === 'join' ? (/заполнена/.test(msg) ? 'Комната заполнена: уже 4 сотрудника.' : 'Комната не найдена или заполнена.') : 'Сервер недоступен (запустите npm run server).';
      console.warn(e);
      return false;
    }
  }

  private bindRoom(room: Room, client: Client) {
    this.room = room;
    this.replaced = null;
    this.netResult = false;
    this.lobbySub = false;
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
    room.onMessage('ev', (ev: SimEvent[]) => {
      if (this.room !== room) return;
      for (const e of ev) if (e.e === 'achievement' && e.id === room.sessionId && isRare(e.key)) this.pendingShare.add(e.key as AchievementKey);
      this.net?.onEvents(ev);
    });
    room.onMessage('end', (m: NetEnd) => { if (this.room === room) this.netEnd(m); });
    room.onMessage('lobby', () => { if (this.room === room) { this.stopGame(); this.net = null; this.lobby(); } });
    room.onMessage('replaced', () => { if (this.room === room) this.replaced = room; });
    room.onMessage('summoned', (r: { ok?: boolean; error?: string }) => this.lobbyNote(r.ok ? '📣 Позвали чат — ждём коллег!' : r.error ?? 'Не получилось'));
    room.onMessage('shared', (r: { key: string; ok?: boolean; error?: string }) => {
      if (r.ok) this.pendingShare.delete(r.key as AchievementKey);
      this.ui.querySelectorAll<HTMLButtonElement>(`[data-share="${r.key}"]`).forEach((b) => { b.disabled = !!r.ok; b.textContent = r.ok ? 'Отправлено в чат ✓' : (r.error ?? 'Не получилось'); });
    });
    room.onLeave(() => {
      if (this.room !== room) return;
      if (this.replaced === room) { this.otherWindow(room.roomId); return; }
      void this.reconnect(room, client);
    });
    restorePhase();
  }

  /** D59: the same player continued elsewhere (another tab, the browser after Telegram). */
  private otherWindow(code: string) {
    this.stopGame(); this.net = null; this.room = null;
    const d = this.show(`<div class="panel center"><h2>ИГРА ОТКРЫТА В ДРУГОМ ОКНЕ</h2>
      <p class="flavor">Вы продолжили в другой вкладке или браузере — место в комнате ${escapeHtml(code)} теперь там. Здесь можно вернуть его себе.</p>
      <button class="btn primary" data-a="here">Играть здесь</button><button class="btn ghost" data-a="menu">В меню</button></div>`);
    d.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).dataset.a;
      if (a === 'here') { if (this.tg) this.chatRoom(); else void this.resumeRoom(code); }
      if (a === 'menu') this.mainMenu();
    });
  }

  private async reconnect(old: Room, client: Client) {
    const token = old.reconnectionToken;
    this.stopGame(); this.net = null;
    const panel = this.show(`<div class="panel center"><h2>ВОЗВРАЩАЕМСЯ В БОЙ</h2><p class="flavor">Восстанавливаем соединение… Ваше место в комнате держится за вами.</p><button class="btn ghost" data-a="leave">Выйти в меню</button></div>`);
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
    // D59: the reconnection window is over, but the seat is kept by player id — join again by code
    this.room = null;
    if (this.tg) { this.chatRoom(); return; }
    void this.resumeRoom(old.roomId, true);
  }

  private toastMenu(text: string) {
    const el = this.screen?.querySelector('.tagline');
    if (el) el.textContent = text;
  }

  leaveRoom() {
    const r = this.room;
    this.room = null; this.net = null; this.lobbySub = false;
    clearActiveRoom();
    this.pendingShare.clear();
    r?.leave(true);
    this.mainMenu();
  }

  private portrait(look: string, slot: number) {
    const key = look || 'p' + (slot % 4);
    let url = this.portraits.get(key);
    if (!url) { url = lookPortrait(key, false, 2); this.portraits.set(key, url); }
    return url;
  }

  /** D58: the lobby looks like the main menu — your card, your colleagues' portraits, the host's choice. */
  lobby() {
    const room = this.room;
    if (!room || this.lobbySub) return;
    telegramBack(() => this.leaveRoom());
    if (this.screen?.dataset.lobby !== room.roomId) this.lobbyShell(room);
    this.renderLobby(room);
  }

  private lobbyShell(room: Room) {
    const st = room.state as any;
    const chat = st.chat as string;
    const d = this.show(`<div class="menu lobby">
      <div class="logo">CHKN<span>OUTBREAK</span></div>
      ${this.desktopBanner()}
      <div class="lobby-head">
        <div><div class="menu-label">${chat ? 'Комната чата · ' + escapeHtml(chat) : 'Комната · продиктуйте код коллегам'}</div>
        <div class="code">${escapeHtml(st.code)}</div></div>
        <button class="btn tiny ghost" data-a="invite">Пригласить</button>
      </div>
      <div class="me-card">
        <img class="me-portrait" src="${this.portrait(settings.look, 0)}" alt="">
        <div class="me-fields">
          <label class="field"><span>Имя сотрудника</span><input class="name" maxlength="14" value="${escapeHtml(settings.name)}"></label>
          <button class="btn tiny" data-a="look">Изменить внешность</button>
        </div>
      </div>
      <div class="menu-label lobby-count"></div>
      <div class="team"></div>
      <div class="lobby-actions"></div>
      <div class="lobby-note flavor"></div>
      <div class="lobby-share"></div>
      ${st.summon ? '<button class="btn" data-a="summon">📣 Призвать чат</button>' : ''}
      ${chat ? '<button class="btn cont" data-a="solo-mode">🎮 Одиночный режим<small>выйти из комнаты чата в главное меню</small></button>' : ''}
      <div class="menu-extras">
        <button class="btn ghost" data-a="achievements">Достижения · ${earnedAchievements().length}/${Object.keys(ACHIEVEMENTS).length}</button>
        <button class="btn ghost" data-a="controls">Как управлять</button>
      </div>
      <div class="flavor tiny-help">1–4 игрока против стаи. E: нажать — поделиться патронами, держать — лечить или поднять. Опоздавшие подключаются прямо в бой.</div>
      <button class="btn ghost" data-a="leave">Выйти из комнаты</button></div>`);
    d.dataset.lobby = room.roomId;
    const name = d.querySelector<HTMLInputElement>('.name')!;
    name.addEventListener('change', () => { settings.name = name.value.trim() || 'Сотрудник'; saveSettings(); room.send('profile', { name: settings.name }); });
    const sub = (fn: (back: () => void) => void) => { this.lobbySub = true; fn(() => { this.lobbySub = false; this.lobby(); }); };
    d.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-a],[data-share]');
      if (!btn || (btn instanceof HTMLButtonElement && btn.disabled)) return;
      if (btn.dataset.share) { (btn as HTMLButtonElement).disabled = true; btn.textContent = 'Отправляем…'; room.send('share', { key: btn.dataset.share }); return; }
      const a = btn.dataset.a;
      const me = room.state.players.get(room.sessionId);
      if (a === 'ready') room.send('ready', { ready: !me?.ready });
      if (a === 'continue') room.send('start', { fresh: false });
      if (a === 'fresh') {
        if (room.state.saved && !btn.classList.contains('confirm')) { btn.classList.add('confirm'); btn.innerHTML = 'Точно заново?<small>сохранение команды сотрётся</small>'; return; }
        room.send('start', { fresh: true });
      }
      if (a === 'summon') { (btn as HTMLButtonElement).disabled = true; room.send('summon'); setTimeout(() => { (btn as HTMLButtonElement).disabled = false; }, 4000); }
      if (a === 'invite') {
        const url = `${location.origin}/?room=${room.roomId}`;
        const r = await shareLink(url, 'CHKN OUTBREAK', `Заходи в комнату ${room.roomId}`);
        this.lobbyNote(r === 'copied' ? `Ссылка скопирована: ${url}` : r === 'shared' ? 'Приглашение отправлено' : `Код комнаты: ${room.roomId}`);
      }
      if (a === 'look') sub((back) => { const host = this.show(''); openEditor(host, () => { room.send('profile', { look: settings.look }); back(); }); });
      if (a === 'achievements') sub((back) => this.achievements(back));
      if (a === 'controls') sub((back) => { const p = this.show(`<div class="panel controls-panel"><h2>КАК УПРАВЛЯТЬ</h2>${controlsMarkup()}<button class="btn primary" data-a="back">Понятно</button></div>`); p.querySelector('[data-a="back"]')!.addEventListener('click', back); });
      if (a === 'browser') this.openInBrowser(btn);
      if (a === 'banner-close') this.closeBanner(btn);
      if (a === 'leave' || a === 'solo-mode') this.leaveRoom();
    });
  }

  private lobbyNote(text: string) {
    const el = this.screen?.querySelector('.lobby-note');
    if (el) el.textContent = text;
  }

  private renderLobby(room: Room) {
    const d = this.screen!;
    const st = room.state as any;
    const me = st.players.get(room.sessionId);
    const myImg = d.querySelector<HTMLImageElement>('.me-portrait');
    if (me && myImg) { const src = this.portrait(me.look, me.slot); if (myImg.getAttribute('src') !== src) myImg.src = src; }
    const players: any[] = [];
    st.players.forEach((p: any) => players.push(p));
    players.sort((a, b) => a.slot - b.slot);
    const host = players.find((p) => p.host);
    const cards = players.map((p) => {
      const col = '#' + PLAYER_COLORS[p.slot % 4].toString(16).padStart(6, '0');
      const status = !p.connected ? 'переподключается…' : p.host ? '★ ведущий' : p.ready ? 'готов' : 'не готов';
      return `<div class="mate ${p.id === room.sessionId ? 'me' : ''} ${p.connected ? '' : 'away'}" style="--c:${col}">
        <img src="${this.portrait(p.look, p.slot)}" alt="">
        <b>${escapeHtml(p.name)}${p.id === room.sessionId ? ' (вы)' : ''}</b>
        <span class="st ${p.ready || p.host ? 'ok' : ''}">${status}</span>
        ${p.ach ? `<span class="ach" title="Достижения">🏅 ${p.ach}</span>` : ''}</div>`;
    });
    for (let i = players.length; i < 4; i++) cards.push('<div class="mate empty"><div class="slot-empty">?</div><b>свободно</b><span class="st">ждём коллегу</span></div>');
    const team = cards.join('');
    const teamEl = d.querySelector('.team')!;
    if ((teamEl as HTMLElement).dataset.html !== team) { teamEl.innerHTML = team; (teamEl as HTMLElement).dataset.html = team; }
    d.querySelector('.lobby-count')!.textContent = `Коллеги · ${players.filter((p) => p.connected).length}/4`;
    const saved = st.saved as string;
    const notReady = players.filter((p) => p.connected && !p.host && !p.ready).length;
    const actions = me?.host
      ? `<div class="row">${saved
          ? `<button class="btn cont primary" data-a="continue">Продолжить<small>${escapeHtml(levelCaption(saved))}</small></button><button class="btn cont" data-a="fresh">Новая игра<small>с первого этажа</small></button>`
          : `<button class="btn cont primary" data-a="fresh">Начать<small>${escapeHtml(levelCaption(st.level) || 'с первого этажа')}</small></button>`}</div>
        <div class="flavor small">${notReady ? `Не готовы: ${notReady}. Можно начать и так — опоздавшие подключатся в бою.` : 'Вы ведущий: выбираете, продолжить или начать заново.'}</div>`
      : `<button class="btn ${me?.ready ? 'ready' : 'primary'}" data-a="ready">${me?.ready ? 'Готов ✓' : 'Готов'}</button>
        <div class="flavor small">Начинает ведущий${host ? ' — ' + escapeHtml(host.name) : ''}: ${saved ? 'продолжить «' + escapeHtml(levelCaption(saved)) + '» или начать заново' : 'новая игра'}.</div>`;
    const actEl = d.querySelector<HTMLElement>('.lobby-actions')!;
    const key = actions.replace(/\s+/g, ' ');
    if (actEl.dataset.html !== key) { actEl.innerHTML = actions; actEl.dataset.html = key; }
    const share = this.shareButtons(!!st.summon);
    const shEl = d.querySelector<HTMLElement>('.lobby-share')!;
    if (shEl.dataset.html !== share) { shEl.innerHTML = share; shEl.dataset.html = share; }
  }

  /** D62: «tell the chat» buttons for rare achievements earned in this room. */
  private shareButtons(chat: boolean) {
    if (!chat || !this.pendingShare.size) return '';
    return `<div class="share-box"><div class="menu-label">Редкие достижения — рассказать чату?</div>${[...this.pendingShare].map((k) =>
      `<button class="btn tiny" data-share="${k}">${ACHIEVEMENTS[k].icon} «${escapeHtml(ACHIEVEMENTS[k].name)}» → в чат</button>`).join('')}</div>`;
  }

  private netStart(level: string) {
    const room = this.room;
    if (!room) return;
    if (this.net?.levelId === level && this.game.scene.isActive('game')) return;
    const json = this.game.cache.tilemap.get('map_' + level)?.data as TiledMap | undefined;
    if (!json) return;
    this.netResult = false;
    this.lobbySub = false;
    saveRoom(room.roomId, level);
    setActiveRoom(room.roomId);
    const net = new NetSession(room, level, json);
    this.net = net;
    this.lastNetLevel = level;
    this.runSession(net);
  }

  /** level the last networked game ran (chapter banner on its result panel) */
  private lastNetLevel = '';
  private netEnd(m: NetEnd) {
    const ended = this.net?.levelId ?? this.lastNetLevel;
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
      ${m.kind !== 'gameover' ? this.chapterBanner(ended) : ''}
      <p class="flavor">${escapeHtml(sub)}</p><div class="plist">${rows}</div>
      ${m.kind !== 'gameover' ? this.shareButtons(!!(this.room?.state as any)?.summon) : ''}
      ${m.kind === 'win' && isHost ? '<button class="btn primary" data-a="lobby">В лобби</button>' : ''}
      ${m.kind === 'gameover' && isHost ? '<button class="btn primary" data-a="retry-room">Заново с начала этажа</button><button class="btn" data-a="lobby">В лобби</button>' : ''}
      <button class="btn ghost" data-a="leave">Выйти в меню</button></div>`);
    d.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a],[data-share]');
      if (el?.dataset.share) { (el as HTMLButtonElement).disabled = true; el.textContent = 'Отправляем…'; this.room?.send('share', { key: el.dataset.share }); return; }
      const act = el?.dataset.a;
      if (act === 'lobby') this.room?.send('lobby');
      if (act === 'retry-room') this.room?.send('retry');
      if (act === 'leave') this.leaveRoom();
    });
  }
}

interface NetEnd { kind: string; next?: string; reason?: string; stats: { name: string; kills: number; score: number; slot: number }[] }
