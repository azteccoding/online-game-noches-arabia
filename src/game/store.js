import { useSyncExternalStore } from 'react';

// Almacén mínimo: el estado del juego llega ya filtrado desde el adaptador. Los componentes se suscriben con useJuego(selector).
let S = { estado: null, conexion: 'inicio', error: null, aviso: null, rechazo: null, demo: false, pids: null, reacciones: [] };
const oyentes = new Set();
let adaptador = null;
const emitir = () => oyentes.forEach((f) => f());
const poner = (p) => { S = { ...S, ...p }; emitir(); };

export function useJuego(sel = (s) => s) {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => sel(S), () => sel(S));
}
export const leer = () => S;
// Carta que se está leyendo (nro del historial): los dados lanzados después de ella esperan a que se cierre.
export function marcarCartaEnPantalla(nro) { if (S.cartaEnPantalla !== nro) poner({ cartaEnPantalla: nro }); }
// Aviso verde local (premios, nueva ronda…); se borra solo a los 3.5 s.
// Como mucho dos avisos juntos.
// Aviso rojo local (pagos y pérdidas propias); se borra solo a los 4 s.
export function avisarPerdida(msg) { poner({ error: msg }); setTimeout(() => { if (S.error === msg) poner({ error: null }); }, 4000); }
export function avisar(msg) { const aviso = S.aviso && S.aviso !== msg && !S.aviso.includes(' · ') ? S.aviso + ' · ' + msg : msg; poner({ aviso }); setTimeout(() => { if (S.aviso === aviso) poner({ aviso: null }); }, 3500); }

export async function iniciarJuego(params) {
  const { crearAdaptador } = await import('./adapters/index.js');
  adaptador = await crearAdaptador(params);
  adaptador.onEstado((estado) => poner({ estado, error: null }));
  adaptador.onConexion((conexion) => poner({ conexion }));
  // los anuncios largos duran un poco más (y se cierran al tocarlos: cerrarAviso)
  const dura = (t, base) => base + Math.min(6000, 45 * String(t || '').length);
  adaptador.onError((error) => { poner({ error }); setTimeout(() => { if (S.error === error) poner({ error: null }); }, dura(error, 4000)); });
  adaptador.onHecho?.((aviso) => { poner({ aviso }); setTimeout(() => { if (S.aviso === aviso) poner({ aviso: null }); }, dura(aviso, 3500)); });   // confirmación de entregas y tesoro
  adaptador.onReaccion?.((r) => {                                       // burbujas de reacción: como mucho 3 a la vez, 4.5 s cada una
    const k = `${r.de}-${r.ts}`; poner({ reacciones: [...S.reacciones, { ...r, k }].slice(-3) });
    setTimeout(() => poner({ reacciones: S.reacciones.filter((x) => x.k !== k) }), 4500);
  });
  adaptador.onRechazo?.((rechazo, pideClave) => poner({ rechazo, pideClave: !!pideClave, conexion: 'inicio' }));   // de vuelta a la pantalla de entrada con el motivo
  poner({ demo: adaptador.modo === 'demo', pids: adaptador.pids?.() || null });
  adaptador.conectar(params);
}
export const enviar = (a) => adaptador?.enviar(a);
// Cerrar un anuncio al tocarlo: solo lo oculta en este navegador; no cambia nada del juego (Jorge, 10 de noviembre).
export const cerrarAviso = (k) => poner({ [k]: null });
export const reaccionar = (id) => adaptador?.reaccionar?.(id);
export const verComo = (pid) => adaptador?.verComo?.(pid);
export const adaptadorActual = () => adaptador;
