// Telegram: a room belongs to the chat the game was opened from («чат — это комната»).
// Two entry points, same result (a room code + the player's Telegram name):
//  • Mini App (t.me/<bot>/<app>?startapp=… or the bot's menu button): the client sends Telegram's initData,
//    we check its HMAC with the bot token and take chat_instance / chat id / start_param as the chat key;
//  • HTML5 Game (/play in a chat → «Играть» button): the bot answers the button with a signed link (?tg=token).
// Without TELEGRAM_BOT_TOKEN initData is trusted as is (development) and the session is marked unverified.
import crypto from 'node:crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const SECRET = process.env.SESSION_SECRET || BOT_TOKEN || crypto.randomBytes(16).toString('hex');

export interface TgSession { code: string; name: string; chat: string; chatTitle?: string; verified: boolean; personal?: boolean }

/** Telegram's check: HMAC-SHA256 over the sorted fields with a key derived from the bot token; a day at most. */
export function checkInitData(initData: string): URLSearchParams | null {
  const params = new URLSearchParams(initData);
  if (!BOT_TOKEN) return params;
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const data = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const key = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', key).update(data).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  if (Date.now() / 1000 - Number(params.get('auth_date') ?? 0) > 86400) return null;
  return params;
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
/** Four-letter room code from a chat key; chat rooms start with T, so they never collide with random codes. */
export function codeForChat(chat: string) {
  const h = crypto.createHash('sha256').update('chkn:' + chat).digest();
  let s = 'T';
  for (let i = 0; i < 3; i++) s += ALPHA[h[i] % ALPHA.length];
  return s;
}
export const isChatCode = (c: unknown): c is string => typeof c === 'string' && /^T[A-Z]{3}$/.test(c);

export const nameOf = (u: any) => [u?.first_name, u?.last_name ? u.last_name[0] + '.' : ''].filter(Boolean).join(' ').slice(0, 14) || u?.username || 'Сотрудник';

export function tgSession(initData: string): TgSession | { error: string } {
  const p = checkInitData(initData);
  if (!p) return { error: 'Подпись Telegram не сошлась' };
  let user: any, chat: any;
  try { user = JSON.parse(p.get('user') ?? '{}'); chat = p.get('chat') ? JSON.parse(p.get('chat')!) : null; } catch { return { error: 'Неверные данные Telegram' }; }
  if (!user.id) return { error: 'Нет пользователя Telegram' };
  // chat_instance is the same value the game button carries, so both entry points lead to one room
  const ci = p.get('chat_instance');
  let key = (ci ? 'ci' + ci : '') || (chat?.id ? String(chat.id) : '') || p.get('start_param') || '';
  let personal = false;
  if (!key) { key = 'u' + user.id; personal = true; }
  return { code: codeForChat(key), name: nameOf(user), chat: key, chatTitle: chat?.title, verified: !!BOT_TOKEN, personal };
}

// ---------------------------------------------------------------- signed game links (HTML5 Games)
interface GameClaim { c: string; u: number; n: string; t: number; title?: string }
const mac = (s: string) => crypto.createHmac('sha256', SECRET + ':game').update(s).digest('base64url').slice(0, 32);
export function makeGameToken(claim: GameClaim) {
  const body = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return body + '.' + mac(body);
}
export function gameSession(token: string): TgSession | { error: string } {
  const [body, sig] = String(token).split('.');
  if (!body || !sig || mac(body) !== sig) return { error: 'Ссылка не подписана — откройте игру кнопкой «Играть» в чате' };
  let c: GameClaim;
  try { c = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return { error: 'Повреждённая ссылка' }; }
  if (Date.now() / 1000 - c.t > 86400) return { error: 'Ссылка устарела — нажмите «Играть» в чате ещё раз' };
  return { code: codeForChat(c.c), name: c.n, chat: c.c, chatTitle: c.title, verified: true };
}
