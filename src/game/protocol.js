// Protocolo WebSocket (JSON). Ver plan-juego-web.md, sección «Protocolo».
// Cliente -> servidor:
//   {t:'hola', token?, nombre?}            identifica o crea al jugador (token en localStorage = reconexión)
//   {t:'accion', a:{t:'...', ...}, n}      acción de juego (la valida el motor: shared/engine.js)
//   {t:'ping'}
// Servidor -> cliente:
//   {t:'bienvenida', token, pid, codigo}   tras 'hola'
//   {t:'estado', s}                        VISTA filtrada para ese jugador (nunca el estado completo)
//   {t:'error', msg, n}                    acción rechazada
//   {t:'rechazo', msg}                     no se puede entrar (partida empezada / sala llena)
//   {t:'pong'}
// Los nombres de acción son los de despachar() en shared/engine.js.
export const ACCIONES = {
  elegirPj: (pj) => ({ t: 'elegirPj', pj }),
  listo: (v) => ({ t: 'listo', v }),
  opciones: (dificultad) => ({ t: 'opciones', dificultad }),
  dificultadAsesinos: (dificultadAsesinos) => ({ t: 'opciones', dificultadAsesinos }),
  sinYafar: (v) => ({ t: 'opciones', sinYafar: !!v }),
  iniciar: () => ({ t: 'iniciar' }),
  esperarMas: (v) => ({ t: 'esperarMas', v }),
  chat: (para, tipo, extra) => ({ t: 'chat', para, tipo, ...extra }),
  decidir: (id, resp) => ({ t: 'decidir', id, ...resp }),
  tirarDados: () => ({ t: 'tirarDados' }),
  cerrarDados: () => ({ t: 'cerrarDados' }),
  lanzarDados: () => ({ t: 'lanzarDados' }),
  viajar: (destino, extra = {}) => ({ t: 'viajar', destino, ...extra }),
  terminarTurno: () => ({ t: 'terminarTurno' }),
  responderCC: (opcion) => ({ t: 'responderCC', opcion }),
  omitirCC: () => ({ t: 'omitirCC' }),
  atacar: (tipo, objetivo, extra = {}) => ({ t: 'atacar', tipo, objetivo, ...extra }),
  comprar: (item) => ({ t: 'comprar', ...item }),
  vender: (uid) => ({ t: 'vender', uid }),
  tirar: (uid) => ({ t: 'tirar', uid }),
  usar: (uid, extra = {}) => ({ t: 'usar', uid, ...extra }),
  proponerTrato: (con, ofrece, pide, contra = false) => ({ t: 'proponerTrato', con, ofrece, pide, contra }),
  responderTrato: (id, ok, contra = false) => ({ t: 'responderTrato', id, ok, contra }),
  cancelarTrato: (id) => ({ t: 'cancelarTrato', id }),
  ofrecer5: (a) => ({ t: 'ofrecer5', a }),
  reto: (id, sub) => ({ t: 'reto', id, sub }),
  tesoro: (sub, extra = {}) => ({ t: 'tesoro', sub, ...extra }),
  esconder: (monto, nuevo = false) => ({ t: 'esconder', monto, nuevo }),
  recuperar: (uid) => ({ t: 'recuperar', uid }),
  asesinos: () => ({ t: 'asesinos' }),
  venderFirmanYafar: () => ({ t: 'venderFirmanYafar' }),
  lazo: (sub, uid) => ({ t: 'lazo', sub, uid }),   // amarrar o recuperar el camello (Jorge, 19 de noviembre)
  esclavo: (sub, uid) => ({ t: 'esclavo', sub, uid }),   // dejar, tomar, amarrar o recuperar un esclavo (Jorge, 27 de noviembre)
  pj: (sub, extra = {}) => ({ t: 'pj', sub, ...extra }),
  reclamarAnfitrion: (pin) => ({ t: 'reclamarAnfitrion', pin }),
  votarReinicio: (si) => ({ t: 'votarReinicio', si: !!si }),
  callarJamil: (si = true) => ({ t: 'callarJamil', si }),
  volver: () => ({ t: 'volver' }),
  volverPartida: () => ({ t: 'volverPartida' }),
  ganarYa: () => ({ t: 'ganarYa' }),   // Jorge (19 de noviembre): con 1,001 noches, tras «Seguir jugando»   // Jorge (19 de noviembre): seguir jugando después de ganar con 1,001 noches
  host: {
    sacarEspera: (pid) => ({ t: 'host.sacarEspera', pid }),
    sacarDesconectado: (pid) => ({ t: 'host.sacarDesconectado', pid }),
    dar: (pid, dinares, noches) => ({ t: 'host.dar', pid, dinares, noches }),
    corregir: (pid, campo, valor) => ({ t: 'host.corregir', pid, campo, valor }),
    repartir: (pid, mazo, id) => ({ t: 'host.repartir', pid, mazo, id }),
    barajar: (mazo) => ({ t: 'host.barajar', mazo }),
    tirarNPC: (quien, n) => ({ t: 'host.tirarNPC', quien, n }),
    pasarTurno: () => ({ t: 'host.pasarTurno' }),
    revelarCarta: (mazo) => ({ t: 'host.revelarCarta', mazo }),
    ceder: (pid) => ({ t: 'host.ceder', pid }),
    eliminar: (pid) => ({ t: 'host.eliminar', pid }),
    sacarSala: (pid) => ({ t: 'host.sacarSala', pid }),
    caja: (abrir) => ({ t: 'host.caja', abrir: !!abrir }),
    reiniciar: () => ({ t: 'host.reiniciar' }),
  },
};
