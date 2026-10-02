// Colyseus game server. Also serves the production client build (dist/) when present.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom';

const PORT = Number(process.env.PORT || 2580);
const DIST = path.resolve(process.cwd(), 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.json': 'application/json', '.tmj': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const httpServer = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') { res.writeHead(200); res.end('ok'); return; }
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
gameServer.listen(PORT).then(() => console.log(`CHKN OUTBREAK server on :${PORT}`));
