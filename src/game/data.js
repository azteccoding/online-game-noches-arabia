// Datos públicos para el cliente. NO incluye trivias, mensajes ni eventos: eso vive solo en el servidor
// (y en el adaptador demo, que solo existe en builds --mode demo). Así la respuesta de una trivia (CRP) no viaja en el bundle de juego.
import config from '../data/config.json';
import ciudades from '../data/ciudades.json';
import rutas from '../data/rutas.json';
import personajes from '../data/personajes.json';
import objetos from '../data/objetos.json';
import tablero from '../data/tablero.json';

export const DATA = { config, ciudades, rutas, personajes, objetos };
export { tablero };
export const pjDe = (id) => personajes.personajes.find((p) => p.id === id);
export const ciudadDe = (id) => ciudades.ciudades.find((c) => c.id === id);
export const nombreCorto = (pj) => (pj ? pjDe(pj)?.nombre.split(' ').slice(0, 2).join(' ') : '');
export const symbolPj = (id) => `p${id}`;
export const destinos = (origen) => Object.entries(rutas.tarifas).filter(([k]) => k.startsWith(origen + '>')).map(([k, v]) => ({ id: k.split('>')[1], tarifa: v }));
