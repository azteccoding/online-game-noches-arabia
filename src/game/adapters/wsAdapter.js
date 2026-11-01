// Adaptador WebSocket: habla con server/index.js. Reconexión automática con el token guardado en localStorage.
export function crearWs() {
  let ws = null, cerrado = false, intento = 0, ping = null, nombre = '';
  const cb = { estado: () => {}, conexion: () => {}, error: () => {}, rechazo: () => {}, hecho: () => {} };
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  const abrir = () => {
    cb.conexion(intento ? 'reconectando' : 'conectando');
    ws = new WebSocket(url);
    ws.onopen = () => {
      intento = 0; cb.conexion('ok');
      ws.send(JSON.stringify({ t: 'hola', token: localStorage.getItem('mun.token') || undefined, nombre: nombre || localStorage.getItem('mun.nombre') || undefined, clave: localStorage.getItem('mun.clave') || undefined }));
      clearInterval(ping); ping = setInterval(() => ws.readyState === 1 && ws.send('{"t":"ping"}'), 20000);
    };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 'estado') cb.estado(m.s);
      else if (m.t === 'bienvenida') localStorage.setItem('mun.token', m.token);
      else if (m.t === 'error') cb.error(m.msg);
      else if (m.t === 'hecho') cb.hecho(m.msg);
      else if (m.t === 'rechazo') { cerrado = true; if (m.clave) localStorage.removeItem('mun.clave'); cb.rechazo(m.msg, !!m.clave); ws.close(); }
    };
    ws.onclose = () => { clearInterval(ping); if (cerrado) return; cb.conexion('caido'); intento++; setTimeout(abrir, Math.min(500 * 2 ** intento, 5000)); };
  };
  let n = 0;
  return {
    modo: 'ws',
    conectar(p) { nombre = p.nombre || ''; if (nombre) localStorage.setItem('mun.nombre', nombre); abrir(); },
    enviar(a) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'accion', a, n: ++n })); else cb.error('Sin conexión con el servidor.'); },
    cerrar() { cerrado = true; ws?.close(); },
    onEstado: (f) => { cb.estado = f; }, onConexion: (f) => { cb.conexion = f; }, onError: (f) => { cb.error = f; }, onRechazo: (f) => { cb.rechazo = f; }, onHecho: (f) => { cb.hecho = f; },
  };
}
