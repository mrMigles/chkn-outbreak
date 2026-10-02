// Telegram bot (long polling, no webhook/open port needed). In any chat:
//   /play (or /start, /game) → the HTML5 game card «CHKN OUTBREAK — Играть»; every member who presses «Играть»
//   lands in that chat's room under their Telegram name; @bot in any chat offers the same card (inline mode);
//   /app → a link to the Mini App with the chat as start parameter (when TELEGRAM_APP_URL is set);
//   /install → the link that installs the game as an app (PWA, D61).
// From the game (D62): «Призвать чат» posts an invitation into the room's chat; rare achievements can be shared.
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_GAME (short name from @BotFather /newgame), PUBLIC_URL (https address of the
// game), optional TELEGRAM_APP_URL (t.me/<bot>/<app> from /newapp), TELEGRAM_POLL=0 disables polling,
// TELEGRAM_API replaces https://api.telegram.org (the lobby check runs a fake one).
import fs from 'node:fs';
import path from 'node:path';
import { makeGameToken, nameOf, codeForChat } from './telegram';
import { SAVE_DIR } from './checkpoints';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const GAME = process.env.TELEGRAM_GAME ?? 'chkn';
const PUBLIC_URL = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');
const APP_URL = (process.env.TELEGRAM_APP_URL ?? '').replace(/\/$/, '');
const API = `${(process.env.TELEGRAM_API || 'https://api.telegram.org').replace(/\/$/, '')}/bot${TOKEN}`;

async function call(method: string, body: Record<string, unknown>) {
  try {
    const r = await fetch(`${API}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j: any = await r.json().catch(() => ({}));
    if (!j.ok) console.warn(`[tg] ${method}:`, j.description ?? r.status);
    return j;
  } catch (e) { console.warn(`[tg] ${method}:`, (e as Error).message); return { ok: false, description: 'нет связи с Telegram' }; }
}

// ---------------------------------------------------------------- which chat a room belongs to
// A room code is a hash of the chat key (chat_instance for game buttons and Mini Apps), which does not
// reveal the chat id the bot needs for posting. The bot remembers the pair whenever Telegram shows both.
export interface ChatInfo { id: number | string; title?: string }
const REGISTRY = path.join(SAVE_DIR, '_tg-chats.json');
let registry: { rooms: Record<string, ChatInfo>; known: string[] } = { rooms: {}, known: [] };
try { registry = { rooms: {}, known: [], ...JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) }; } catch { /* first run */ }
function persist() {
  try { fs.mkdirSync(SAVE_DIR, { recursive: true }); fs.writeFileSync(REGISTRY + '.tmp', JSON.stringify(registry)); fs.renameSync(REGISTRY + '.tmp', REGISTRY); }
  catch (e) { console.warn('[tg] registry:', (e as Error).message); }
}
/** The bot saw a command in this chat, so it is a member and may post there. */
export function knowChat(id: number | string) {
  const k = String(id);
  if (!registry.known.includes(k)) { registry.known.push(k); persist(); }
}
export const isKnownChat = (id: number | string) => registry.known.includes(String(id));
export function linkRoom(code: string, chat: ChatInfo) {
  const prev = registry.rooms[code];
  if (prev && String(prev.id) === String(chat.id) && (!chat.title || prev.title === chat.title)) return;
  registry.rooms[code] = { id: chat.id, title: chat.title ?? prev?.title };
  persist();
}
export const roomChat = (code: string): ChatInfo | undefined => registry.rooms[code];

/** A post with a button that opens the game in that chat's room. */
async function postWithPlay(chat: ChatInfo, text: string) {
  if (APP_URL) {
    const start = 'c' + String(chat.id).replace('-', 'm');
    return call('sendMessage', { chat_id: chat.id, text, reply_markup: { inline_keyboard: [[{ text: '▶ Присоединиться', url: `${APP_URL}?startapp=${start}` }]] } });
  }
  const r = await call('sendMessage', { chat_id: chat.id, text });
  if (r.ok) await call('sendGame', { chat_id: chat.id, game_short_name: GAME });
  return r;
}

type Result = { ok: true } | { error: string };
/** «Призвать чат» from a room's lobby. */
export async function summonChat(code: string, text: string): Promise<Result> {
  if (!TOKEN) return { error: 'Бот не настроен на сервере' };
  const chat = roomChat(code);
  if (!chat) return { error: 'Бот пока не знает этот чат — отправьте /play в чате и откройте игру кнопкой' };
  const r = await postWithPlay(chat, text);
  return r.ok ? { ok: true } : { error: 'Telegram не принял сообщение: ' + (r.description ?? 'ошибка') };
}

/** A rare achievement told to the room's chat. */
export async function shareToChat(code: string, text: string): Promise<Result> {
  if (!TOKEN) return { error: 'Бот не настроен на сервере' };
  const chat = roomChat(code);
  if (!chat) return { error: 'Бот пока не знает этот чат' };
  const r = await call('sendMessage', { chat_id: chat.id, text });
  return r.ok ? { ok: true } : { error: 'Telegram не принял сообщение' };
}

export async function onUpdate(u: any) {
  const m = u.message;
  if (m?.chat?.id && m.text && /^\/(play|start|game|app|install)(@\w+)?(\s|$)/i.test(m.text)) knowChat(m.chat.id);
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
  if (m?.text && /^\/install(@\w+)?(\s|$)/i.test(m.text)) {
    if (!PUBLIC_URL) { await call('sendMessage', { chat_id: m.chat.id, text: 'Сервер игры не знает свой адрес (PUBLIC_URL)' }); return; }
    await call('sendMessage', { chat_id: m.chat.id, text: '📲 CHKN OUTBREAK как приложение: откройте ссылку в браузере телефона или компьютера и нажмите «Установить».', reply_markup: { inline_keyboard: [[{ text: '📲 Установить игру', url: `${PUBLIC_URL}/?install=1` }]] } });
    return;
  }
  const q = u.callback_query;
  if (q?.game_short_name) {
    if (!PUBLIC_URL) { await call('answerCallbackQuery', { callback_query_id: q.id, text: 'Сервер игры не знает свой адрес (PUBLIC_URL)', show_alert: true }); return; }
    // chat_instance identifies the chat for everyone in it (and a Mini App opened there gets the same value)
    const chat = q.message?.chat;
    const key = q.chat_instance ? 'ci' + q.chat_instance : String(chat?.id ?? 'u' + q.from.id);
    if (chat?.id) linkRoom(codeForChat(key), { id: chat.id, title: chat.title });
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
  call('setMyCommands', { commands: [
    { command: 'play', description: 'Играть всем чатом' },
    ...(APP_URL ? [{ command: 'app', description: 'Ссылка на мини-приложение' }] : []),
    { command: 'install', description: 'Установить игру как приложение' },
  ] }).catch(() => {});
  console.log(`[tg] bot polling (game «${GAME}», url ${PUBLIC_URL || '— PUBLIC_URL not set'})`);
  process.once('SIGTERM', () => { stopped = true; });
}
