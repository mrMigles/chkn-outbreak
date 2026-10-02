// Telegram integration on the client. The game opens either as a Mini App (URL hash carries tgWebAppData;
// the WebApp SDK is loaded on demand) or as an HTML5 Game (?tg=<signed token> from the bot's «Играть» button).
// Either way the server answers with the chat's room code and the player's Telegram name, and the app joins
// that room right away: everyone who opens the game from one chat plays together («чат — это комната»).

export interface TgSession {
  code: string; name: string; chat: string; chatTitle?: string; verified: boolean; personal?: boolean;
  /** seat key of this Telegram user (same in the Mini App, the game window and the browser) */
  pid?: string;
  /** signed ?tg= token: the same session in an ordinary browser tab (D60) */
  link?: string;
}

type WebApp = {
  initData: string; platform: string; version: string;
  ready(): void; expand(): void; close(): void; openLink?(url: string, o?: { try_instant_view?: boolean }): void;
  disableVerticalSwipes?(): void; requestFullscreen?(): void; lockOrientation?(): void; isVersionAtLeast?(v: string): boolean;
  setHeaderColor?(c: string): void; setBackgroundColor?(c: string): void;
  BackButton?: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void };
  HapticFeedback?: { impactOccurred(s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void; notificationOccurred(t: 'error' | 'success' | 'warning'): void };
};

let app: WebApp | null = null;
let gameToken = '';

const inMiniApp = () => /tgWebAppData=/.test(location.hash) || /tgWebAppData=/.test(location.search);

function loadSdk(): Promise<WebApp | null> {
  return new Promise((ok) => {
    const w = window as any;
    if (w.Telegram?.WebApp) { ok(w.Telegram.WebApp); return; }
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.onload = () => ok(w.Telegram?.WebApp ?? null);
    s.onerror = () => ok(null);
    document.head.appendChild(s);
    setTimeout(() => ok(w.Telegram?.WebApp ?? null), 4000);
  });
}

/** True when the page was opened from Telegram (Mini App or game link). */
export const isTelegram = () => !!app || !!gameToken;

/** Detects Telegram, prepares the WebApp (fullscreen, no swipe-to-close) and fetches the chat's room. */
export async function telegramSession(httpBase: string): Promise<TgSession | { error: string } | null> {
  const token = new URLSearchParams(location.search).get('tg');
  let body: Record<string, string> | null = null, path = '';
  if (token) { gameToken = token; body = { token }; path = '/api/tg/game'; }
  else if (inMiniApp()) {
    app = await loadSdk();
    if (!app?.initData) return null;
    try {
      app.ready(); app.expand();
      app.disableVerticalSwipes?.();
      app.setHeaderColor?.('#1b1d21'); app.setBackgroundColor?.('#1b1d21');
      // a landscape shooter: take the whole screen on phones (Bot API 8.0+)
      if (/android|ios/.test(app.platform) && app.isVersionAtLeast?.('8.0')) { app.requestFullscreen?.(); app.lockOrientation?.(); }
    } catch { /* older clients */ }
    body = { initData: app.initData }; path = '/api/tg/session';
  }
  if (!body) return null;
  try {
    const r = await fetch(httpBase + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    return r.ok ? j as TgSession : { error: j.error ?? 'Ошибка входа через Telegram' };
  } catch {
    return { error: 'Сервер игры недоступен' };
  }
}

/**
 * D60: Telegram on a computer opens the game in a small window. Mini App platforms tell us directly;
 * the HTML5-game window has no SDK, so a mouse-driven page inside Telegram counts as a computer.
 */
export function isTelegramDesktop() {
  if (!isTelegram()) return false;
  if (app) return /^(tdesktop|macos|web|weba|webk|unigram)$/.test(app.platform);
  return !matchMedia('(pointer: coarse)').matches;
}

/** Opens a URL outside Telegram (the system browser); false when only a new tab could be tried. */
export function openExternal(url: string) {
  if (app?.openLink) { try { app.openLink(url); return true; } catch { /* fall through */ } }
  return !!window.open(url, '_blank', 'noopener');
}

/** Telegram «Назад» in the header: shown in a game/lobby, hidden in the menu. */
let backFn: (() => void) | null = null;
export function telegramBack(fn: (() => void) | null) {
  const b = app?.BackButton;
  if (!b) return;
  if (backFn) b.offClick(backFn);
  backFn = fn;
  if (fn) { b.onClick(fn); b.show(); } else b.hide();
}

export function haptic(kind: 'hit' | 'hurt' | 'down' | 'win') {
  const h = app?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === 'hit') h.impactOccurred('light');
    else if (kind === 'hurt') h.impactOccurred('heavy');
    else if (kind === 'down') h.notificationOccurred('error');
    else h.notificationOccurred('success');
  } catch { /* ignore */ }
}
