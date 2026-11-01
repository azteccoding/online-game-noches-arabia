# Mil y una Noches — juego web en red local: plan técnico y guía de continuación

Estado a 1 de noviembre de 2026. Este documento está pensado para que una persona o una sesión nueva de Claude pueda continuar el proyecto sin haber visto nada antes. Todo lo descrito como «hecho» está implementado en esta carpeta y verificado con las pruebas de la sección 15. La versión online es **completa y jugable de principio a fin** (reglas R 1–24 del reglamento extendido); en la sección 8.3 solo quedan mejoras futuras.

Carpeta del proyecto: `docsJuegoMesa/onlineGame/`. Copia de este plan: `AgentStores/.../files/docs/plan-juego-web.md`.

Índice: 1 Resumen · 2 Contexto del juego y reglamento · 3 Decisiones adoptadas · 4 Árbol de archivos · 5 Versiones y comandos · 6 Arquitectura · 7 Estado y protocolo · 8 Reglas implementadas, decisiones de interpretación y mejoras futuras · 9 Tablero vectorial, zoom y nitidez · 10 Cartas bajo demanda · 11 Dados · 12 Rendimiento y presupuestos de peso · 13 Servidor: tres escenarios, Raspberry Pi, systemd, red · 14 Privacidad · 15 Pruebas y criterios de aceptación · 16 Convenciones y cableado · 17 Hitos · 18 MVP y mejoras · 19 Riesgos · 20 Prompt de arranque · 21 Resultados de verificación.

---

## 1. Resumen

Un servidor Node muy ligero guarda el estado de la partida y lo reparte por WebSocket. Cada jugador abre una dirección en el navegador de su teléfono, tableta o PC (misma red Wi-Fi, sin internet). Todos ven el mismo tablero; **cada uno ve solo su propia mano, sus cartas privadas y sus objetos**: el servidor es la autoridad y filtra la vista por jugador. No hay cuentas ni base de datos: la partida se guarda en un JSON en disco.

Requisitos literales del encargo y dónde se cumplen:

| # | Requisito | Dónde / cómo |
|---|---|---|
| 1 | Varios dispositivos por navegador en LAN; tablero común; mano y objetos privados | `server/index.js` + `shared/engine.js` (`vista(data, e, pid)`); prueba `tests/servidor.test.mjs` |
| 2 | Cartas de evento/lectura en MODAL para todos, mínimo 5 s, barra DESCENDENTE; luego cada quien cierra o la deja; todos pueden consultar la ÚLTIMA | `ModalCarta.jsx` (`MIN_LECTURA_MS = 5000`), botón «Última carta» en `BarraEstado.jsx`, `Historial` en `Registro.jsx` |
| 3 | Personajes y estadísticas legibles por todos en un desplegable | `MenuPersonajes.jsx` + `HojaPersonaje.jsx` (8 hojas, stats, dinares/noches, herido/perdido/buscado) |
| 4 | El tablero NO se muestra entero; **vista HORIZONTAL por defecto en todas las pantallas** y vertical solo si el jugador la activa; arrastre/táctil; pellizco/rueda con límites; minimapa o «centrar en mi personaje» | `Tablero.jsx` + `usePanZoom.js`; botones + / − / centrar; selector Horizontal/Vertical (`SelectorVista.jsx`, `useLienzo.js`); `minimapa` |
| 5 | Peones pseudo-3D en SVG vectorial, sombra elíptica, animación de caminar, sin rostros identificables | `Peon3D.jsx`, `public/svg/personajes/*.svg`, `sprites.svg` (`tools/make_sprites.py`) |
| 6 | Dados rojos con puntos blancos que giran en el tablero; modal con el resultado; al cerrarlo uno, desaparecen para todos; el servidor decide | `Dados.jsx`; motor `tirarDados` / `cerrarDados`; barra inferior indica de quién es el turno |

Además: lobby con reconexión por token en `localStorage`, turnos y fases, viajes con tarifas, noches de llegada, hospedaje, mercado, tratos, compra/venta/robo de objetos, combate y duelos (R 11), robos (R 12), Asesinos (R 13), retos y misiones (R 14), tesoros y Jorasán (R 16), Yafar NPC y Yafar jugador (R 20), modo solitario (R 21), cartas CC con trivias y cuentos de ambiente, mensajes de sheijs, eventos y eventos históricos, muerte y eliminación, meta única de 1.001 noches con pantalla final, guardado y restauración automáticos, registro de eventos, banco/anfitrión con panel para corregir errores, «Acerca de» y accesibilidad básica.

---

## 2. Contexto del juego y referencias al reglamento

«Mil y una Noches» (Las Noches de Arabia) es un juego de mesa de caravanas por el mundo islámico medieval: los jugadores son personajes de los cuentos (Nur al-Din, Zein al-Mawasif, Anís, Jamil al-Udhrí, el sabio Ruyán, Zubayda, Adí hijo de Hatim al-Taí y el vizir Yafar como octavo personaje o NPC) que viajan entre ciudades, comercian, resuelven cuentos y acumulan **noches**. Gana quien alcanza **1.001 noches** (noches + dinares + escondido, comprobado al final de la ronda).

La fuente de las reglas es el **reglamento extendido** (`documentos/` y `pdf/`; el original editable está en la tienda del agente: `docs/mil-y-una-noches-reglamento-extendido.docx`). **No se cambia ninguna regla desde el código**: si algo del código contradice el reglamento, gana el reglamento.

Secciones del reglamento que usa el motor (cita en comentarios como «R 7.3»):

| § | Tema | Estado en el motor |
|---|---|---|
| 2 | Objetivo (1.001 noches; 2.4: varios a la vez ganan juntos, contra Yafar NPC gana quien tenga más noches) | hecho |
| 4 | Preparación | hecho (dinares iniciales, reparto) |
| 5 | Tablero | hecho (ciudades, rutas, tarifas, Jorasán y su camino) |
| 6 | Turno y rondas (6.5 multiplicador por ronda) | hecho |
| 7 | Movimiento y caravanas | hecho (2 tramos máx., tarifa directa, «primer viaje») |
| 8 | Economía (8.5 mercado, 8.6 tratos) | hecho |
| 9 | Cartas y mazos (9.4 reshuffle) | hecho |
| 10 | Personajes | hecho (habilidades de los 8 personajes en `shared/personajes.js`; ver 8.2) |
| 11 | Combate | hecho (`shared/pelea.js`) |
| 12 | Robos | hecho (`shared/pelea.js`, `shared/objetos.js`) |
| 13 | Asesinos | hecho (contratos, subasta E1, NPC; `shared/npc.js`) |
| 14 | Retos y misiones | hecho (`shared/retos.js`, datos en `retos.json`) |
| 15 | Objetos (15.2 efectos) | hecho (los 45 objetos con efecto automático; `shared/objetos.js`) |
| 16 | Tesoros / Jorasán | hecho (`shared/tesoros.js`) |
| 17 | Eventos y eventos históricos | hecho (todas las cartas con efecto automático; `shared/eventos.js`) |
| 18 | Mensajes | hecho (dado de ingreso, 1 por ronda, un solo Mensaje activo por jugador, los 16 sin repetirse ni reciclarse, plazo, premio) |
| 19 | Cartas de Cuentos (CC) y Respuestas (CRP) | hecho (trivias +10 dinares; «de mesa» las resuelve el jugador en turno o el banco) |
| 20 | Yafar NPC y Yafar jugador | hecho (`shared/npc.js`) |
| 21 | Solitario | hecho (Yafar NPC + Asesinos NPC, dificultad configurable) |
| 22 | Jugadores y banco | hecho (rol de banco en servidor) |
| 24 | Reglas de la casa | ver sección 3 |
| 27 / 28 / 29 | Referencia rápida / glosario / créditos | créditos solo en «Acerca de» |

Restricciones globales que se mantienen: idioma español; estilo Hazm + Arabi (pergamino, índigo, oro, turquesa); respeto absoluto por los temas religiosos; **sin marcas de agua ni créditos en las pantallas de juego** salvo «Acerca de» («Diseño y redacción: Jorge Montes Carrillo. Publicado por la Biblioteca Ibn Hazm de México / gracias a Mullah Khalid Montes.»).

---

## 3. Decisiones adoptadas

Las decisiones que estaban abiertas se cierran así (todas oficiales). Las marcadas «web» son técnicas; las de reglas se alinean con el reglamento extendido y viven en `src/data/config.json` y `shared/engine.js`.

### 3.1 Técnicas (web)

1. **Un dispositivo por jugador.** Sin cuentas; identidad por token aleatorio en `localStorage` (`mun.token`, `mun.nombre`). Si el navegador se borra, el banco puede devolver el sitio con «Ceder el banco» y editar; un desconocido no entra a media partida (mensaje de rechazo).
2. **Servidor autoritativo.** El cliente nunca calcula resultados: envía `accion` y recibe una `vista` filtrada. Los dados, el barajado y el reparto son del servidor (PRNG mulberry32 con semilla guardada en el estado → partidas reproducibles y restaurables).
3. **Motor compartido** (`shared/engine.js`): código puro, sin DOM ni APIs de Node, con los datos inyectados. Lo usan el servidor y el adaptador de demostración del navegador. Una sola implementación de reglas.
4. **Sin dependencias nativas ni base de datos.** Solo `ws` y `qrcode-terminal` (JavaScript puro). Persistencia en JSON atómico (archivo temporal + rename), copias rotativas `.bak1..3`.
5. **El servidor no depende del banco.** «Banco/anfitrión» es un rol guardado en el estado, no una conexión: si ese dispositivo se apaga, la partida sigue; si no hay banco conectado, cualquiera puede tirar los dados de los NPC. Se recupera con el PIN que imprime la consola.
6. **Solo vector en el tablero.** SVG generado desde Natural Earth con texto convertido a trazos y texturas procedimentales; **cero** teselas raster (ver 9). Peones, dados, iconos y marcadores también SVG.
7. **Cartas bajo demanda.** No se cargan las 195+ cartas: se construyen en el cliente con un componente `Carta` a partir de DATOS; solo hay una carta completa montada a la vez; al cerrar se destruye y queda su dato (ver 10).
8. **Trivias fuera del bundle de juego.** `trivias.json`, `mensajes.json` y `eventos.json` solo viven en el servidor y en el adaptador demo (`VITE_DEMO=1`). La respuesta de una trivia viaja únicamente cuando el jugador contesta (`historial[].resuelto`).
9. **Sin PWA ni HTTPS.** HTTP + `ws://` en LAN. No hay service worker; el navegador cachea `assets/` con hash (`immutable`).
10. **Fuentes locales** en WOFF2 (194 KB en total): Marcellus SC, Alegreya (normal e itálica) y Aref Ruqaa; ningún CDN, ninguna llamada externa (verificado: 0 peticiones externas).
11. **Cierre automático de dados olvidados** a los 20 s (`tick`) para no bloquear la mesa; cierre manual no antes de 1,9 s para que acabe la animación.
12. **Vista HORIZONTAL por defecto en todos los tamaños de pantalla** (teléfono, tablet y PC), sin importar la orientación del dispositivo ni su ancho. No se decide con media queries ni con `orientation`: la preferencia es por jugador, se guarda en `localStorage` (`mun.vista`, valor por defecto `'horizontal'`) y el selector visible «Horizontal / Vertical» la cambia al instante. En un teléfono (o ventana) en posición vertical con modo horizontal, el lienzo del juego se gira 90° con CSS para aprovechar el ancho; ver 9.6.
13. **Un solo modo de victoria**: 1.001 noches al final de la ronda; si varios llegan, ganan todos los que la alcanzan. La eliminación por muerte saca al jugador de turnos pero no termina la partida.
14. **Cuentos de ambiente**: ver 3.3.

### 3.2 Reglas de la casa adoptadas como oficiales

Jorge adoptó como **oficiales** todas las «reglas de la casa sugeridas» del reglamento extendido y todas las propuestas de «Pendientes / decisiones abiertas» (incluidas las del plan web), y, en los dos casos que contradecían una regla oficial, adoptó la versión que **más beneficia a los jugadores** y autorizó expresamente que **reemplace** la regla anterior (bonos de arma para ambos bandos y defensor que mata sin quedar Buscado). El reglamento extendido (24.4, «Reglas de la casa adoptadas») y el documento de diseño (sección 22, «Decisiones adoptadas y pendientes») ya están actualizados.

| Regla de la casa (reglamento) | Qué hace el servidor | Dónde vive |
|---|---|---|
| Primer viaje a una ciudad sin caravana (7.2) | Paga la tarifa de la tabla desde el origen y la caravana queda creada al llegar | `viajar` en `engine.js` |
| Pago imposible (8.3) | Dinares, luego noches (5 por dinar); el resto se cancela. Las deudas de R1, R2 y R3 siguen vigentes (se modelarán con los retos, 8.2) | `terminarTurno` |
| Impuesto de venta (8.4) | Lo paga el vendedor, 20 % redondeado hacia abajo, al banco (venta al mercado hecha; entre jugadores, con los tratos) | `config.impuestoVentaPct`, `venderObjeto` |
| Tratos (8.6) | Un trato entregado en el momento es definitivo; las promesas futuras no tienen respaldo en el motor | sin estado: no hay «deudas» |
| Información de la mano (9.3) | `vista()` envía el contenido de la mano solo a su dueño y `nMano` (cuántas) a los demás | `vista` en `engine.js` |
| Mazos agotados (9.4) | **Hecho:** `robar()` baraja los descartes de los mazos que los tienen (eventos, históricos, CC); **los Mensajes son la excepción**: no se reciclan y, agotados los 16, un 6 no tiene efecto (ver «Mensajes de sheijs» abajo); los objetos vendidos o devueltos vuelven a su pila (`stock`). Mazo de Ifrit (sin descartes) y Botín: hechos con R 16 | `robar`, `prepararMazos`, `stock` |
| Qué se roba (12.1) | Dinares, objetos, mapas y cartas poseídas; no noches ni Mensajes | hecho (R 12, `shared/pelea.js`) |
| Dado de la víctima (13.3) | La víctima tira un dado al firmar el contrato de Asesinos; ese resultado fija los 30 dinares por punto | hecho (R 13, `shared/npc.js`) |
| Entrega de retos (14.1) y lista de retos | Entregar no gasta otra acción principal; `retosHechos[]` por jugador | `retosHechos` ya en el estado |
| Reparto del botín de un tesoro (16.2) | Por acuerdo antes de tirar; si no, partes iguales (redondeo hacia abajo, el resto vuelve al banco) | hecho (R 16, `shared/tesoros.js`) |
| E4 «ciudad que nadie había visitado» (23.1) | La ciudad no está en `visitadas` de **ningún** jugador (Bagdad ya cuenta como visitada). Cambio de esta versión: antes comparaba solo con las visitas del propio jugador | `llegada()` (`nadieAntes`) |
| Cartas de cuento de ambiente (19.7) | Ver 3.3. Yafar NPC no lee ni cobra; una persona que juega a Yafar sí cobra los 2 dinares | `sacarCuento()` |
| Bonos de arma para ambos bandos (11.1) | **Reemplaza** la definición anterior (solo defensa): atacante y defensor suman los bonos de sus armas (arco +1, alfanje +1, cimitarra +2, jambiya +3 con dado de sorpresa par, tirado por quien la lleva) en cualquier pelea o duelo, R8, R36, E8 y Patrulla | `config.reglasCasa.bonosArmaAmbosBandos = true`; se aplica en `shared/pelea.js` |
| Defensor que mata (11.5 y 12.2) | **Reemplaza** «quien mata queda Buscado» solo para el defensor: se queda con el botín del agresor y **no** queda Buscado; el atacante que inicia el ataque letal y gana sigue quedando Buscado 2 rondas | `config.reglasCasa.defensorQueMataSinBuscado = true`; se aplica en `shared/pelea.js` |
| Mensajes de sheijs (9.4 y 18.2) | **Un solo Mensaje activo** por jugador (con un Mensaje en curso, un 6 no roba otro); cada uno de los 16 sale **una sola vez por partida**: cumplido, vencido o de un eliminado, sale del juego y no vuelve al mazo; agotados, ya no salen más y un 6 no tiene efecto | `robar()` (sin reciclar `mensajes`), `despuesIngreso`, `cumplirMensaje`, `host.repartir`, `host.eliminar`; `config.reglasCasa.mensajesUnoActivo` y `mensajesSinRepetir` |

**Reglas que reemplazan una regla anterior, con autorización expresa de Jorge (oficiales):** *bonos de arma para ambos bandos* (11.1) y *defensor que mata sin quedar Buscado* (12.2). El motor las aplica directamente en el combate; quedan registradas como `true` en `config.json` (`reglasCasa.bonosArmaAmbosBandos` y `reglasCasa.defensorQueMataSinBuscado`) para que el código y las pruebas las citen. Cimitarra: decisión de Jorge — el +2 propio al atacar (Categoría F) se conserva además del bono de arma general (doble conteo intencionado, configurable; ver 8.2).

**Mensajes de sheijs (decisión de Jorge, ya aplicada en el motor):** el motor guarda un solo Mensaje por jugador (`j.mensaje`) y no existen Mensajes simultáneos. La nota anterior de alineación con el reglamento queda resuelta. El resto de decisiones de diseño adoptadas (número de jugadores 1 a 8, dados 2 mínimo y 4 ideal, Mensajes un jugador por ronda, premios CC de 10 y 0 sin tasa de ignorancia ni fama, «De mesa» con confirmación del aludido y voto, último en pie, tablero de 56 × 39 cm) coinciden con `config.json` y con el motor.


### 3.3 Cartas de cuentos de ambiente

Jorge aprobó las **7 cartas de cuento de ambiente** con premio oficial: **quien las lea en voz alta recibe 2 dinares del banco** (reglamento 19.7, diseño 24.9). Son cartas **aparte** de las 80 CC y las 80 CRP.

| Pieza | Qué es |
|---|---|
| `src/data/cuentos.json` | Las 7 cartas (`CU-B`, `CU-I`, `CU-A`, `CU-D`, `CU-S`, `CU-C` y `CU-R` de Respuestas) con `clave` (ciudad o `Respuestas`), título, subtítulo, texto, `premio: 2` y `refReglamento: '19.7'`. Lo genera `tools/extract_data.py`; solo existe en el servidor y en el adaptador demo |
| `config.json → premioCuento` | `2` |
| `engine.js → sacarCuento(data, e, pid, clave)` | Publica la carta (`deck: 'cuento'`, pública, a nombre de `pid`) y acredita el premio; registra la clave en `e.cuentosSacados` (se guarda con el estado, así no se repite tras reiniciar) |
| `Carta.jsx`, `iconos.jsx`, `cards.css` | `deck: 'cuento'`: icono de libro abierto, etiqueta CUENTO, dorso de CC, papel crema con acento índigo y la línea «Quien la lea en voz alta recibe 2 dinares» |

**Cuándo se sacan** (una sola vez por partida cada una):

1. **Cartas de ciudad:** en `robarCC()`, al tomar la **primera CC de ese mazo**. Las ciudades sin mazo propio toman del mazo de Bagdad, así que su primera CC saca la carta de Bagdad. La carta de cuento se publica **antes** que la CC: el modal las muestra en cola (cuento, luego CC) y el chip «2 por leer» lo indica.
2. **Carta de Respuestas:** en `responderCC()`, al **resolverse la primera trivia** de la partida, después de publicar su resultado.

**Quién la lee y cobra:** quien la saca (el jugador en turno que toma la CC o responde la trivia); el servidor suma `premio` a sus dinares. La ve **toda la mesa** con el modal de lectura de 5 s: barra descendente, «Cerrar» desactivado hasta que acaba, y después cada persona la cierra o la consulta en «Última carta» (modo consulta, sin temporizador).

**Exclusiones** (en `sacarCuento`): no cobra ni lee un jugador **eliminado** (tampoco como Ayudante de mesa; la carta queda para otro jugador) ni un **NPC** (Yafar NPC no es un jugador del motor: lo mueve el banco con dados de NPC, así que nunca la saca). En **solitario** el jugador lee y cobra igual.

**Choques revisados con reglas oficiales:** ninguno. La regla de una CC por ciudad visitada, el máximo de 3 CC por turno, la lectura de las CC por otro jugador (aquí lee quien la saca porque no hay respuesta que ocultar) y la custodia de las CRP siguen igual; la carta de Respuestas no es una CRP. Decisión de Jorge confirmada: **Yafar NPC** no lee ni cobra; una persona que juega a Yafar el Bermekí cobra los 2 dinares como cualquier jugador (probado en `tests/cuentos.test.mjs`).

**Pruebas:** `tests/cuentos.test.mjs` (sale con la primera CC, +2 dinares, se lee antes que la CC, es pública, una sola vez, Respuestas con la primera trivia, eliminado/NPC no cobran, Yafar jugador sí cobra, solitario, sin repetir tras `restaurar`), `tests/navegador/09_cuento_modal.py` (modal con barra de 5 s, «Cerrar» desactivado y luego activo, dinares +2) y `04_galeria_desbordes.py` (7 cuentos × 2 anchos, 0 desbordes). Captura: `docs/capturas/13-cuento-modal.jpg`.


---

## 4. Árbol de archivos

Todo bajo `onlineGame/`. **No** se entrega `node_modules/`, `dist/`, `package-lock.json`, `datos/` ni `paquete-servidor/` (están en `.gitignore`).

```
onlineGame/
├─ README.md                       guía de uso (jugar, publicar en internet, guardado, pruebas)
├─ plan-juego-web.md               este documento
├─ package.json                    scripts y versiones exactas
├─ vite.config.js                  react plugin + proxy /ws -> :8080 (solo desarrollo)
├─ index.html                      shell; precarga el SVG del tablero
├─ .env.demo / .env.development    VITE_DEMO=1 (adaptador local con bots)
├─ .gitignore
├─ server/
│  ├─ index.js                     HTTP estático (gzip, ETag, SPA) + WebSocket + guardado + IP/QR            [hecho]
│  └─ datos.js                     carga src/data/*.json sin dependencias                                    [hecho]
├─ shared/
│  ├─ engine.js                    motor autoritativo: nuevoJuego, unir, reducir, vista, tick, serializar, migrar [hecho]
│  ├─ base.js                      utilidades, dados, decisiones pendientes (pedir/responderPend), manos, eliminar, tarifas
│  ├─ pelea.js                     combate, duelos, robos, categorías de pelea, rechazos (R 11, 12)
│  ├─ objetos.js                   tienda, venta, usar objetos, transporte, veneno/antídoto, Ifrit (R 15)
│  ├─ retos.js                     retos y misiones (R 14)        tesoros.js  tesoros y Jorasán (R 16)
│  ├─ eventos.js                   eventos y eventos históricos   personajes.js  habilidades de los 8 personajes
│  └─ npc.js                       Yafar NPC, solitario, Asesinos y subasta E1 (R 13, 20, 21)
├─ src/
│  ├─ main.jsx, App.jsx            enrutado de pantallas (Entrada → Lobby → mesa) y paneles                  [hecho]
│  ├─ game/
│  │  ├─ store.js                  almacén mínimo (useSyncExternalStore)                                     [hecho]
│  │  ├─ protocol.js               fábricas de acciones (ACCIONES.*) y documentación del protocolo           [hecho]
│  │  ├─ schema.js                 tipos de la vista (JSDoc) y helpers                                       [hecho]
│  │  ├─ data.js                   datos públicos del cliente (sin trivias/mensajes/eventos)                 [hecho]
│  │  └─ adapters/ index.js, wsAdapter.js (red), localAdapter.js (demo con 3 bots)                           [hecho]
│  ├─ hooks/ usePanZoom.js         pan/zoom sin re-render de React (con rotación del lienzo); useLienzo.js (vista horizontal/vertical); useArte.js [hecho]
│  ├─ components/
│  │  Tablero, Peon3D, Sprite, iconos, Dados, Carta, ModalCarta, Mano, MenuPersonajes, HojaPersonaje,
│  │  HojaCiudad, Intercambio (Mercado/Tratos), Registro, PanelAcciones, AccionesTurno, Decision, Misiones,
│  │  BarraEstado, SelectorVista, PanelAnfitrion, Entrada, Lobby, Fin, AcercaDe,
│  │  Galeria (solo pruebas, solo build demo)                                                                 [hecho]
│  ├─ styles/ theme.css, base.css, board.css, cards.css, ui.css                                               [hecho]
│  └─ data/ ciudades, rutas, personajes, objetos, eventos, mensajes, retos, trivias, cuentos, config, arte-claves, tablero (.json)  [hecho; generados]
├─ public/                         se copia tal cual a dist/
│  ├─ svg/ tablero-mapa.svg (178 KB), tablero-mini.svg, sprites.svg, personajes/, dados/, iconos/
│  ├─ arte/*.webp                  23 ilustraciones de categoría (≈8 KB c/u, 184 KB en total)
│  ├─ cartas/dorsos/*.webp         10 dorsos de 360 px (140 KB)
│  └─ fonts/*.woff2                4 fuentes
├─ fallback/cartas-completas/      PNG completos de las cartas, OPCIONAL, NO entra al build (ver 10.6)
├─ tools/                          generadores (solo desarrollo; no se instalan)
│  ├─ build_board_svg.py, mapgeo.py, textpath.py, geo/ (Natural Earth 50m), fuentes/ (TTF origen)
│  ├─ extract_data.py              regenera src/data/*.json desde las fuentes de diseño
│  ├─ make_sprites.py, make_sprite_sheet.py, optimize_assets.py, fuentes_woff2.py
│  └─ empaquetar.mjs               crea paquete-servidor/ (dist + servidor) para copiar a una Raspberry Pi
├─ tests/
│  ├─ engine.test.mjs              motor sin navegador
│  ├─ cuentos.test.mjs             cuentos de ambiente (19.7): cuándo salen, +2 dinares, exclusiones, Yafar jugador vs NPC
│  ├─ mensajes.test.mjs            Mensajes (18.2): uno activo por jugador, ninguno se repite, mazo agotado sin fallos
│  ├─ servidor.test.mjs            servidor real: privacidad, persistencia, banco ausente
│  ├─ sim.mjs, simulacion-ws.mjs   partidas completas aleatorias (motor) y por WebSocket (servidor real)
│  └─ navegador/*.py               9 guiones Playwright (Chrome headless): ver 15
├─ ejemplos/muestra-juego.html     muestra de un solo archivo (horizontal por defecto)
└─ docs/capturas/*.jpg             14 capturas (PC, tablet y teléfono; horizontal y vertical)
```

**Mejoras futuras** (no necesarias para jugar): ver 8.3.

---

## 5. Versiones y comandos exactos

Entorno de desarrollo y verificación: macOS (darwin 25), Node **18.20.8**, npm **10.8.2**, Chrome estable con Playwright para Python.

Dependencias (versiones exactas, sin `^`):

| Paquete | Versión | Uso |
|---|---|---|
| react, react-dom | 18.3.1 | cliente |
| ws | 8.22.1 | WebSocket (JS puro) |
| qrcode-terminal | 0.12.0 | QR en consola |
| vite (dev) | 5.4.21 | build |
| @vitejs/plugin-react (dev) | 4.7.0 | JSX |

Herramientas Python (solo para regenerar activos, no para jugar): `fonttools 4.60`, `uharfbuzz`, `Pillow`, `brotli`, y `playwright` (Python) para las pruebas de navegador.

```bash
# Jugar (una vez):
npm install
npm run build            # cliente de juego (SIN demo ni trivias) -> dist/
npm start                # servidor: imprime IP(s), PIN de banco y QR

# Opciones del servidor
npm start -- --puerto 8080 --datos ./datos --nuevo            # partida nueva (guarda la anterior como partida-anterior-<ts>.json)
npm start -- --restaurar ./copia.json                          # restaurar una copia
npm start -- --sin-qr                                          # sin QR (servicios)
npm start -- --rapido                                          # sin animaciones de dados (pruebas)

# Desarrollo y demostración
npm run dev              # cliente con adaptador local y bots: http://localhost:5173/?demo=1
npm run build:demo       # build con demo incluida (NO usar para jugar)
npm test                 # engine + cuentos + mensajes + sim.mjs 48 + servidor (requiere npm run build previo para la parte HTTP/SPA)
npm run simular          # partidas completas por WebSocket (4 jugadores, solitario, 8, 3 + NPC)
npm run empaquetar       # crea paquete-servidor/ (tras npm run build)

# Regenerar activos (opcional)
python3 tools/extract_data.py
python3 tools/build_board_svg.py
python3 tools/optimize_assets.py --sin-fallback
python3 tools/fuentes_woff2.py
```

Parámetros de URL de la demostración (solo build demo): `?demo=1` (partida), `?demo=lobby`, `&bots=0`, `&pj=4`, `&minLectura=50` (ms), `&semilla=N`, `?galeria=evento|historico|mensaje|objeto|trivia|mesa|personaje`.

---

## 6. Arquitectura

```
 navegador A ┐                                   ┌──────────────── servidor Node (server/index.js)
 navegador B ├─ ws://host/ws  {hola|accion|ping} │  estado completo en memoria (shared/engine.js)
 navegador C ┘  ◄── {estado: vista filtrada}     │  reducir(data, e, pid, accion) → valida y aplica
                                                 │  vista(data, e, pid) → lo que ese jugador puede ver
 http://host/  ◄── dist/ estático (gzip, ETag)   │  guardado atómico partida.json (+ .bak1..3) cada 400 ms tras cambios
                                                 └─ tick() cada 1 s: cierra dados olvidados
```

- **Cliente**: React 18 + un almacén mínimo (`useJuego(selector)`). Los componentes no calculan reglas; leen la vista y llaman `enviar(ACCIONES.xxx())`. El **adaptador** se elige en `adapters/index.js`: `wsAdapter` (juego real) o `localAdapter` (demo; solo existe en builds con `VITE_DEMO=1`, así el bundle de juego no contiene trivias ni el motor completo).
- **Difusión**: tras cada acción el servidor agrupa cambios 25 ms y envía a cada cliente SU vista (`{t:'estado', s}`; también `urls` con las direcciones LAN para el lobby).
- **Reconexión**: `wsAdapter` reintenta con retroceso exponencial (≤5 s) y envía `hola` con el token; el servidor devuelve al mismo jugador. La interfaz muestra «Reconectando…».
- **Reloj**: el servidor manda `ahora`; los dados se animan con `ahora - dados.t0` para que quien llega tarde vea el final y no repita la animación.
- **Límites de abuso**: 40 mensajes/s por conexión, 64 KB por mensaje, latido ping/pong cada 25 s.

---

## 7. Estado y protocolo

### 7.1 Mensajes

| Dirección | Mensaje | Campos |
|---|---|---|
| C→S | `hola` | `token?`, `nombre?` — crea jugador (solo en lobby, máx. 8) o reconoce al del token |
| C→S | `accion` | `a: {t, ...}`, `n` — la valida el motor; si falla: `error` |
| C→S | `ping` | — |
| S→C | `bienvenida` | `token`, `pid`, `codigo` |
| S→C | `estado` | `s` (vista del jugador) |
| S→C | `error` | `msg`, `n` |
| S→C | `rechazo` | `msg` (partida empezada o sala llena) |
| S→C | `pong` | — |

### 7.2 Acciones (`ACCIONES.*` en `src/game/protocol.js`)

Lobby: `elegirPj{pj}`, `listo{v}`, `opciones{dificultad}`, `iniciar`, `reclamarAnfitrion{pin}`. Turno: `tirarDados`, `cerrarDados`, `viajar{destino}`, `terminarTurno`, `responderCC{opcion}`, `omitirCC`, `resolverMesa{ok}`. Decisiones: `decidir{id, opcion|valores|numero}` (cualquier decisión pendiente `pend`: defensa, ayuda, números, subasta, veneno…). Combate: `atacar{tipo, objetivo, pedirDinares?, pedirNoches?}`, `asesinos`. Economía: `comprar{id|ref, n}`, `vender{uid}`, `usar{uid, objetivo|destino|deseo|mision|via}`, `proponerTrato{con,ofrece,pide}`, `responderTrato{id,ok}`, `cancelarTrato{id}`, `ofrecer5{a}`. Retos y personajes: `reto{id, sub}`, `tesoro{sub, uid, via}`, `esconder{monto}`, `recuperar`, `pj{sub, con, precio}`. Banco: `host.dar`, `host.corregir`, `host.repartir`, `host.barajar`, `host.tirarNPC`, `host.pasarTurno`, `host.revelarCarta`, `host.ceder`, `host.eliminar`. Los Mensajes de sheijs se cumplen solos (sin acción manual).

Decisiones pendientes: el motor guarda `e.pend` (y cola `e.colaPend`) con `para:[pid]`, opciones y una continuación serializable (`CONT`/`registrar`); la vista solo muestra las opciones al destinatario (`privado`), y si nadie contesta a tiempo el servidor aplica la opción por defecto (`vencerPend`).

### 7.3 Estado del servidor (completo, nunca sale tal cual)

```
{ v, codigo, semilla, ahora, creado, fase: 'lobby'|'juego'|'fin', ronda, host, pinHost,
  jugadores: { jN: { id, nombre, token, pj, listo, conectado, dinares, noches, ciudad, ciudadPrevia, visitadas,
                     mano: [{uid, tipo, ref}], herido, perdido, buscado, eliminado, escondido, mensaje, retosHechos, extra } },
  orden: [pid], turno: { pid, idx, fase: 'ingreso'|'mov'|'accion', tramos, ciudadInicio, movio, llegadas, cc, ccActual, ... },
  dados: { id, n, valores, por, motivo, t0, npc } | null,
  mazos: { eventos, historicos, mensajes, cc: {ciudad: [...]}, descarte }, stock: { idObjeto: copias },
  historial: [carta…], ultimaCarta, log: [{t, texto, pid}], tratos, caravanas, ganadores, evento, seq }
```

### 7.4 Vista que recibe cada cliente (`schema.js`)

Igual que el estado pero **sin** `token`, `semilla`, `mazos`; con `jugadores[id]` reducido a datos públicos (`nMano` = conteo por tipo, `tieneMensaje`; `escondido` solo el propio); `mano` solo la propia (con `datos` para dibujar la carta); `historial` filtrado (`para` = destinatarios de cartas privadas; la respuesta de una trivia solo aparece en `resuelto`); `tratos` solo los propios; `host_info` (PIN, stock y tamaño de mazos) solo para el banco; `urls` las añade el servidor.

### 7.5 Carta en el historial (dato, no imagen)

`{ nro, id, deck, titulo, sub?, texto, premio?, plazo?, valor?, opciones?, arte (clave de categoría), ref, quien, t, ronda, para?, resuelto? }` — esto es lo único que se conserva de una carta tras cerrarla.

---

## 8. Reglas implementadas, decisiones de interpretación y mejoras futuras

### 8.1 Implementado (todo en `shared/`, probado con partidas completas)

Lobby y arranque (2–8 jugadores; Adí último; Ruyán no último; con ≥4 jugadores alguien lleva a Yafar; con 1 jugador, modo solitario); ingreso y dado de ingreso (Mensajes de sheijs: uno a la vez, nunca repetidos); viajes (tarifas, 2 tramos, transporte propio, «primer viaje»); noches de llegada con multiplicador por ronda; CC por ciudad con trivias, cuentos de ambiente y cartas de mesa; hospedaje; mercado con stock, impuesto del 20 %, compra/venta/reventa de los objetos del mazo y originales; tratos y trueque; **combate, duelos, rechazo y robos (R 11–12)** con las categorías de pelea, ayuda de otros jugadores, esclavos, bonos de arma para ambos bandos, objetos de combate; **Asesinos (R 13)** con contratos secretos, subasta de la carta E1 y NPC; **retos y misiones (R 14)** con los 39 retos; **tesoros y Jorasán (R 16)**, genios e Ifrit; **Yafar NPC y Yafar jugador (R 20)** y **solitario (R 21)** con dificultad; habilidades de los 8 personajes; efectos automáticos de los objetos del mazo (incluidos veneno, antídoto y velo de viajero); eventos y eventos históricos con efecto automático; muerte y eliminación (botín, Buscado); victoria única a 1.001 noches con pantalla final; panel del banco (dar/corregir, repartir/barajar, tirar por NPC, pasar turno, eliminar, ceder); guardado, restauración y migración de estado; reconexión.

### 8.2 Decisiones de interpretación (el reglamento es ambiguo o silencioso)

**Criterio general fijado por Jorge: ante cualquier contradicción o ambigüedad se aplica la regla que MÁS beneficia al jugador, sin preguntar, y se anota aquí.**

Decisiones tomadas por criterio pro-jugador:

| Tema | Decisión |
|---|---|
| Cimitarra | Conserva su +2 propio al atacar **además** del +2 de arma de la regla general (+4 al atacar, +2 al defender). Configurable: `config.reglasCasa.cimitarraExtraAlAtacar` y `config.armas.cimitarra.extraAtacante`. El reglamento y el documento de diseño ya lo dicen (agresores +2 por cimitarra; queda «conservado» junto al bono de arma), sin cambios en Word |
| Victoria simultánea | Todos los jugadores que llegan a 1.001 al cierre de la misma ronda ganan juntos (R 2.4); si Yafar NPC también llega, ganan los jugadores salvo que el NPC tenga estrictamente más noches; en empate ganan los jugadores |
| Asesinos con ≤ 2 vivos / E1 con ≤ 2 vivos | Los Asesinos no actúan |
| Velo de viajero (OB44) | Si E1 te elige como víctima probable, lo gastas y se vuelve a elegir (una vez) |
| Veneno | Quien lo recibe puede pagar todas sus noches a Ruyán (al jugador Ruyán, o al banco si no juega) y vivir; el Antídoto lo cancela automáticamente; la decisión por defecto al agotarse el tiempo es pagar (no morir). Usar veneno no gasta la acción principal. Banquete envenenado con el favor de Yafar: no modelado (ver 8.3) |
| Recuperar el sitio | Con el mismo nombre se recupera el sitio a media partida si el dispositivo anterior está desconectado (token perdido) |
| Zein | El banco paga a Zein 25 dinares por servicio (10 con Anís); Anís cobra 10 (+20 si no es sorprendido); el compañero no paga; Ruyán una vez por partida; Adí nunca |
| Tiempo agotado en una decisión | Cada decisión pendiente lleva una opción por defecto que aplica el servidor al vencer el plazo; se eligió la que menos perjudica a quien decide (p. ej. pagar en vez de morir) |
| Mensaje de sheij | Un jugador por ronda como máximo y uno activo a la vez (reglas de la casa) |
| Ruyán | Compra y vende noches al llegar a una ciudad (50 noches por 5 dinares; no en Bagdad; una vez por ciudad y turno) |

Decisiones técnicas de reglas (sin conflicto con el jugador):

- **Asesinos:** el contratante es secreto (el registro no dice quién; `eliminar` con `secreto`). Subasta E1: el ganador paga su puja (mínimo 20 × vivos) + 30 × dado de la víctima; el primer contratante recibe +200 noches de bonificación; el asesino conserva las noches de la víctima. Precio del contrato con Zubayda: 50 % con deuda hasta 2 turnos (si no paga, eliminado). Contratar exige pago inmediato salvo con Zubayda.
- **Prostitución (Zein, Zubayda, Adí):** se propone y el cliente acepta (precio en dinares; Zubayda cobra ≥ 50 noches). Guardias de Bagdad: soborno 5 × dado a ambas partes (Jamil +5 por cada crimen que recite). Yemen: impuesto del 10 %. Apedreo: par se salva, impar paga 30 o queda herido. Un amante no-Anís sorprendido pelea a muerte con el esposo (aunque gane, cobra).
- **Jamil difamar:** −10 × vivos noches y sin tratos 2 rondas, solo contra quien tenga marca `vergonzoso` reciente.
- **Yafar NPC:** no roba una CC física (dado 4–6 ⇒ +10); en compras de arco compra también flechas; dificultad = bolsa inicial 0/5/10.
- **Pelea:** la Categoría F (varios jugadores contra uno) no se juega como una tirada conjunta: cada agresor ataca por separado en su turno y otro jugador puede pelear en nombre del indefenso (ayuda); el +2 de la cimitarra al atacar se aplica en cada ataque.
- **Banco:** no puede `corregir` el estado «eliminado» (usa `host.eliminar`).
- **Duración:** por los multiplicadores, las partidas terminan en ~10–20 rondas.

### 8.3 Mejoras futuras (nada de esto bloquea jugar)

| Mejora | Notas |
|---|---|
| Banquete envenenado con el favor de Yafar y venta de CRP por Ruyán | modelar como favores del Yafar jugador; hoy el veneno entra por Anciana Devota o abrevadero |
| Ruyán NPC (si nadie lo juega) moviéndose por el mapa | hoy solo existe como lugar de pago |
| Sonido opcional (apagado por defecto) y animaciones de cartas | |
| Prueba en dispositivos reales y ajuste fino a 60 fps en móviles de gama baja | |
| PWA instalable (HTTPS local), historial exportable, temas de color, modo alto contraste | |
| «Deshacer» para el banco | |
| Más pruebas de navegador del flujo completo (peleas, Asesinos, retos) por interfaz | hoy se cubren por motor y por WebSocket |

Cada regla nueva: (1) acción en `protocol.js`, (2) validación en `reducir`/módulo de `shared/`, (3) exponer en `vista` solo lo público, (4) prueba en `tests/engine.test.mjs`, (5) UI con el patrón de panel (`desplegable`/`hoja-modal`) o `Decision.jsx` para decisiones.

---

## 9. Tablero vectorial, zoom y nitidez

### 9.1 Regla de oro

El tablero nunca debe verse borroso a ningún zoom permitido, tampoco en teléfonos de alta densidad. Por eso:

1. **SVG 100 % vectorial** (`public/svg/tablero-mapa.svg`, 178 KB, 53 KB gzip): costas y ríos de **Natural Earth 50m** (`tools/geo/`), suavizados y con «temblor» horneado (`wob`), cuantizados a 0,1 unidades; desiertos y montañas dibujados; **texto convertido a trazos** con `tools/textpath.py` (HarfBuzz + fontTools; glifos compartidos con `<use>`), de modo que no depende de fuentes del navegador ni se pixela; texturas con `<pattern>` procedimentales; **sin filtros SVG** (que se rasterizan) y sin `<image>`.
2. **Sin teselas raster.** Decisión documentada: con vector no hacen falta (0 teselas, 0 KB). Si en el futuro se pinta un fondo ilustrado, se usa una **pirámide de teselas** (9.4).
3. **Peones, dados, marcadores, pines y tarifas** son SVG; los dados usan SVG sobre un cubo CSS 3D.
4. **Zoom mínimo y máximo definidos por el criterio de nitidez** (9.2).

### 9.2 Fórmulas de zoom (`src/hooks/usePanZoom.js`)

`z` = píxeles CSS por unidad de tablero. Tablero de 2970 × 2100 unidades (W × H). En el modo vertical el SVG se gira 90° (y, en horizontal con ventana alta, además el lienzo; ver 9.6) y todo se calcula en el marco del SVG (`Fu`, `Fv` = ancho y alto de la pantalla en ese marco).

```
z_min = max( Fu / (spanMax · W) , Fv / (1,15 · H) )          spanMax = 0,60  → nunca se ve más del 60 % del ancho
z_max = max( min( min(Fu, Fv) / spanMin , 10 / DPR ) , 3 · z_min )   spanMin = 220 unidades; mínimo visible
```

- `10 / DPR` es el tope por **cuantización**: las coordenadas están redondeadas a 0,1 unidad; con `z · DPR ≤ 10` un paso de cuantización mide ≤ 1 píxel físico, así que a zoom máximo no se aprecian escalones ni en pantallas ×3.
- `spanMin = 220` evita acercarse tanto que se pierda el contexto.
- Valores reales medidos: PC 1280×800 → `z_min 0,718`, `z_max 3,055`; teléfono 390×780 vertical → `z_min 0,34`, `z_max 1,773`.
- El tablero **no se muestra entero**: el zoom mínimo ya recorta; hay minimapa (clic para ir), «centrar en mi personaje» y selector Horizontal/Vertical (9.6).

### 9.3 Técnica «transformación GPU + confirmación vectorial»

El `<svg>` es 25 % más grande que la pantalla por lado (overscan). Durante el gesto solo se escribe `style.transform` (translate + scale) en `requestAnimationFrame`: compone en GPU y **React no se vuelve a renderizar** (el estado del gesto vive en variables locales). Al soltar —o si la escala cambia mucho o se agota el overscan— se «confirma»: se escribe un `viewBox` nuevo y se quita la transformación, de modo que el navegador **vuelve a rasterizar el vector a la escala real y la densidad real** (DPR). En reposo nunca hay píxeles ampliados.

### 9.4 Pirámide de teselas (OPCIONAL, no usada)

Solo si algún día se añade un fondo raster: niveles `L0..Ln` con `n = ceil(log2( z_max · DPR_max · W / 256 ))`, teselas de 256 px, formato WebP; resolución del nivel más profundo ≥ `z_max · 3` px por unidad (para DPR 3); carga perezosa por visibilidad y descarga (`img.src=''`, quitar del DOM) de las teselas fuera de pantalla + 1 de margen; presupuesto: ≤ 40 teselas montadas y ≤ 3 MB en pantalla.

### 9.5 Verificación de nitidez (hecha)

`tests/navegador/05_zoom_dpr.py`: capturas a zoom mínimo y máximo, viewport de teléfono (390×780) y PC (1280×800), DPR 1/2/3 (12 capturas); recortes a resolución nativa a DPR 3 revisados: trazos, números de tarifa, peones y sombras con bordes limpios. **Criterio de aceptación**: ningún elemento del tablero se pixela a zoom máximo con DPR 3 → **cumplido**.

### 9.6 Vista HORIZONTAL por defecto, VERTICAL opcional, rotación del lienzo

- La vista horizontal es la predeterminada en **todos** los tamaños y orientaciones. Se decide solo por la preferencia del jugador (`localStorage['mun.vista']`, por defecto `'horizontal'`), nunca por media queries ni `orientation`.
- `src/hooks/useLienzo.js` mide `innerWidth/innerHeight` y calcula la geometría: en modo horizontal el lienzo mide `lw × lh` con `lw ≥ lh`; si la ventana es más alta que ancha (`vh > vw`) el lienzo se gira 90° con `transform: translate(vw,0) rotate(90deg)` (origen 0 0) para usar todo el ancho disponible; en modo vertical es una columna centrada (`lw = min(vw, max(340, 0,66·vh))`) y el SVG del tablero se gira 90°.
- Los estilos dependen de atributos del lienzo (`data-modo`, `data-tam`, `data-forma`, `data-rotado`) y de `--lw/--lh`, no de `@media`. `SelectorVista.jsx` (Horizontal | Vertical) está en la sala, la barra superior y las hojas; el cambio es inmediato y se guarda.
- `usePanZoom` convierte los gestos del marco del dispositivo al marco del lienzo (`uiRot`) y al del SVG (`rot`), de modo que el mapa sigue al dedo con el lienzo girado y la rueda/pellizco conservan el punto central.
- Verificado (`tests/navegador/10_vista_horizontal_vertical.py`): 390×844, 844×390, 820×1180, 1180×820 y 1280×800, cada uno en horizontal predeterminado y en vertical activado; modo y rotación correctos, selector visible, preferencia que sobrevive a recargar, barra/acciones/minimapa/modales/dados/menús/mano dentro del lienzo, pan y pellizco exactos. Capturas en `docs/capturas/`.

---

## 10. Cartas bajo demanda

### 10.1 Principio

No hay 195 cartas cargadas. El servidor decide qué carta sale y a quién; el cliente recibe un DATO (sección 7.5) y construye la carta con el componente `Carta` (HTML/SVG/CSS) según el mazo (`deck-evento`, `deck-historico`, `deck-mensaje`, `deck-objeto`, `deck-reto`, `deck-ifrit`, `deck-trivia`, `deck-mesa`, `deck-cuento`, `deck-personaje`). Los mazos tienen su marco, color e icono en `cards.css` / `iconos.jsx`. La carta escala entera con su caja (`.carta-caja` es el contenedor de `cqw`), por lo que el texto nunca desborda: el cuerpo tiene `overflow-y: auto` como red de seguridad y la galería de pruebas confirma 0 desbordes en 180 cartas de los 7 mazos con texto.

### 10.2 Ciclo de vida

1. **Crear**: llega `estado.historial` con una carta nueva → `ModalCarta` la pone en la cola de lectura (privadas: solo si `para` incluye al jugador).
2. **Montar**: se monta UN `<Carta tam="completa">` dentro del modal y se carga su arte (una imagen de categoría, `useArte`).
3. **Leer**: barra **descendente** de 5 s (`transform: scaleX(1→0)` en GPU, `MIN_LECTURA_MS = 5000`); el botón «Cerrar» está deshabilitado («Leyendo… 5») hasta que acaba. Pasados los 5 s cada jugador la cierra cuando quiera o la deja abierta; no cierra para los demás.
4. **Cerrar → destruir**: se desmonta el árbol DOM de la carta y `useArte` libera la imagen (`img.src = ''`). Solo queda el DATO en `historial` (id, mazo, texto, efecto, quién la sacó, hora).
5. **Consultar**: «Última carta» y el historial vuelven a dibujar la carta desde su dato en modo consulta (sin temporizador), con el mismo componente.

Al montar la interfaz (inicio de partida o recarga) solo se dan por leídas las cartas con más de 15 s de antigüedad: la del arranque se muestra.

### 10.3 Miniaturas de la mano

`<Carta tam="mini">` — misma pieza con icono, título y pie, **sin arte ni cuerpo de texto**; abrirla monta la carta completa en modo consulta. Las miniaturas no cargan imágenes.

### 10.4 Política de carga y descarga de activos

| Activo | Cuándo se carga | Cuándo se libera | Peso |
|---|---|---|---|
| Arte de categoría (`public/arte/*.webp`) | al montar una carta completa de esa categoría | al desmontarla | ≈ 8 KB cada una (23 en total, 184 KB) |
| Dorsos (`public/cartas/dorsos/*.webp`) | `loading="lazy"` solo si se muestra un dorso | — | 8–20 KB |
| Iconos y sprites | con el shell | nunca | 40 KB |
| PNG completos (`fallback/cartas-completas/`) | **no se usan**; solo documentados | — | 5,3 MB fuera del bundle |

### 10.5 Presupuesto por pantalla

Cartas montadas: **≤ 1 completa** (más miniaturas de texto). Imágenes de carta vivas: ≤ 1. DOM: una carta completa son unas decenas de nodos.

### 10.6 Respaldo opcional con PNG

Si se prefiere arte completo por carta, copiar los PNG a `public/cartas-completas/` y usar `<img loading="lazy">` en `Carta`; **no** forman parte del build por defecto (peso).

### 10.7 Criterios de aceptación y resultado

- ≤ 1 carta completa montada a la vez → **cumplido** (`window.__cartas.maximo = 1`).
- Sin crecimiento de memoria tras cerrar 100 cartas → **cumplido**: nodos DOM 1.676 antes y después, 1 imagen en el documento, `montadas = 0`; el heap crece ~1,3 MB por los 100 datos que se conservan a propósito en el historial (tras recolección de basura), sin fugas de DOM/imágenes (`tests/navegador/03_cien_cartas_memoria.py`).

---

## 11. Dados

- El **servidor** decide los valores (`tirarDados{n}`: 1 dado de ingreso, luego 1 a 4; también `host.tirarNPC`). Solo tira el jugador en turno (dado de ingreso al empezar; «2 dados» después); el banco tira por Asesinos/Yafar NPC. La barra inferior dice «Es tu turno / Turno de X» y cuál es la fase.
- Todos ven los mismos cubos rojos con puntos blancos girando sobre el tablero (CSS 3D con caras SVG; ~1,7 s con rebote y sombra elíptica).
- Al acabar la animación aparece un modal con el resultado para todos; **cualquiera** puede pulsar «Cerrar para todos» (el servidor exige ≥ 1,9 s) y los dados desaparecen en todos los dispositivos. Si nadie los cierra, `tick()` los cierra a los 20 s.
- Verificado con dos navegadores reales contra el servidor (`07_servidor_real_dos_navegadores.py`): ambos ven los dados, ambos ven el resultado, al cerrar uno desaparecen en los dos.

---

## 12. Rendimiento y presupuestos de peso

### 12.1 Objetivo

60 fps en un teléfono de gama media. Medidas: transform/GPU en gestos; **cero** renders de React por fotograma; el DOM del tablero no cambia durante el gesto; sin filtros SVG ni sombras costosas; dados con `will-change`/composición propia.

### 12.2 Medidas (Chrome headless, sin GPU real, DPR 2 y 3)

| Prueba | Resultado |
|---|---|
| Renders de React durante 90 pasos de arrastre + 50 pasos de rueda | **0** |
| Intervalo entre fotogramas (mediana / p95) | 16,7 ms / 16,7–16,8 ms |
| Máximo | 33 ms en PC; un pico de 450 ms en DPR 3 emulado, en la reconfirmación del vector a la nueva escala (rasterizador por software de headless; en GPU real es mucho menor — vigilar en dispositivo real) |

### 12.3 Presupuestos de peso (transferido por la red, con gzip)

| Concepto | Peso |
|---|---|
| JS del juego | 239,7 KB (**77 KB** gzip) |
| CSS | 25,5 KB (6,8 KB gzip) |
| SVG del tablero | 178 KB (**53 KB** gzip) + minimapa 3 KB |
| Fuentes WOFF2 | 194 KB (4 archivos) |
| Arte de una carta | ≈ 4–8 KB |
| **Carga en frío hasta ver el tablero y la primera carta** | **338 KB** (medido) |
| Presupuesto máximo permitido | 600 KB en frío; +10 KB por carta |

Presupuesto de SVG/teselas: SVG del tablero ≤ 250 KB (hoy 178); teselas: 0 (hoy), ≤ 3 MB en pantalla si se añade la pirámide. Build de demostración: +48 KB de JS (15 KB gzip) del adaptador local.

---

## 13. Servidor: tres escenarios, Raspberry Pi, systemd, red

Mismo programa, tres lugares donde puede vivir:

| Escenario | Qué es | Notas |
|---|---|---|
| (a) PC de alguien que no juega | `npm start` en un portátil neutral | cualquiera puede ser el banco |
| (b) PC del jugador que hace de banco | el banco juega en otro navegador de ese mismo PC | si ese PC se apaga, la partida **se detiene** (es el servidor); por eso el banco como ROL no depende de la conexión del navegador |
| (c) Raspberry Pi | solo guarda y reparte el estado; sin pantalla ni navegador | recomendado; arranque automático con systemd |

Requisitos del servidor: Node ≥ 18 LTS (Raspberry Pi OS ARM 32 o 64 bits: en 32 bits usar Node 18/20 armv7l); CPU y memoria bajas (≈ 55 MB de RAM medidos al arrancar y CPU casi nula en reposo: sin dependencias nativas, sin base de datos, estático con caché gzip en memoria); sirve el cliente compilado **y** el WebSocket en el mismo puerto (8080 por defecto).

**Un solo comando de arranque** imprime todo lo necesario:

```
  MIL Y UNA NOCHES · servidor listo
  Sala: MIL493   Datos: /home/pi/mun-datos/partida.json
  Abre en el teléfono, tablet o PC (misma red Wi-Fi):
     http://192.168.1.5:8080   (wlan0)
  PIN de anfitrión (para recuperar el rol de banco desde otro dispositivo): 1557
  (código QR)
```

### 13.1 Instalar en una Raspberry Pi

```bash
# En el PC de desarrollo
npm install && npm run build && npm run empaquetar        # crea ./paquete-servidor/
# Copiar la carpeta a la Pi (USB o scp) y, en la Pi:
cd paquete-servidor && npm install --omit=dev && npm start
```

### 13.2 Arranque automático (systemd)

`/etc/systemd/system/mil-y-una-noches.service`:

```ini
[Unit]
Description=Mil y una Noches (servidor de partida)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/paquete-servidor
Environment=MUN_DATOS=/home/pi/mun-datos
ExecStart=/usr/bin/node server/index.js --puerto 8080 --sin-qr
Restart=always
RestartSec=3
# Limita el daño si algo falla
MemoryMax=200M

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now mil-y-una-noches
journalctl -u mil-y-una-noches -n 30      # muestra IP y PIN del banco
```

### 13.3 Requisitos de red

- Todos los dispositivos en la **misma red local**; el Wi-Fi no debe tener «aislamiento de clientes/AP isolation» (muchas redes de invitados y de cafeterías lo activan). Alternativa sin router: la Pi como punto de acceso (`nmcli device wifi hotspot`) o el teléfono del banco como zona Wi-Fi.
- Puerto TCP 8080 abierto en el servidor (firewall local). HTTP y `ws://` (sin HTTPS): no hace falta internet **durante la partida**; solo para instalar dependencias.
- Dirección: IP fija o reserva DHCP recomendada; opcional `raspberrypi.local` (mDNS) si el sistema lo soporta.

### 13.4 Reinicio y recuperación

- Guardado atómico a `partida.json` 400 ms después de cada cambio; copias rotativas `.bak1..3` (como máximo una por minuto); `SIGINT/SIGTERM` guardan antes de salir.
- Al arrancar se reanuda sola; si el archivo está dañado se prueba `.bak1..3`.
- Cortes de luz: se pierden como mucho unos cientos de milisegundos; los jugadores vuelven solos (el navegador reconecta con su token).
- `--nuevo` empieza otra partida (la anterior se conserva como `partida-anterior-<ts>.json`); `--restaurar archivo.json` recupera una copia.
- Un navegador borrado: el banco usa el panel; un banco perdido: «Banco / anfitrión» → PIN de la consola.

### 13.5 Modo banco/anfitrión

Un jugador (el primero en entrar, o quien teclee el PIN) tiene el panel «Banco»: entregar dinares/noches, corregir campos, repartir objetos o mensajes, revelar evento o histórico, tirar dados de Asesinos/Yafar NPC, pasar turno, eliminar o ceder el banco; ve el tamaño de los mazos. Si el banco se desconecta se muestra «banco ausente» y **la partida sigue**; cualquiera puede tirar los dados de los NPC.

---

## 14. Privacidad

- Mano, objetos y mensaje privado: solo en la vista del dueño; el resto recibe el conteo (`nMano`).
- Cartas privadas (`para`): solo van a sus destinatarios; los `uid` de objetos ajenos no viajan.
- Respuesta de trivias (CRP): nunca en el cliente de juego; aparece tras contestar.
- `token`, `semilla`, mazos y PIN no salen en las vistas ordinarias (el PIN solo en la del banco).
- Probado por `tests/servidor.test.mjs` (el objeto repartido a B no aparece en los mensajes recibidos por A y C; ninguna vista contiene `token` ni `semilla`; solo el banco ve `mazos`).

---

## 15. Pruebas y criterios de aceptación

| Prueba | Qué comprueba | Estado |
|---|---|---|
| `npm install` y `npm run build` en copia temporal fuera de la carpeta | el proyecto se instala y compila limpio | **OK** (`/tmp/online-run`, 0 errores) |
| `tests/engine.test.mjs` | reglas, privacidad de la vista, turno completo, persistencia, victoria única/simultánea/contra NPC, cimitarra, veneno y antídoto | OK |
| `tests/cuentos.test.mjs` | cuentos de ambiente (19.7) | OK |
| `tests/mensajes.test.mjs` | Mensajes (18.2): uno activo, los 16 salen una vez, mazo agotado | OK |
| `tests/sim.mjs 48` (en `npm test`) y `tests/sim.mjs 6000` | partidas aleatorias completas de 1–8 jugadores (con NPC, serializar/restaurar), sin excepciones ni bloqueos | OK (6000) |
| `tests/servidor.test.mjs` | ws real: privacidad, banco ausente, reinicio con token, recuperar sitio por nombre, rechazo de intrusos, healthz/SPA | OK |
| `tests/simulacion-ws.mjs` (`npm run simular`) | clientes WebSocket jugando hasta el final: 4 jugadores con Yafar, solitario, 8 jugadores, 3 + NPC difícil (servidor `--rapido`); también contra el `paquete-servidor` | OK |
| `01_lobby_mesa.py` | lobby y mesa en PC y móvil sin errores de consola | OK |
| `03_cien_cartas_memoria.py` | 100 cartas abiertas y cerradas: ≤ 1 montada, DOM estable | OK |
| `04_galeria_desbordes.py` | 180 cartas × 2 anchos: 0 desbordes | OK |
| `05_zoom_dpr.py` | zoom mín./máx. en móvil y PC a DPR 1/2/3 | OK |
| `06_rendimiento_gestos.py` | 0 renders de React por gesto; fotogramas 16,7 ms | OK |
| `07_servidor_real_dos_navegadores.py` | servidor real, PC + teléfono: lobby → inicio → carta → dados sincronizados → cerrar para todos; 0 peticiones externas | OK |
| `08_mano_mercado_historial.py` | miniaturas, carta de la mano, mercado, historial, «última carta» | OK |
| `09_cuento_modal.py` | cuento de ambiente: modal con barra de 5 s y dinares | OK |
| `10_vista_horizontal_vertical.py` | horizontal por defecto y vertical opcional en 5 dispositivos × 2 modos: rotación, selector, localStorage, gestos pan/pellizco, modales, dados, menús, mano | OK |

Criterios de aceptación globales: (1) ≤ 1 carta completa montada; (2) memoria estable tras 100 cierres; (3) ningún elemento del tablero se pixela a zoom máximo con DPR 3; (4) 0 renders de React durante gestos; (5) cero peticiones externas; (6) carga en frío ≤ 600 KB; (7) el servidor continúa sin el banco; (8) estado idéntico tras reiniciar; (9) ninguna vista filtra datos de otros; (10) `find` no encuentra `node_modules`, `dist` ni lockfile en `onlineGame/`.

---

## 16. Convenciones y cableado

- **Idioma**: todo en español (identificadores de dominio, textos, comentarios). Referencias al reglamento como `R 7.3`.
- **Estilos**: variables en `theme.css`; un archivo por área (`board`, `cards`, `ui`); clases en español en minúscula con guiones; unidades `cqw` solo dentro de `.carta-caja`.
- **Datos**: `src/data/*.json` son **generados** por `tools/extract_data.py`; no se editan a mano. El servidor los carga con `server/datos.js`; el cliente solo importa los públicos desde `src/game/data.js`.
- **Activos**: SVG en `public/svg/…` referenciados con rutas absolutas (`/svg/personajes/4-jamil.svg`); `Sprite` usa `sprites.svg#id`; arte por clave (`arte-claves.json` → `/arte/<clave>.webp`); dorsos `/cartas/dorsos/<mazo>.webp`; fuentes en `theme.css`.
- **Cableado de un componente nuevo**: leer con `useJuego((x) => x.estado)`, enviar con `enviar(ACCIONES.nombre(...))`, abrirlo desde `App.jsx` con el estado `panel`, y estilarlo con `desplegable`/`hoja-modal`/`modal-fondo`.
- **Nunca** usar `Math.random()` ni `Date.now()` dentro del motor para resultados: usar `dado(e)`/`barajar(e, …)` y `e.ahora`.
- **Comentarios** solo para intención o restricciones, no para narrar.
- **Sin marcas de agua** en pantallas de juego; créditos solo en `AcercaDe.jsx`.

---

## 17. Hitos

| Hito | Contenido | Estado |
|---|---|---|
| 1 | Servidor + lobby + tablero con pan/zoom | hecho |
| 2 | Turnos + dados + movimiento | hecho |
| 3 | Cartas y modales | hecho |
| 4 | Economía y objetos con efectos | hecho |
| 5 | Combate, robos, Asesinos, retos, tesoros, Yafar NPC/jugador, solitario | hecho (probado con miles de partidas simuladas) |
| 6 | Interfaz completa, vista horizontal/vertical con rotación, pulido y pruebas de navegador | hecho; pendientes de 8.3 |

---

## 18. Alcance y mejoras

**Entregado:** el juego completo (8.1) jugable de principio a fin. **Mejoras futuras:** ver 8.3.

---

## 19. Riesgos

| Riesgo | Mitigación |
|---|---|
| Wi-Fi con aislamiento de clientes | documentado en 13.3; usar hotspot |
| Navegador de iOS suspende WebSocket en segundo plano | reconexión automática + token; la vista se rehidrata al volver |
| Un jugador cambia de navegador | el banco puede ceder/editar; PIN |
| Picos de rasterizado a DPR 3 en móviles lentos | medir en dispositivo real; bajar `spanMin` o el overscan |
| Regla nueva rompe una anterior | prueba de motor por regla; el reglamento manda |
| Fuga de respuestas | trivias fuera del bundle de juego; probar con `rg` en `dist/` |
| Texto de una carta o regla distinto del reglamento | gana el reglamento; ante ambigüedad, criterio pro-jugador (8.2) |
| Rotación del lienzo en navegadores móviles con barras que cambian el alto | `useLienzo` escucha `resize`, `orientationchange` y `visualViewport` |

---

## 20. Prompt de arranque para una sesión nueva de Claude

Copia y pega:

```
Eres un ingeniero senior de JavaScript. Trabajas en el proyecto «Mil y una Noches» (juego de mesa web en red local) en la carpeta docsJuegoMesa/onlineGame.
Lee primero README.md y plan-juego-web.md completos (secciones 3, 4, 8 y 9.6). No cambies reglas del juego: la fuente es el reglamento extendido; ante una ambigüedad aplica la regla que más beneficie al jugador y anótala en 8.2.
Reglas de trabajo: español; no instales nada dentro de onlineGame (verifica en una copia temporal: rsync a /tmp/online-run sin node_modules ni dist, luego npm install && npm run build && npm test && npm run simular); el servidor es autoritativo (shared/) y filtra por jugador (vista); sin dependencias nativas; sin marcas de agua en pantallas de juego; el tablero siempre vectorial; solo una carta completa montada a la vez; la vista horizontal es la predeterminada y no se decide con media queries.
Tarea: elige una mejora de 8.3, impleméntala con prueba de motor y, si hay interfaz, una prueba de navegador; actualiza el plan y el README. Antes de empezar, resume en 10 líneas lo que entendiste y qué vas a hacer primero.
```

---

## 21. Resultados de verificación (1 de noviembre de 2026)

- Copia temporal fuera de la carpeta (`/tmp/online-run`): `npm install`, `npm run build`, `npm run build:demo`, `npm test` y `npm run simular` sin errores; `npm run empaquetar` + `npm install --omit=dev` y servidor del paquete jugando partidas completas por WebSocket.
- Simulaciones: 6000 partidas aleatorias del motor (1–8 jugadores, NPC, solitario) sin excepción ni bloqueo; por WebSocket con el servidor real: 4 jugadores hasta 1.001 noches, solitario contra Yafar, 8 jugadores y 3 + NPC difícil.
- Chrome headless: vista horizontal predeterminada y vertical opcional en 390×844, 844×390, 820×1180, 1180×820 y 1280×800 (todas las comprobaciones de la prueba 10 en verde), servidor real con PC + teléfono, 100 cartas sin fuga de memoria, 180 cartas sin desbordes, 0 renders de React durante gestos, 0 peticiones externas. Capturas revisadas en `docs/capturas/` (14).
- `ejemplos/muestra-juego.html` verificada en Chrome: horizontal por defecto, rotación en teléfono vertical, selector vertical con recarga.
- Estructura limpia: sin `node_modules`, `dist`, `package-lock.json`, `datos/` ni `paquete-servidor/` en `onlineGame/`.
