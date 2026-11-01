import React from 'react';

// Sprite vectorial de un personaje (símbolo de /svg/sprites.svg). Sin PNG.
export default function Sprite({ pj, alto = 44, className = '' }) {
  return (
    <svg className={`sprite ${className}`} viewBox="0 0 120 200" width={alto * 0.6} height={alto} aria-hidden="true">
      <use href={`/svg/sprites.svg#p${pj}`} width="120" height="200" />
    </svg>
  );
}
