import React, { useEffect, useRef, useState } from 'react';

// Alerta (Jorge, 21 de noviembre): «todas las alertas duran 5 segundos y luego se quitan, sin perjuicio de que las puedas cerrar
// (deslizándolas en teléfonos) y tocándolas en cualquier dispositivo».
export const DURA_ALERTA_MS = 5000;
const UMBRAL_PX = 50;   // cuánto hay que deslizarla para cerrarla

export default function Alerta({ className, role = 'status', onCerrar, children }) {
  const [dx, setDx] = useState(0);
  const [saliendo, setSaliendo] = useState(0);   // -1 / 1: sale deslizándose hacia ese lado
  const inicio = useRef(null);
  const movio = useRef(false);
  const cerrar = useRef(onCerrar); cerrar.current = onCerrar;
  useEffect(() => { const t = setTimeout(() => cerrar.current?.(), DURA_ALERTA_MS); return () => clearTimeout(t); }, []);
  useEffect(() => { if (!saliendo) return undefined; const t = setTimeout(() => cerrar.current?.(), 180); return () => clearTimeout(t); }, [saliendo]);
  const abajo = (ev) => { inicio.current = { x: ev.clientX, y: ev.clientY }; movio.current = false; };
  const mueve = (ev) => {
    if (!inicio.current) return;
    const d = ev.clientX - inicio.current.x;
    if (Math.abs(d) > 6) movio.current = true;
    setDx(d);
  };
  const arriba = () => {
    if (!inicio.current) return;
    inicio.current = null;
    if (Math.abs(dx) >= UMBRAL_PX) setSaliendo(dx > 0 ? 1 : -1);
    else { setDx(0); if (!movio.current) cerrar.current?.(); }   // un toque (sin deslizar) también la cierra
  };
  const estilo = saliendo ? { transform: `translateX(${saliendo * 120}vw)`, opacity: 0, transition: 'transform .18s ease-in, opacity .18s' }
    : dx ? { transform: `translateX(${dx}px)`, opacity: Math.max(0.3, 1 - Math.abs(dx) / 200), transition: 'none' } : undefined;
  return (
    <div className={`${className} alerta-5s`} role={role} title="Toca o desliza para cerrar" style={estilo}
      onPointerDown={abajo} onPointerMove={mueve} onPointerUp={arriba} onPointerCancel={() => { inicio.current = null; setDx(0); }}>
      {children}
    </div>
  );
}
