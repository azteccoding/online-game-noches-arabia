// Lo que llevas, para la barra de abajo (Jorge, 12 de noviembre): armas, transporte y dados, sin etiquetas; si no traes nada, no sale.
// El transporte lleva el emoji que ya usaba la barra para cada animal (y su vida, que antes iba en un recuadro aparte).
import { vidaAnimales, ICONO, NOMBRE } from './carrera.js';
const ARMAS = { cimitarra: 'Cimitarra', alfanje: 'Alfanje', jambiya: 'Jambiya', arco: 'Arco' };
const TRANSPORTE = Object.fromEntries(['caballo', 'camello', 'burro', 'caballoMongol', 'alfombra'].map((r) => [r, `${ICONO[r]} ${NOMBRE[r]}`]));   // emoji único por transporte
const DADOS = { dadosCairo: 'Dados del Cairo', dadosPersia: 'Dados de Persia' };
export function equipo(s) {
  const mano = (s?.mano || []).filter((c) => c.tipo === 'item');
  const n = (ref) => mano.filter((c) => c.ref === ref).length;
  const lista = (mapa) => Object.entries(mapa).filter(([ref]) => n(ref)).map(([ref, nom]) => (n(ref) > 1 ? `${nom} (${n(ref)})` : nom));
  const armas = lista(ARMAS).map((x) => (x === 'Arco' ? `Arco (${n('flechas')} flecha${n('flechas') === 1 ? '' : 's'})` : x));
  const conVida = vidaAnimales(s).map((a) => a.texto);   // «🐎 Caballo: 3 turnos» (los animales, con su vida)
  const transporte = conVida.length ? [...conVida, ...lista({ alfombra: TRANSPORTE.alfombra })] : lista(TRANSPORTE);
  return { armas, transporte, dados: lista(DADOS) };
}
export function textoEquipo(s) {
  const q = equipo(s);
  return [...q.armas, ...q.transporte, ...q.dados].join(' · ');
}
