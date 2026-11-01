import { DATA } from './data.js';
import { REVENTA } from '../../shared/objetos.js';

// Consejos de venta de una ciudad, calculados con las reglas (impuestos, reventas sin impuesto y dónde se compra cada objeto).
const ciudadesDe = (o) => { const s = String(o.seConsigueEn || '').trim(); return /^(todas|cualquier ciudad)/i.test(s) ? null : s.split(/,| y /).map((x) => x.trim()).filter(Boolean); };
const impuestoDe = (id) => (id === 'Bagdad' ? 0 : DATA.ciudades.ciudades.find((c) => c.id === id)?.impuestoVenta ?? DATA.config.impuestoVentaPct);
const nombre = (ref) => DATA.objetos.mazo.find((o) => o.id === ref)?.nombre || ref;

export function consejosVenta(id) {
  const imp = impuestoDe(id);
  const r = [];
  r.push(imp === 0 ? 'Aquí no se paga impuesto de venta: es el mejor lugar para vender casi cualquier objeto al mercado.'
    : imp >= 50 ? `Impuesto de venta del ${imp} %: evita vender aquí; mejor vende en Bagdad (sin impuesto).`
      : `Impuesto de venta del ${imp} %. En Bagdad no se paga impuesto: si vas para allá, espera a vender.`);
  const aqui = Object.entries(REVENTA).filter(([, [c]]) => c === id);
  for (const [ref, [, precio]] of aqui) {
    const o = DATA.objetos.mazo.find((x) => x.id === ref);
    const donde = o && ciudadesDe(o);
    r.push(`Aquí pagan más por «${nombre(ref)}»: ${precio} dinares sin impuesto (vale ${o?.valor ?? '?'}).${donde?.length ? ` Se compra en ${donde.join(', ')}.` : ''}`);
  }
  const negocio = DATA.objetos.mazo.filter((o) => { const cs = ciudadesDe(o); return (!cs || cs.includes(id)) && REVENTA[o.id] && REVENTA[o.id][0] !== id && REVENTA[o.id][1] > o.valor; });
  for (const o of negocio) r.push(`Compra aquí «${o.nombre}» por ${o.valor} y véndelo en ${REVENTA[o.id][0]} por ${REVENTA[o.id][1]}: ganas ${REVENTA[o.id][1] - o.valor} dinares.`);
  if (id === 'Bagdad') {
    r.push('La biblioteca de Bagdad es la única que compra libros y papiros.');
    r.push('El vino solo se compra aquí y gana valor cada turno: véndelo después en cualquier otra ciudad.');
  }
  if (id === 'Damasco') r.push('El pergamino se cobra aquí: 30 dinares. La buza se compra aquí barata y se vende en El Cairo (4) o en Bagdad (3).');
  if (id === 'El Cairo') r.push('La buza se vende aquí a 4 dinares (en Bagdad a 3).');
  if (id === 'Basra') r.push('Aquí puedes comprar la cesta de manzanas que pide el reto R24 (30 dinares al entregarla).');
  if (id === 'Isfahán') r.push('El reto R17 paga 40 dinares por alfombra, y en Bagdad el R7 paga 90 por cada una (máx. 2).');
  return r;
}
