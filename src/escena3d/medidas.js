// Medidas fijas de la capa 3D: el tablero es el mapa del juego (2970 × 2100 unidades de mapa) y 1 unidad de mundo = 100 unidades de mapa.
import * as THREE from 'three';

export const U = 0.01;
export const ANCHO = 29.7;                   // este–oeste (X)
export const ALTO = 21.0;                    // norte–sur (Z)
export const aMundo = (x, y, alt = 0) => new THREE.Vector3(x * U - ANCHO / 2, alt, y * U - ALTO / 2);
// Colores del tema del juego (los mismos de su hoja de estilos).
export const PALETA = { noche: '#1d0709', vino: '#7b1e24', vinoOsc: '#4d0e17', indigo: '#22407f', indigoOsc: '#142a5c', oro: '#b9803a', oroClaro: '#efd08f', turquesa: '#2a8a8a', pergamino: '#f1e3b8', pergaminoOsc: '#e2cf9a', tinta: '#2b130c' };
