// Telegram bot (long polling, no webhook/open port needed). In any chat:
//   /play (or /start, /game) → the HTML5 game card «CHKN OUTBREAK — Играть»; every member who presses «Играть»
//   lands in that chat's room under their Telegram name; @bot in any chat offers the same card (inline mode);
//   /app → a link to the Mini App with the chat as start parameter (when TELEGRAM_APP_URL is set).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_GAME (short name from @BotFather /newgame), PUBLIC_URL (https address of the
// game), optional TELEGRAM_APP_URL (t.me/<bot>/<app> from /newapp), TELEGRAM_POLL=0 disables polling.
import { makeGameToken, nameOf } from './telegram';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const GAME = process.env.TELEGRAM_GAME ?? 'chkn';
const PUBLIC_URL = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');
const APP_URL = (process.env.TELEGRAM_APP_URL ?? '').replace(/\/$/, '');
const API = `https://api.telegram.org/bot${TOKEN}`;

async function call(method: string, body: Record<string, unknown>) {
  const r = await fetch(`${API}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!j.ok) console.warn(`[tg] ${method}:`, j.description ?? r.status);
  return j;
}

export async function onUpdate(u: any) {
  const m = u.message;
  if (m?.text && /^\/(play|start|game)(@\w+)?(\s|$)/i.test(m.text)) {
    await call('sendGame', { chat_id: m.chat.id, game_short_name: GAME });
    return;
  }
  if (m?.text && /^\/app(@\w+)?(\s|$)/i.test(m.text) && APP_URL) {
    // the start parameter carries the chat, so everyone who opens the link lands in the same room
    const start = 'c' + String(m.chat.id).replace('-', 'm');
    await call('sendMessage', { chat_id: m.chat.id, text: '🐔 Комната этого чата — заходите все:', reply_markup: { inline_keyboard: [[{ text: '▶ Играть', url: `${APP_URL}?startapp=${start}` }]] } });
    return;
  }
  const q = u.callback_query;
  if (q?.game_short_name) {
    if (!PUBLIC_URL) { await call('answerCallbackQuery', { callback_query_id: q.id, text: 'Сервер игры не знает свой адрес (PUBLIC_URL)', show_alert: true }); return; }
    // chat_instance identifies the chat for everyone in it (and a Mini App opened there gets the same value)
    const chat = q.message?.chat;
    const key = q.chat_instance ? 'ci' + q.chat_instance : String(chat?.id ?? 'u' + q.from.id);
    const token = makeGameToken({ c: key, u: q.from.id, n: nameOf(q.from), t: Math.floor(Date.now() / 1000), title: chat?.title });
    await call('answerCallbackQuery', { callback_query_id: q.id, url: `${PUBLIC_URL}/?tg=${token}` });
    return;
  }
  const iq = u.inline_query;
  if (iq) await call('answerInlineQuery', { inline_query_id: iq.id, results: [{ type: 'game', id: 'g', game_short_name: GAME }], cache_time: 300 });
}

export function startTelegramBot() {
  if (!TOKEN || process.env.TELEGRAM_POLL === '0') return;
  let offset = 0, stopped = false;
  const loop = async () => {
    while (!stopped) {
      try {
        const r = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'callback_query', 'inline_query']))}`);
        const j: any = await r.json();
        if (!j.ok) throw new Error(j.description ?? 'getUpdates failed');
        for (const u of j.result) { offset = u.update_id + 1; onUpdate(u).catch((e) => console.warn('[tg] update', e)); }
      } catch (e) {
        console.warn('[tg] polling:', (e as Error).message);
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
  };
  loop();
  call('setMyCommands', { commands: [{ command: 'play', description: 'Играть всем чатом' }, ...(APP_URL ? [{ command: 'app', description: 'Ссылка на мини-приложение' }] : [])] }).catch(() => {});
  console.log(`[tg] bot polling (game «${GAME}», url ${PUBLIC_URL || '— PUBLIC_URL not set'})`);
  process.once('SIGTERM', () => { stopped = true; });
}
