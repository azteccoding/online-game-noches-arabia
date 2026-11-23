import { useState } from 'react';
import Sprite from './Sprite.jsx';

// Retrato de cuerpo entero de un personaje: la misma figura pintada del tablero 3D, de frente (public/arte3d/elegir-<id>.webp,
// lo hace preparar-elegir.py). Si la imagen no carga, se muestra el monito vectorial de siempre.
export default function FiguraPj({ pj, alto = 84 }) {
  const [falla, setFalla] = useState(false);
  if (falla) return <Sprite pj={pj} alto={alto} />;
  return <img className="figura-pj" src={`${import.meta.env.BASE_URL}arte3d/elegir-${pj}.webp`} alt="" height={alto} style={{ height: alto }} loading="lazy" decoding="async" onError={() => setFalla(true)} />;
}
