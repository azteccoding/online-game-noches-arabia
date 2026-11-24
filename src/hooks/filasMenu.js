// Las filas que recorre Shift + flecha arriba o abajo (Jorge, 23 y 24 de noviembre). Primero lo que el jugador acaba de abrir a
// propósito (las reacciones rápidas, tecla e), luego lo que pide respuesta (las opciones de la carta abierta, las de la decisión)
// y al final el menú abierto (acciones, mercado, tratos). Sin filas, Shift + flechas mueve la cámara tres veces más rápido
// (escena3d/camara.js): por eso las dos partes preguntan aquí.
const visibles = (sel) => [...document.querySelectorAll(sel)].filter((f) => f.offsetParent && !f.disabled);
export function filasDeMenu() {
  let filas = visibles('.reacciones-lista button');
  if (!filas.length) filas = visibles('.carta .opciones button');
  if (!filas.length) filas = visibles('.decision .decision-botones > button, .decision .decision-opc > li, .decision > button, .decision-num ~ button');
  if (!filas.length) filas = visibles('[role="dialog"] .accion-fila, [role="dialog"] .lista-merc > li, [role="dialog"] .trato.entrante');
  return filas;
}
