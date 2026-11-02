import { DATA } from './data.js';

// Consejos de venta de una ciudad, calculados con las reglas (impuestos, reventas sin impuesto y dónde se compra cada objeto).
const ciudadesDe = (o) => { const s = String(o.seConsigueEn || '').trim(); return /^(todas|cualquier ciudad)/i.test(s) ? null : s.split(/,| y /).map((x) => x.trim()).filter(Boolean); };
const impuestoDe = (id) => (id === 'Bagdad' ? 0 : DATA.ciudades.ciudades.find((c) => c.id === id)?.impuestoVenta ?? DATA.config.impuestoVentaPct);

export function consejosVenta(id) {
  const imp = impuestoDe(id);
  const r = [];
  r.push(imp === 0 ? 'Aquí no se paga impuesto de venta: es el mejor lugar para vender casi cualquier objeto al mercado.'
    : imp >= 50 ? `Impuesto de venta del ${imp} %: evita vender aquí; mejor vende en Bagdad (sin impuesto).`
      : `Impuesto de venta del ${imp} %. En Bagdad no se paga impuesto: si vas para allá, espera a vender.`);
  // Mercancías de comercio (objetos.json, «reventa»): qué pagan caro aquí y qué conviene comprar aquí para venderlo lejos.
  for (const o of DATA.objetos.mazo.filter((x) => x.reventa?.[id] != null)) {
    const donde = ciudadesDe(o);
    r.push(`Aquí pagan caro «${o.nombre}»: ${o.reventa[id]} dinares sin impuesto (vale ${o.valor}).${donde?.length ? ` Solo se compra en ${donde.join(', ')}.` : ''}`);
  }
  for (const o of DATA.objetos.mazo.filter((x) => x.reventa && ciudadesDe(x)?.includes(id))) {
    const mejores = Object.entries(o.reventa).sort((a, b) => b[1] - a[1]);
    r.push(`Compra aquí «${o.nombre}» por ${o.valor} (solo se vende aquí) y llévalo a ${mejores.map(([c, p]) => `${c} (${p})`).join(', ')}: hasta ${mejores[0][1] - o.valor} dinares de ganancia. Hay pocas unidades: si se agota, cómpraselo a otro jugador.`);
  }
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
