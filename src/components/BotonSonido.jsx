import React, { useEffect, useState } from 'react';
import { activarSonido, silenciarSonido, sonidoActivado, sonidoSilenciado, alCambiarSonido } from '../game/sonidos.js';

// «Activar sonido» (Jorge, 12 de noviembre; PRUEBA, sin commit): solo cuando el servidor manda sonidos (en local).
// Ya activado, el mismo botón silencia y vuelve a activar. Al recargar la página hay que activarlo de nuevo.
export default function BotonSonido({ s }) {
  const [on, setOn] = useState(sonidoActivado());
  useEffect(() => alCambiarSonido(setOn), []);
  if (!s?.sonidos) return null;
  const texto = on ? '🔊 Sonido activado' : sonidoSilenciado() ? '🔇 Sonido silenciado' : '🔈 Activar sonido';
  return <button className={`btn mini sec boton-sonido${on ? ' on' : ''}`} onClick={on ? silenciarSonido : activarSonido} aria-pressed={on} title={on ? 'Toca para silenciar' : 'Toca para activar el sonido'}>{texto}</button>;
}
