import React from 'react';

// Iconos de mazo en SVG (currentColor). Un icono por tipo de carta; se reutilizan en cartas, miniaturas y menús.
const P = {
  evento: <path d="M5 21V4M5 5h13l-3 4 3 4H5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  historico: <path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  mensaje: <path d="M4 7h16v10H4zM4 7l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  reto: <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.6l1.1-6L3.4 9.4l6-.8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  objeto: <path d="M6 9l2-4h8l2 4v11H6zM9 9h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  trivia: <path d="M9.5 9a2.5 2.5 0 115 0c0 2-2.5 2-2.5 4M12 17.5v.5M3 12a9 9 0 1018 0 9 9 0 10-18 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  cuento: <path d="M12 6c-2-1.5-5-1.8-8-1v13c3-.8 6-.5 8 1 2-1.5 5-1.8 8-1V5c-3-.8-6-.5-8 1zM12 6v13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  mesa: <path d="M4 8h16M6 8v10M18 8v10M8 12h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  ifrit: <path d="M5 16c0-3 3-4 5-6s1-5 3-6c0 3 4 3 4 8 0 3-2 5-6 5s-6-1-6-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  especial: <path d="M12 3l2 6h6l-5 4 2 7-5-4-5 4 2-7-5-4h6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  personaje: <path d="M12 4a4 4 0 110 8 4 4 0 010-8zM4 21c0-5 4-7 8-7s8 2 8 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
};
export const Icono = ({ deck, size = 22 }) => <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{P[deck] || P.especial}</svg>;

export const ETIQUETA = {
  evento: ['EVENTO', 'حدث'], historico: ['HISTORIA', 'تاريخ'], mensaje: ['MENSAJE', 'رسالة'], reto: ['RETO', 'تحدٍّ'], objeto: ['OBJETO', 'غرض'],
  trivia: ['CUENTO', 'حكاية'], mesa: ['DE MESA', 'حكاية'], cuento: ['CUENTO', 'قصة'], ifrit: ['IFRIT', 'عفريت'], especial: ['ESPECIAL', 'خاص'], personaje: ['PERSONAJE', 'شخصية'],
};
export const DORSO = { evento: 'eventos', historico: 'historicos', mensaje: 'mensajes', reto: 'retos', objeto: 'objetos', trivia: 'cc', mesa: 'cc', cuento: 'cc', ifrit: 'ifrit', especial: 'objetos', personaje: 'personajes' };

// Adorno geométrico procedural (estrella de 8 puntas) para cartas sin ilustración. Vectorial, no pesa ni se pixela.
export const Adorno = () => (
  <svg className="adorno" viewBox="0 0 200 110" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><pattern id="trama-adorno" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M20 2l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".5" /></pattern></defs>
    <rect width="200" height="110" fill="url(#trama-adorno)" />
    <g transform="translate(100 55)" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="-30" y="-30" width="60" height="60" /><rect x="-30" y="-30" width="60" height="60" transform="rotate(45)" /><circle r="14" /><circle r="4" fill="currentColor" />
    </g>
  </svg>
);
