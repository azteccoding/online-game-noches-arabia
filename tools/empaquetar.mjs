// Prepara una carpeta mínima para copiar a la Raspberry Pi (o a cualquier PC): cliente compilado + servidor.
//   npm run build && npm run empaquetar            -> ./paquete-servidor/
//   (en la Pi)  cd paquete-servidor && npm install --omit=dev && npm start
// No incluye node_modules: en la Pi se instalan (solo `ws` y `qrcode-terminal`, JavaScript puro).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, 'paquete-servidor');
const DATOS_SERVIDOR = ['config', 'ciudades', 'rutas', 'personajes', 'eventos', 'mensajes', 'objetos', 'trivias', 'cuentos', 'retos'];

if (!fs.existsSync(path.join(RAIZ, 'dist', 'index.html'))) { console.error('Falta dist/. Ejecuta antes:  npm run build'); process.exit(1); }
fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(path.join(SALIDA, 'src', 'data'), { recursive: true });
fs.cpSync(path.join(RAIZ, 'dist'), path.join(SALIDA, 'dist'), { recursive: true });
fs.cpSync(path.join(RAIZ, 'server'), path.join(SALIDA, 'server'), { recursive: true });
fs.cpSync(path.join(RAIZ, 'shared'), path.join(SALIDA, 'shared'), { recursive: true });
for (const f of DATOS_SERVIDOR) fs.copyFileSync(path.join(RAIZ, 'src', 'data', f + '.json'), path.join(SALIDA, 'src', 'data', f + '.json'));
const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
const minimo = { name: pkg.name + '-servidor', version: pkg.version, private: true, type: 'module', engines: pkg.engines, scripts: { start: 'node server/index.js' }, dependencies: { 'qrcode-terminal': pkg.dependencies['qrcode-terminal'], ws: pkg.dependencies.ws } };
fs.writeFileSync(path.join(SALIDA, 'package.json'), JSON.stringify(minimo, null, 2) + '\n');
if (fs.existsSync(path.join(RAIZ, 'README.md'))) fs.copyFileSync(path.join(RAIZ, 'README.md'), path.join(SALIDA, 'README.md'));
console.log('Paquete listo en', SALIDA);
