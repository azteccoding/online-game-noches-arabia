import React from 'react';
import Carta from './Carta.jsx';
import { DATA as BASE } from '../game/data.js';
import eventos from '../data/eventos.json';
import mensajes from '../data/mensajes.json';
import trivias from '../data/trivias.json';
import cuentos from '../data/cuentos.json';

const DATA = { ...BASE, eventos, mensajes, trivias, cuentos };
import { cartaDatos } from '../../shared/engine.js';
import '../styles/ui.css';

// Herramienta de PRUEBA (solo builds demo): ?galeria=evento|historico|mensaje|objeto|trivia|mesa|personaje dibuja todas las cartas del mazo en rejilla
// para revisar desbordes de texto. window.__galeria devuelve cuántas cartas desbordan su cuerpo. No forma parte del juego.
const IDS = {
  evento: () => DATA.eventos.eventos.map((x) => x.id), historico: () => DATA.eventos.historicos.map((x) => x.id), mensaje: () => DATA.mensajes.mensajes.map((x) => x.id),
  objeto: () => DATA.objetos.mazo.map((x) => x.id), trivia: () => DATA.trivias.trivias.map((x) => x.id), mesa: () => DATA.trivias.deMesa.map((x) => x.id), cuento: () => DATA.cuentos.cuentos.map((x) => x.id), personaje: () => DATA.personajes.personajes.map((x) => x.id),
};
export default function Galeria({ mazo, ancho = 360 }) {
  const lista = (IDS[mazo] || IDS.evento)().map((id) => cartaDatos(DATA, mazo in IDS ? mazo : 'evento', id));
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
