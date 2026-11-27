// Orden de las ventanas (Jorge, 19 de noviembre): carta → dados → decisión, sin esperas en círculo.
import assert from 'node:assert/strict';
import { cartaEspera, decisionVisible } from '../src/game/orden.js';
// Temporada de especias: la decisión (id 10) llega antes que la carta de Cuentos de la llegada (nro 12): primero la carta
assert.equal(cartaEspera({ cola0: 12, dados: null, votoPendiente: false }), false, 'la carta no espera detrás de la decisión');
assert.equal(decisionVisible({ leyendo: 12, porLeer: 12, dados: null, yo: 'a' }), false, 'la decisión espera a la carta posterior');
assert.equal(decisionVisible({ leyendo: null, porLeer: null, dados: null, yo: 'a' }), true, 'cerrada la carta, sale la decisión');
// el ciclo de antes: carta 12, dados 14 (después de la carta) y decisión 11: la carta sale, luego los dados, luego la decisión
assert.equal(cartaEspera({ cola0: 12, dados: { id: 14 }, votoPendiente: false }), false, 'carta anterior a los dados: se lee primero');
assert.equal(cartaEspera({ cola0: 15, dados: { id: 14 }, votoPendiente: false }), true, 'carta posterior a los dados: espera');
assert.equal(decisionVisible({ leyendo: null, porLeer: null, dados: { id: 14, cerrados: [] }, yo: 'a' }), false, 'la decisión espera a los dados');
assert.equal(decisionVisible({ leyendo: null, porLeer: null, dados: { id: 14, cerrados: ['a'] }, yo: 'a' }), true, 'si ya los cerraste, no');
assert.equal(cartaEspera({ cola0: 12, dados: null, votoPendiente: true }), true, 'el voto de reinicio sí tapa');
// Desenlace de un reto propio (Jorge, 21 de noviembre): la alerta (id 20) no sale encima de la carta del reto (nro 18)
{
  const { alertaVisible } = await import('../src/game/orden.js');
  assert.equal(alertaVisible({ leyendo: 18, porLeer: 18, id: 20 }), false, 'primero se cierra la carta del reto');
  assert.equal(alertaVisible({ leyendo: null, porLeer: null, id: 20 }), true, 'cerrada la carta, sale el desenlace');
  assert.equal(alertaVisible({ leyendo: 25, porLeer: 25, id: 20 }), true, 'una carta posterior no la tapa');
}
// El genio en el 3D (Jorge, 27 de noviembre): mientras sale, nada; luego su carta; luego el botón «Pedir un deseo»; la ventana solo al tocarlo
{
  const { estadoDeseo } = await import('../src/game/orden.js');
  const pend = { tipo: 'ifrit', mia: true, respondiste: false };
  assert.equal(estadoDeseo({ pend, en3d: true, ifritFuera: false, deseoAbierto: false }), 'genio', 'mientras sale el genio, pantalla despejada');
  assert.equal(estadoDeseo({ pend, en3d: true, ifritFuera: true, deseoAbierto: false }), 'boton', 'ya fuera: el botón, no la ventana');
  assert.equal(estadoDeseo({ pend, en3d: true, ifritFuera: true, deseoAbierto: true }), 'ventana', 'al tocar el botón, la ventana');
  assert.equal(estadoDeseo({ pend: { ...pend, mia: false }, en3d: true, ifritFuera: true, deseoAbierto: false }), null, 'los demás ven la espera de siempre');
  assert.equal(estadoDeseo({ pend, en3d: false, ifritFuera: false, deseoAbierto: false }), null, 'en el 2D, como siempre');
  assert.equal(estadoDeseo({ pend: { tipo: 'trato', mia: true }, en3d: true, ifritFuera: false, deseoAbierto: false }), null, 'otras decisiones no cambian');
}
// Texto de la ventana de los dados (Jorge, 27 de noviembre): la carta sale del motivo, nunca de «la última que salió»
{
  const { cartaDelMotivo } = await import('../src/game/orden.js');
  assert.equal(cartaDelMotivo('e11'), 'E11'); assert.equal(cartaDelMotivo('h12'), 'H12'); assert.equal(cartaDelMotivo('ej:EJ26'), 'EJ26');
  assert.equal(cartaDelMotivo('reto:R3'), 'R3'); assert.equal(cartaDelMotivo('pelea'), null); assert.equal(cartaDelMotivo('jorasan'), null); assert.equal(cartaDelMotivo(undefined), null);
}
