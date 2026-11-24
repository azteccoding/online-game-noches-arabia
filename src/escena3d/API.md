# Escena 3D de «Mil y Una Noches»

Módulo que dibuja el tablero en 3D (three.js r170 y cannon-es 0.20.0, ambos con licencia MIT) y anima lo que el juego le
pide. **No decide nada**: no conoce reglas, costos ni resultados. El servidor resuelve y la escena lo muestra.

Banco de pruebas: `banco3d.html` (con `npm run dev`, en `/banco3d.html`). Usa solo la API pública de este documento.

## Crear la escena

```js
import { crearEscena } from './escena3d/index.js';

const escena = await crearEscena(contenedor, {
  tablero:    { width: 2970, height: 2100 },          // o { ancho, alto }
  ciudades:   [{ id, ar, x, y }, …],                  // las 12 ciudades, en unidades del mapa
  jorasan:    { id: 'Jorasán', ar, x, y },            // opcional: lugar sin rutas
  rutas:      [{ a, b, modo: 'tierra' | 'mar', d }, …],
  personajes: [{ id, nombre, arma }, …],              // ids 1 a 7 y 'B'
  recursos:   { mapa, fuenteMapa, caras, arte3d },    // opcional: URL de cada recurso
  sonidos:    SONIDOS,                                // opcional: tabla de ranuras (ver abajo)
  opciones:   { … },
});
```

El contenedor debe tener tamaño propio; el lienzo lo llena y se adapta solo si cambia. Recursos por defecto, todos en
`public/`: `svg/tablero-mapa.svg`, `fonts/MarcellusSC.woff2`, `svg/dados/cara-{n}.svg` y la carpeta `arte3d/` (figuras,
bustos y relieve).

Opciones: `base` (prefijo de las URL, por defecto `/`), `calidad` (`'alta'`, `'media'` o `'baja'`), `calidadAuto` (por
defecto `true`: si el equipo no da, baja primero las sombras y al final la nitidez), `hora` (`'dia'`, `'noche'`… o un número
de 0 a 1), `menosMovimiento` (por defecto sigue a `prefers-reduced-motion`), `dadosEnMapa` (por defecto `true`; ver «Dados»), `densidad`, `sombra` y `anchoMapa` (para fijar
a mano píxeles por punto, tamaño del mapa de sombras y ancho de la textura del mapa), `alProgreso(texto)` y cualquiera de
los avisos `al…` de abajo.

## Jugadores y fichas

| Función | Qué hace |
| --- | --- |
| `ponerJugadores(lista)` | Pone, actualiza o quita fichas para que queden las de la lista. Cada jugador: `{ id, nombre, personaje, color, ciudad, arma, escudo, transporte, turno }` (`escudo: true` le pone al brazo el escudo de cuero pintado). Devuelve una promesa (figuras cargadas). |
| `actualizarJugador(id, cambios)` | Cambia campos de un jugador. Con `ciudad` lo coloca ahí sin animación. |
| `quitarJugador(id)` | Quita la ficha. |
| `jugadores()` | Estado actual de cada ficha. |
| `seleccionarFicha(id)` / `marcarRival(id)` | Marca visual de ficha elegida o rival (`null` la quita). |

`arma`: `'cimitarra'`, `'jambiya'`, `'alfanje'`, `'arco'` o `''`. `transporte`: `'burro'`, `'caballo'`, `'camello'`,
`'caballoMongol'`, `'alfombra'` o `null` (a pie). El animal espera junto a la ficha; la alfombra va guardada.

## Viajes

`viajar(id, destino, { transporte, llevar, seguir })` devuelve una promesa que se cumple al llegar con
`{ id, origen, ciudad }`.

- `destino`: una ciudad (la escena busca el camino más corto por las rutas) o la lista completa de ciudades del camino.
- `transporte`: medio de este viaje; si no se da, usa el que tenga puesto el jugador. `null` = a pie.
- `llevar: true`: la figura camina y su animal va a su lado, del cabestro, sin montarlo; al llegar sigue siendo su
  transporte. En ruta de mar suben los dos al dhow.
- `seguir` (por defecto `true`): la cámara acompaña el viaje.
- Las rutas de mar se cruzan en dhow, con o sin animal. La alfombra vuela en línea directa a cualquier ciudad.
- El Jorasán no tiene rutas: se entra y se sale campo a través por la ciudad con rutas más cercana (Isfahán), a pie o
  con el transporte; la alfombra va directa.
- Se rechaza si la ficha ya viaja, está en una pelea o no hay camino.

`camino(desde, hasta)` devuelve la lista de ciudades que recorrería (o `null`); `vecinas(ciudad)`, las ciudades unidas por
una ruta.

## Dados

`lanzarDados({ valores: [..], color })` o `lanzarDados({ grupos: [{ etq, valores, color, fijo }] })`.

Los dados ruedan con física y **quedan exactamente en los valores pedidos**. Hasta 6 dados por fila; las filas ruedan una
tras otra y ahí se quedan hasta `limpiarDados()` (en la bandeja, ordenadas en renglones; sobre el mapa, cada dado donde
paró). `fijo: true` coloca la fila sin rodar. `color`:
`'rojo'`, `'amarillo'`, `'azul'`, `'verde'` o cualquier color CSS. `camara: false` evita que la cámara vaya a los dados.
La promesa se cumple al detenerse, con los valores de arriba (un arreglo, o uno por grupo). Una fila sola tarda de 2,6 a 3,0 s;
si la tirada trae varias filas, cada una tarda de 2,2 a 2,6 s.

**Dónde caen.** Con `opciones.dadosEnMapa` encendida (así viene), los dados caen sobre el mapa: en un claro cerca de donde
mira la cámara, sin ciudades ni fichas debajo y, si se puede, en tierra. Al tocar el suelo levantan polvo y granos de arena
(si caen al mar, salpican y dejan ondas; ranura de sonido `dados-agua`). Pueden rodar, pero **se quedan donde paran**: justo
antes de detenerse se entierran un poco en la arena, con su reborde, y después nada los mueve ni los ordena. Si la tirada
trae varias filas, cada una cae en su propio carril (una franja del claro, la primera al fondo) con su rótulo a la
izquierda, así no se mezclan ni se enciman; con más de 3 filas el claro crece hacia delante. Si la vista del momento no deja verlos
enteros y legibles (muy lejos, muy cerca o a pie de calle), la cámara se abre lo justo para encuadrarlos y vuelve sola al
terminar. Con `dadosEnMapa: false` ruedan en su bandeja, al fondo de la mesa, como antes. El API, los valores y los tiempos
son los mismos en los dos casos. En el banco de pruebas, `#bandeja` en la dirección apaga la opción.

## Pelea, flecha e Ifrit (solo animación)

| Función | Qué hace |
| --- | --- |
| `pelear(idAtacante, idDefensor, { armaAtacante, armaDefensor, disparoArco })` | Choque según el arma de cada uno (sin arma: puños). `disparoArco: true` añade antes un disparo del atacante. Unos 5 s. |
| `dispararFlecha(idTirador, idBlanco, { acierta })` | Solo el disparo. `acierta: true`: la flecha da y el blanco acusa el golpe; `false`: la esquiva o la desvía. Se cumple con `{ acierta }`, en unos 3 s. |
| `aparecerIfrit(idJugador | ciudad)` | Aparece la lámpara, tiembla y sale el genio. Se cumple con el genio fuera (unos 2,8 s) y ahí se queda. |
| `esconderIfrit()` | La lámpara absorbe al genio y desaparece (unos 1,8 s). |
| `soltarIfrit()` | Avisa que ya se eligió el deseo. Mientras el genio está en escena el mundo no avanza (fichas, barcos, ronda, pelea); tras este aviso solo sigue parado mientras el genio se mete. |

Las dos fichas deben estar quietas en la misma ciudad. Nada de esto cambia el estado del juego.

## Ronda, luz y ciudades

| Función | Qué hace |
| --- | --- |
| `transicionRonda(numero)` | Atardecer, noche y amanecer de la ronda nueva (unos 7 s). Avisa con `alCambiarRonda` ya de noche. |
| `amanecer()` | Amanecer del inicio de la partida (unos 4 s). |
| `ponerLuzTurno(indice, total)` | Luz por turnos: el día dura la ronda entera y se reparte entre los jugadores (0 = el primero del orden). La luz avanza despacio por el tramo de ese turno (unos 45 s); con 4 o 5, el último juega de noche; con 6 o más, los dos últimos. Con esto activo, `transicionRonda` solo termina de anochecer y enseña el rótulo, y `amanecer` deja la luz justo antes del alba. `null` vuelve a la luz fija. |
| `ponerHora(fase, { duracion })` | Hora fija: `'noche'`, `'amanecer'`, `'dia'`, `'mediodia'`, `'atardecer'` o un número de 0 a 1. |
| `ponerCiudadesQuemadas(lista)` | Ciudades que arden (lista completa cada vez; `[]` las apaga). El incendio suena (ranura `fuego-ardiendo`, con provisional sintetizado): el volumen sube al acercar la cámara a una ciudad en llamas y de lejos no se oye. |
| `resaltarCiudades(lista, { desde })` | Marca las ciudades a las que se puede ir; `null` o `[]` quita la marca. |

## Cámara

`vistaGeneral({ duracion })`, `enfocar(ciudad | idJugador, { duracion, distancia })`, `girar(pasos)` (cuartos de vuelta),
`leerCamara()`, `ponerCamara(vista | 'general')`, `volarA(vista, duracion)`, `estaEnPantalla(objetivo)`,
`posicionEnPantalla(objetivo)` (píxeles del lienzo, para colgar rótulos) y `ponerMargenes({ arr, aba, izq, der })` (píxeles
tapados por la interfaz en cada lado). Con ratón: arrastrar mueve, rueda acerca, botón derecho gira. Táctil: un dedo
mueve, dos dedos acercan y giran.

## Tiempo, pausa y calidad

- Todas las secuencias van en tiempo real: duran lo mismo en segundos con cualquier cantidad de cuadros por segundo.
- `pausar()` / `reanudar()`: deja de dibujar o vuelve a hacerlo. **Las secuencias no se detienen**: sus promesas se
  cumplen a su hora aunque la escena esté pausada, la pestaña oculta o el lienzo fuera de la vista; al volver, todo aparece
  en su estado final.
- `atenuar(true | false)`: para cuando hay una carta o un modal encima. Dibuja a unos 20 cuadros por segundo (5 si nada se
  mueve), sin alargar ni cortar las promesas.
- `ponerRapidez(n)`: solo para pruebas; multiplica la velocidad de todo (1 = tiempo real).
- `ponerCalidad(nivel, { auto })`, `calidad`, `pausada`, `atenuada`, `ocupada` (`{ dados, pelea, ronda, ifrit, viajes }`),
  `ronda`, `lienzo`.
- `destruir()`: suelta la tarjeta gráfica, los sonidos y los escuchas, y quita el lienzo. Las promesas que estuvieran
  pendientes en ese momento ya no se cumplen.
- Si el navegador pierde el contexto WebGL, la escena se recupera sola y avisa con `alRecuperarContexto`.

## Avisos

Se asignan como propiedades (o dentro de `opciones`): `alHacerClicCiudad(id)`, `alHacerClicFicha(id)`,
`alHacerClicVacio()`, `alApuntar({ tipo, id } | null)`, `alCambiarRonda(numero)`, `alCambiarCalidad(nivel)`,
`alMoverCamara()`, `alTocar(clave)`, `alCuadro()`, `alRecuperarContexto()`.

## Sonido

`activarSonido()` (llamarla tras el primer gesto del usuario), `silenciar(true | false)`, `silenciada`, `volumen(0..1)`, `tocar(clave)`.
Opciones de `crearEscena`: `volumen` (0 a 1) y `silencio` iniciales.

Los archivos están en `public/sonidos/` (créditos y licencias en `public/sonidos/CREDITOS.md`); se bajan una vez al activar el
sonido y suenan con Web Audio, todos por un volumen general. Cada momento tiene una ranura con nombre; la tabla completa, con el momento exacto
en que suena cada una, está en `banco/sonidos.js` (`SONIDOS`). Para enchufar un sonido se pone la URL en su ranura y se
pasa la tabla a `crearEscena`. Una ranura vacía suena con un provisional sintetizado, si lo tiene, o no suena. Familias:
dados, fichas, ronda y ambiente, pelea y arco, mar y dhow, monturas y alfombra, Ifrit.

## Límites conocidos

- Hecha para el tablero de 2970 × 2100 y los personajes 1 a 7 y B; otro id de personaje no tiene figura.
- Las figuras son relieves levantados desde las ilustraciones (frente, espalda y costado). De canto se ven más planas que
  una miniatura esculpida.
- Los rostros van siempre cubiertos o en sombra, también el del genio.
- Una sola pelea, un solo Ifrit y un solo cambio de ronda a la vez; pedir otro mientras tanto rechaza la promesa.
- `_interno` existe solo para pruebas y puede cambiar sin aviso.

## Herramientas

En `herramientas/`: `preparar-figuras.py` (figuras y bustos desde las hojas de personaje) y `preparar-relieve.mjs` (relieve
y montañas desde el mapa). Solo hacen falta si cambia el arte; cada una explica su uso en la cabecera.
