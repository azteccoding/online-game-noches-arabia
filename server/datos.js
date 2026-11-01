// Carga los JSON de src/data sin dependencias (Node 18+, también ARM). Lo usan el servidor y las pruebas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
export function cargarDatos() {
  const j = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  return { config: j('config.json'), ciudades: j('ciudades.json'), rutas: j('rutas.json'), personajes: j('personajes.json'), eventos: j('eventos.json'), mensajes: j('mensajes.json'), objetos: j('objetos.json'), trivias: j('trivias.json'), cuentos: j('cuentos.json'), retos: j('retos.json') };
}
