import React from 'react';
import Carta from './Carta.jsx';
import { DATA as BASE } from '../game/data.js';
import eventos from '../data/eventos.json';
import mensajes from '../data/mensajes.json';
import trivias from '../data/trivias.json';
import cuentos from '../data/cuentos.json';
import ej from '../data/eventosJugador.json';
import { ejDatos } from '../../shared/eventosJugador.js';
import retos from '../data/retos.json';

const DATA = { ...BASE, eventos, mensajes, trivias, cuentos, ej, retos };
import { cartaDatos } from '../../shared/engine.js';
import { itemDatos } from '../../shared/base.js';
import '../styles/ui.css';

// Herramienta de PRUEBA (solo builds demo): ?galeria=evento|historico|mensaje|objeto|trivia|mesa|personaje|reto dibuja todas las cartas del mazo en rejilla
// para revisar desbordes de texto. window.__galeria devuelve cuántas cartas desbordan su cuerpo. No forma parte del juego.
const IDS = {
  evento: () => DATA.eventos.eventos.map((x) => x.id), historico: () => DATA.eventos.historicos.map((x) => x.id), mensaje: () => DATA.mensajes.mensajes.map((x) => x.id),
  objeto: () => DATA.objetos.mazo.map((x) => x.id), trivia: () => DATA.trivias.trivias.map((x) => x.id), mesa: () => DATA.trivias.deMesa.map((x) => x.id), cuento: () => DATA.cuentos.cuentos.map((x) => x.id), personaje: () => DATA.personajes.personajes.map((x) => x.id), reto: () => DATA.retos.retos.map((x) => x.id), especial: () => ['S1', 'S2', 'S4', 'F1'],
};
export default function Galeria({ mazo, ancho = 360 }) {
  // ?galeria=armas: las cartas de objetos armadas con las hojas de vistas (armas, flechas, escudo) y la del genio
  const lista = mazo === 'ej' ? DATA.ej.cartas.map((c) => ejDatos(DATA, c.id)) : mazo === 'armas' ? [...['cimitarra', 'alfanje', 'jambiya', 'arco', 'flechas', 'burro', 'caballo', 'camello', 'caballoMongol', 'alfombra', 'lampara', 'yegua', 'alfombraIsfahan'].map((r) => itemDatos(DATA, r)), cartaDatos(DATA, 'objeto', 'OB04'), cartaDatos(DATA, 'ifrit', 'I1')] : mazo === 'especial' ? DATA.objetos.especiales.filter((x) => IDS.especial().includes(x.id)).map((x) => ({ id: x.id, deck: 'especial', titulo: x.nombre, sub: 'Carta especial', texto: (x.texto || '') + ' ' + (x.efecto || ''), arte: x.arte })) : (IDS[mazo] || IDS.evento)().map((id) => cartaDatos(DATA, mazo in IDS ? mazo : 'evento', id));
  React.useEffect(() => {
    const t = setTimeout(() => {
      const malas = [...document.querySelectorAll('.c-cuerpo')].filter((e) => e.scrollHeight > e.clientHeight + 1).map((e) => e.closest('[data-id]')?.getAttribute('data-id'));
      window.__galeria = { total: lista.length, desbordan: malas };
    }, 600);
    return () => clearTimeout(t);
  }, [mazo]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', padding: 12, display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${ancho}px)`, gap: 12, background: '#222' }}>
      {lista.map((d) => <div key={d.id} style={{ width: ancho }}><Carta datos={d} /></div>)}
    </div>
  );
}
