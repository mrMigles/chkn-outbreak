// Downloads the pinned Universal LPC layers listed in lpc-layers.mjs into vendor/lpc-characters,
// then rewrites manifest.json (sha256 + license) and SELECTED-CREDITS.csv.
//   node tools/art/lpc-fetch.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LAYERS, ANIMS, OPTIONAL_ANIMS, ULPC_REVISION, layerFile } from './lpc-layers.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const VENDOR = path.join(ROOT, 'vendor/lpc-characters');
const RAW = `https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/${ULPC_REVISION}/spritesheets/`;

/** Minimal CSV reader for ULPC CREDITS.csv (quoted fields, stray spaces after quotes). */
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cur.trim()); cur = ''; }
    else if (c === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
  return rows;
}
const csvCell = (s) => '"' + String(s).replace(/"/g, '""') + '"';

const creditsText = fs.readFileSync(path.join(VENDOR, 'CREDITS.csv'), 'utf8');
const [header, ...credits] = parseCsv(creditsText);
const creditFor = (file) => {
  const exact = credits.find((r) => r[0] === file);
  if (exact) return exact;
  // variant sheets are credited per directory
  const dir = file.split('/').slice(0, -2).join('/');
  return credits.find((r) => r[0].startsWith(dir + '/')) ?? credits.find((r) => r[0].startsWith(path.dirname(file) + '/'));
};

const manifest = { revision: ULPC_REVISION, assets: [] };
const selected = [header];
let fetched = 0;
for (const layer of LAYERS) for (const anim of ANIMS) {
  const file = layerFile(layer, anim);
  const out = path.join(VENDOR, 'spritesheets', file);
  if (!fs.existsSync(out)) {
    const res = await fetch(RAW + file);
    if (res.status === 404 && OPTIONAL_ANIMS.includes(anim)) { console.log('missing (optional):', file); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    fetched++;
  }
  const credit = creditFor(file);
  if (!credit) throw new Error('No credits row for ' + file);
  const licenses = credit[3].split(',').map((s) => s.trim());
  // Prefer CC-BY-SA 3.0 (matches the rest of the LPC art); OGA-BY-only layers keep OGA-BY.
  const license = licenses.includes('CC-BY-SA 3.0') ? 'CC-BY-SA 3.0' : licenses.includes('OGA-BY 3.0') ? 'OGA-BY 3.0' : licenses[0];
  manifest.assets.push({
    sha256: crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex').toUpperCase(),
    file: 'spritesheets/' + file, layer: layer.id, license, url: RAW + file,
  });
  selected.push([file, credit[1], credit[2], credit[3], credit[4]]);
}
fs.writeFileSync(path.join(VENDOR, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(VENDOR, 'SELECTED-CREDITS.csv'), selected.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
console.log(`lpc layers: ${LAYERS.length} layers, ${manifest.assets.length} sheets (${fetched} downloaded)`);
