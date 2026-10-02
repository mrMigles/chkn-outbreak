// Colyseus game server. Also serves the production client build (dist/) when present.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom';
import { tgSession, gameSession, type TgSession } from './telegram';
import { startTelegramBot } from './tgbot';
import { readCheckpoint, validRoomCode } from './checkpoints';

const PORT = Number(process.env.PORT || 2580);
const DIST = path.resolve(process.cwd(), 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.json': 'application/json', '.tmj': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

/** The chat's room exists (created on first open); one creation at a time per code. */
const creating = new Map<string, Promise<void>>();
async function ensureChatRoom(s: TgSession) {
  const found = await matchMaker.query({ roomId: s.code });
  if (found.length) return;
  let p = creating.get(s.code);
  if (!p) {
    p = matchMaker.createRoom('game', { code: s.code, chat: s.chatTitle || (s.personal ? 'Личная комната' : 'Чат') }).then(() => {}).finally(() => creating.delete(s.code));
    creating.set(s.code, p);
  }
  await p;
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((ok) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 64 * 1024) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } });
  });
}
const json = (res: http.ServerResponse, code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };

const httpServer = http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health' || url === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  if (url === '/version') { json(res, 200, { build: process.env.BUILD_ID ?? 'dev' }); return; }
  if (req.method === 'POST' && url === '/api/rooms/resume') {
    if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    const code = String((await readBody(req)).code ?? '').toUpperCase();
    if (!validRoomCode(code)) { json(res, 400, { error: 'Некорректный код' }); return; }
    try {
      const found = await matchMaker.query({ roomId: code });
      if (!found.length) {
        const save = readCheckpoint(code);
        if (!save) { json(res, 404, { error: 'Нет сохранения' }); return; }
        let p = creating.get(code);
        if (!p) { p = matchMaker.createRoom('game', { code, chat: save.chat }).then(() => {}).finally(() => creating.delete(code)); creating.set(code, p); }
        await p;
      }
      json(res, 200, { ok: true });
    } catch { json(res, 500, { error: 'Не удалось восстановить комнату' }); }
    return;
  }
  // Telegram: Mini App initData or a signed game link → the chat's room code and the player's name
  if (req.method === 'POST' && (url === '/api/tg/session' || url === '/api/tg/game')) {
    const body = await readBody(req);
    const s = url === '/api/tg/session' ? tgSession(String(body.initData ?? '')) : gameSession(String(body.token ?? ''));
    if ('error' in s) { json(res, 403, s); return; }
    try { await ensureChatRoom(s); } catch (e) { json(res, 500, { error: 'Не удалось создать комнату: ' + (e as Error).message }); return; }
    json(res, 200, s);
    return;
  }
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('CHKN OUTBREAK server is running. Start the client with `npm run dev`.');
    return;
  }
  let file = path.join(DIST, url === '/' ? 'index.html' : url);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define('game', GameRoom);
gameServer.listen(PORT).then(() => { console.log(`CHKN OUTBREAK server on :${PORT}`); startTelegramBot(); });
// docker stop / compose down: close rooms cleanly
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.once(sig, () => { gameServer.gracefullyShutdown().then(() => process.exit(0)).catch(() => process.exit(0)); });
