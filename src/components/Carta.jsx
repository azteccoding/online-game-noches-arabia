import React, { useEffect, useRef } from 'react';
import { Icono, ETIQUETA, DORSO, Adorno } from './iconos.jsx';
import { useArte } from '../hooks/useArte.js';
import PINTADAS from '../data/arteCartas.json';
import '../styles/cards.css';

// Cartas con pintura propia (public/arte/cartas/<clave>.webp): la pintura llena toda la carta, con el título encima y el texto en un recuadro abajo.
// La clave es el id de la carta (R26, H21…) o, si no, su clave de arte (pj-6). «titulo: abajo» baja el título cuando arriba hay un rostro. «texto: arriba» sube el recuadro de texto cuando lo importante está abajo.
const pintadaDe = (d) => (PINTADAS[d.id] ? d.id : PINTADAS[d.arte] ? d.arte : null);

// Carta construida en el cliente (HTML/SVG/CSS) a partir de DATOS. No hay una imagen por carta.
// tam: 'completa' (modal; ventana de arte perezosa) | 'mini' (miniatura ligera de la mano) | 'dorso' (WebP de 360 px del mazo).
// Contrato de ciclo de vida: una carta completa se monta al abrir el modal y se desmonta al cerrarlo (ver ModalCarta).
function Arte({ clave }) {
  const url = useArte(clave);
  return url ? <img className="arte-img" src={url} alt="" draggable="false" /> : <div className="arte-vacio" />;
}

export function useContadorCartas(activo) {
  useEffect(() => {
    if (!activo) return undefined;
    window.__cartas = window.__cartas || { montadas: 0, maximo: 0 };
    window.__cartas.montadas++; window.__cartas.maximo = Math.max(window.__cartas.maximo, window.__cartas.montadas);
    return () => { window.__cartas.montadas--; };
  }, [activo]);
}

const Chips = ({ d }) => (
  <div className="chips">
    {d.premio && <span className="chip-c">Premio {typeof d.premio === 'number' ? d.premio + ' dinares' : d.premio}</span>}
    {d.plazo && <span className="chip-c">Plazo {d.plazo} turnos</span>}
    {d.valor != null && <span className="chip-c">Valor {d.valor}</span>}
    {d.duracion && <span className="chip-c">{d.duracion}</span>}
    {d.ciudades && <span className="chip-c">{d.ciudades}</span>}
    {d.ciudad && d.deck !== 'personaje' && <span className="chip-c">{d.ciudad}</span>}
    {d.ref && <span className="chip-c ref">R {d.ref}</span>}
  </div>
);

// Jorge (12 de noviembre): la carta del personaje ya no muestra Saber, Labia, Fuerza… (siguen en personajes.json).

export default function Carta({ datos, tam = 'completa', children, className = '' }) {
  const completa = tam === 'completa';
  useContadorCartas(completa);
  if (!datos) return null;
  const [et, ar] = ETIQUETA[datos.deck] || ETIQUETA.especial;
  const pintada = completa ? pintadaDe(datos) : null;
  if (tam === 'dorso') {
    return <img className={`carta-dorso ${className}`} src={`/cartas/dorsos/${DORSO[datos.deck] || 'objetos'}.webp`} alt={`Dorso: ${et}`} loading="lazy" draggable="false" />;
  }
  if (tam === 'mini') {
    return (
      <div className="carta-caja">
        <div className={`carta tam-mini deck-${datos.deck} ${className}`} role="img" aria-label={`${et}: ${datos.titulo}`}>
          <span className="mini-ico"><Icono deck={datos.deck} size={20} /></span>
          <span className="mini-tit">{datos.titulo}</span>
          <span className="mini-pie">{datos.valor != null ? `${datos.valor} din.` : et}</span>
        </div>
      </div>
    );
  }
  // Carta terminada: la imagen ya trae título, texto y marco; se muestra tal cual, sin nada encima.
  if (pintada && PINTADAS[pintada].terminada) {
    return (
      <div className="carta-caja">
        <article className={`carta terminada ${className}`} data-carta-completa data-deck={datos.deck} data-id={datos.id} aria-label={`${et}: ${datos.titulo}. ${datos.texto || ''}`}>
          <img className="terminada-img" src={`/arte/cartas/${pintada}.webp`} alt="" draggable="false" />
          {children}
        </article>
      </div>
    );
  }
  return (
    <div className="carta-caja">
    <article className={`carta tam-completa deck-${datos.deck}${pintada ? ' pintada' + (PINTADAS[pintada].titulo === 'abajo' ? ' tit-abajo' : '') + (PINTADAS[pintada].texto === 'arriba' ? ' txt-arriba' : '') : ''} ${className}`} data-carta-completa data-deck={datos.deck} data-id={datos.id} aria-label={`${et}: ${datos.titulo}`}>
      <header className="c-cab">
        <span className="c-ico"><Icono deck={datos.deck} size={22} /></span>
        <h3 className="c-tit">{datos.titulo}</h3>
      </header>
      {datos.sub && <p className="c-sub">{datos.sub}</p>}
      <figure className="c-arte">{pintada ? <Arte clave={'cartas/' + pintada} /> : datos.arte ? <Arte clave={datos.arte} /> : <Adorno />}</figure>
      <div className="c-pill"><span>{et}</span><span className="ar">{ar}</span></div>
      <div className="c-cuerpo">
        <p className="c-texto">{datos.texto}</p>
        {datos.ghul && <p className="c-nota"><i>{datos.ghul}</i></p>}   {/* cartas de sheij: renglón aparte (Jorge, 21 de noviembre) */}
        {datos.limite && <p className="c-nota"><b>Límite:</b> {datos.limite}</p>}
        {datos.costo && <p className="c-nota"><b>Costo:</b> {datos.costo}</p>}
        {datos.deck === 'cuento' && <p className="c-nota c-premio">{datos.premioEtiqueta}.</p>}
        {datos.gancho && datos.deck === 'mesa' && <p className="c-nota"><b>Cómo se comprueba:</b> {datos.gancho}</p>}
        {children}
      </div>
      {(datos.humor || datos.cita) && <p className="c-cita">{datos.humor || datos.cita}</p>}
      <Chips d={datos} />
    </article>
    </div>
  );
}
