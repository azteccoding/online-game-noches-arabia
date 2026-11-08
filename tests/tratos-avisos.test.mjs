// Avisos en los tratos (Jorge, 8 de noviembre): «Trato costoso» si se piden más de 50 dinares o más de 100 noches;
// «Trato demasiado barato» si hay dinares (pedidos u ofrecidos) entre 1 y 4; sin dinares no sale.
import assert from 'node:assert/strict';
import { avisosTrato } from '../src/game/tratos.js';

assert.deepEqual(avisosTrato({}, { dinares: 30, noches: 400 }), ['Trato costoso'], 'el caso de Jorge: 30 dinares y 400 noches');
assert.deepEqual(avisosTrato({}, { dinares: 51 }), ['Trato costoso']);
assert.deepEqual(avisosTrato({}, { dinares: 50, noches: 100 }), [], 'justo en el límite no sale');
assert.deepEqual(avisosTrato({}, { noches: 101 }), ['Trato costoso']);
assert.deepEqual(avisosTrato({ dinares: 500 }, {}), [], 'ofrecer mucho no es costoso para quien recibe');
assert.deepEqual(avisosTrato({ dinares: 3 }, {}), ['Trato demasiado barato']);
assert.deepEqual(avisosTrato({}, { dinares: 4 }), ['Trato demasiado barato']);
assert.deepEqual(avisosTrato({ dinares: 5 }, { dinares: 5 }), []);
assert.deepEqual(avisosTrato({ objetos: [1] }, { idx: [0] }), [], 'sin dinares no sale');
assert.deepEqual(avisosTrato({ dinares: 2 }, { dinares: 80 }), ['Trato costoso', 'Trato demasiado barato']);
assert.deepEqual(avisosTrato({ dinares: '3' }, { dinares: '', noches: '200' }), ['Trato costoso', 'Trato demasiado barato'], 'valores del formulario (texto)');
console.log('avisos de tratos OK');
