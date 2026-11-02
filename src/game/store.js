import { useSyncExternalStore } from 'react';

// Almacén mínimo: el estado del juego llega ya filtrado desde el adaptador. Los componentes se suscriben con useJuego(selector).
let S = { estado: null, conexion: 'inicio', error: null, aviso: null, rechazo: null, demo: false, pids: null };
const oyentes = new Set();
let adaptador = null;
const emitir = () => oyentes.forEach((f) => f());
const poner = (p) => { S = { ...S, ...p }; emitir(); };

export function useJuego(sel = (s) => s) {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => oyentes.delete(f); }, () => sel(S), () => sel(S));
}
export const leer = () => S;
// Aviso verde local (premios, nueva ronda…); se borra solo a los 3.5 s.
export function avisar(msg) { const aviso = S.aviso && S.aviso !== msg && !S.aviso.includes(' · ') ? S.aviso + ' · ' + msg : msg;   // como mucho dos avisos juntos poner({ aviso }); setTimeout(() => { if (S.aviso === aviso) poner({ aviso: null }); }, 3500); }

export async function iniciarJuego(params) {
  const { crearAdaptador } = await import('./adapters/index.js');
  adaptador = await crearAdaptador(params);
  adaptador.onEstado((estado) => poner({ estado, error: null }));
  adaptador.onConexion((conexion) => poner({ conexion }));
  adaptador.onError((error) => { poner({ error }); setTimeout(() => { if (S.error === error) poner({ error: null }); }, 4000); });
  adaptador.onHecho?.((aviso) => { poner({ aviso }); setTimeout(() => { if (S.aviso === aviso) poner({ aviso: null }); }, 3500); });   // confirmación de entregas y tesoro
  adaptador.onRechazo?.((rechazo, pideClave) => poner({ rechazo, pideClave: !!pideClave, conexion: 'inicio' }));   // de vuelta a la pantalla de entrada con el motivo
  poner({ demo: adaptador.modo === 'demo', pids: adaptador.pids?.() || null });
  adaptador.conectar(params);
}
export const enviar = (a) => adaptador?.enviar(a);
export const verComo = (pid) => adaptador?.verComo?.(pid);
export const adaptadorActual = () => adaptador;
