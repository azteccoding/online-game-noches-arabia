// Reglas de estilo: nunca «Mahoma» ni variantes en los textos del juego.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROHIBIDO = /\b(Mahoma|Mahomet|Mahomed|Mohamed)\b/i;
const archivos = [];
const recorrer = (dir, ext) => {
  const d = path.join(RAIZ, dir);
  if (!fs.existsSync(d)) return;
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) recorrer(p, ext); else if (ext.test(f.name)) archivos.push(p);
  }
};
recorrer('src', /\.(json|jsx?|css)$/); recorrer('shared', /\.js$/); recorrer('server', /\.(js|json)$/);
recorrer('public/demo', /\.html$/); recorrer('ejemplos', /\.html$/);
for (const f of ['README.md', 'README.txt', 'index.html', 'plan-juego-web.md']) if (fs.existsSync(path.join(RAIZ, f))) archivos.push(f);
const malos = archivos.filter((f) => PROHIBIDO.test(fs.readFileSync(path.join(RAIZ, f), 'utf8')));
assert.deepEqual(malos, [], 'usar «Profeta Muhammad», nunca «Mahoma»: ' + malos.join(', '));
console.log(`estilo OK (${archivos.length} archivos)`);
