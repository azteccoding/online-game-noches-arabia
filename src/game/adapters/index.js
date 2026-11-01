// Selecciona el adaptador. Interfaz común:
//   modo, conectar(params), enviar(accion), cerrar(), onEstado(cb), onConexion(cb), onError(cb), onRechazo(cb), [verComo(pid), pids()]
// El adaptador DEMO (motor + datos completos en el navegador) solo se incluye en builds con VITE_DEMO=1 (npm run dev / npm run build:demo).
export async function crearAdaptador(params) {
  if (import.meta.env.VITE_DEMO === '1' && params.demo) {
    const m = await import('./localAdapter.js');
    return m.crearLocal();
  }
  const m = await import('./wsAdapter.js');
  return m.crearWs();
}
