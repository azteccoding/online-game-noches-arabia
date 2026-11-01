import React from 'react';
import { useVista } from '../hooks/useLienzo.js';

const Marco = ({ ancho }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x={ancho ? 2 : 6} y={ancho ? 6 : 2} width={ancho ? 20 : 12} height={ancho ? 12 : 20} rx="2" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
);

// Selector visible de la vista: vertical en la sala (pantallas verticales), horizontal al empezar; se aplica al instante (ver useLienzo).
export default function SelectorVista({ compacto = false }) {
  const { modo, setModo } = useVista();
  return (
    <div className={`selector-vista${compacto ? ' compacto' : ''}`} role="group" aria-label="Vista del juego">
      <button type="button" aria-pressed={modo === 'horizontal'} onClick={() => setModo('horizontal')} title="Vista horizontal"><Marco ancho /><span>Horizontal</span></button>
      <button type="button" aria-pressed={modo === 'vertical'} onClick={() => setModo('vertical')} title="Vista vertical"><Marco /><span>Vertical</span></button>
    </div>
  );
}
