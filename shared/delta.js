// Mensajes más ligeros (Jorge, 8 de noviembre): el servidor ya no reenvía en cada cambio todo el historial de cartas ni todo el registro.
// A cada conexión le manda primero la vista completa y después solo las cartas del historial que son nuevas o cambiaron (por ejemplo,
// una trivia que ya se resolvió) y las líneas nuevas del registro. El cliente las junta con lo que ya tenía y obtiene exactamente la
// misma vista que antes. Al reconectarse, la conexión es nueva y vuelve a recibir todo. No cambia cómo se guarda la partida.
export const HISTORIAL_MAX = 120, LOG_MAX = 80;

// Memoria por conexión de lo que ya se le mandó.
export const nuevaMemoria = () => ({ hist: null, logN: 0 });

// Devuelve el mensaje a enviar (con historial y registro reducidos si ya se había mandado una vista completa) y actualiza la memoria.
export function reducirVista(v, mem) {
  const huellas = new Map((v.historial || []).map((h) => [h.nro, JSON.stringify(h)]));
  const maxN = Math.max(mem.logN, ...(v.log || []).map((l) => l.n || 0));
  if (!mem.hist) { mem.hist = huellas; mem.logN = maxN; return v; }                 // primera vez: todo
  const historial = (v.historial || []).filter((h) => mem.hist.get(h.nro) !== huellas.get(h.nro));
  const log = (v.log || []).filter((l) => (l.n || 0) > mem.logN);
  for (const [k, x] of huellas) mem.hist.set(k, x);
  for (const k of [...mem.hist.keys()]) if (!huellas.has(k)) mem.hist.delete(k);
  mem.logN = maxN;
  return { ...v, historial, log, delta: true };
}

// En el cliente: junta el mensaje con la vista anterior y devuelve la vista completa.
export function aplicarDelta(prev, s) {
  if (!s.delta || !prev) { const { delta, ...r } = s; return r; }
  const m = new Map((prev.historial || []).map((h) => [h.nro, h]));
  for (const h of s.historial) m.set(h.nro, h);
  const historial = [...m.values()].sort((a, b) => a.nro - b.nro).slice(-HISTORIAL_MAX);
  const vistos = new Set((prev.log || []).map((l) => l.n));
  const log = [...(prev.log || []), ...s.log.filter((l) => !vistos.has(l.n))].slice(-LOG_MAX);
  const { delta, ...r } = s;
  return { ...r, historial, log };
}
