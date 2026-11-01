import React from 'react';
import { useSprite } from '../game/sprites.js';

// Sprite vectorial de un personaje (símbolo de /svg/sprites.svg). Sin PNG.
export default function Sprite({ pj, alto = 44, className = '' }) {
  const href = useSprite('p' + pj);
  return (
    <svg className={`sprite ${className}`} viewBox="0 0 120 200" width={alto * 0.6} height={alto} aria-hidden="true">
      <use href={href} width="120" height="200" />
    </svg>
  );
}
