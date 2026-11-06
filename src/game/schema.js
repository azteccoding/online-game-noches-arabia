/**
 * Esquema de la VISTA que recibe cada cliente (la produce vista() en shared/engine.js).
 * @typedef {Object} Vista
 * @property {string} yo            id del jugador local
 * @property {'lobby'|'juego'|'fin'} fase
 * @property {number} ronda
 * @property {number} ahora         reloj del servidor (ms) en el momento de emitir la vista
 * @property {string} host          id del banco/anfitrión;  soyHost: boolean
 * @property {string[]} orden       orden de turnos
 * @property {Object<string, Jugador>} jugadores
 * @property {{pid:string, fase:'ingreso'|'mov'|'accion', tramos:number, movio:boolean, ccActual:{tipo:string,nro:number}|null}|null} turno
 * @property {{id:number,n:number,valores:number[],por:string,motivo:string,t0:number}|null} dados
 * @property {Array<CartaHist>} historial   DATOS de cartas (no imágenes). La respuesta de una trivia solo aparece en `resuelto`.
 * @property {number|null} ultimaCarta       nro de la última carta pública
 * @property {Array<{uid:string,tipo:string,ref:string,datos:Object}>} mano   SOLO tus cartas
 *
 * @typedef {Object} Jugador  campos públicos: id,nombre,pj,listo,conectado,dinares,noches,ciudad,herido,perdido,buscado,eliminado,nMano{tipo:n},tieneMensaje,nMensajes
 * @typedef {Object} CartaHist  {nro,id,deck('cuento' = cuento de ambiente, 19.7),titulo,sub?,texto,efecto?,quien,t,ronda,arte,para?,resuelto?}
 */
export const esMiTurno = (s) => !!s && s.turno?.pid === s.yo && s.fase === 'juego';
export const jugadoresEnOrden = (s) => s.orden.map((id) => s.jugadores[id]).filter((j) => j && !j.eliminado);
export const cartaPorNro = (s, nro) => s.historial.find((h) => h.nro === nro) || null;
