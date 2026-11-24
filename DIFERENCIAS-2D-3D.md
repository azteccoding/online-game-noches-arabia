# Diferencias entre el juego 2D y el 3D

Bitácora de lo que el juego 3D (rama `juego-3d`, https://3d.milyunanoches.net) hace distinto del juego 2D (rama `online-game`).
La rama 2D no se toca: cada diferencia nueva se anota aquí con su fecha y su commit.

Punto de partida: el 3D salió del 2D en el commit `379b798` (23 de noviembre de 2026). El 2D sigue en ese commit.

## Reglas del juego

| Fecha | Qué cambia en el 3D | En el 2D | Commit 3D |
|---|---|---|---|
| 23 nov | **R6 Álgebra en la Madrasa**: ganas si el dado extra cae igual al promedio, o uno más o uno menos. | Solo ganas con uno más o uno menos (igual al promedio no gana). | `785c4b8` |
| 23 nov | **Caballos mongoles**: Jorge dice que en el 3D salen **2** caballos mongoles por cada yegua. | El código (igual en los dos) pone 1 a la venta por cada yegua vendida en Estambul. | por confirmar con Jorge |
| 23 nov | **Toledo (H2)**: irse de Andalucía a Bagdad va por El Cairo y cobra los dos tramos (cada uno cuenta como viaje). | La opción a Bagdad salía «(null)» y el viaje era gratis. | `507b05f` |
| 23 nov | **Zubayda en el harén**: sale la carta pintada y los 12 dinares llegan al cerrarla (o a los 90 s). | Los dinares llegan al instante, sin carta. | `71f423e` |
| 23 nov | **Zubayda le renta a Adí, Anís o Jamil**: sale la carta pintada solo para los dos; el cobro y las consecuencias van al cerrarla. | Sin carta: las consecuencias son inmediatas. | `a1d0e08`, `66459ab` |
| 24 nov | **Jamil toca el laúd**: acción propia de Jamil, en cualquier ciudad y cada turno. Gana 1 noche y 1 dinar y gasta su acción principal. En el tablero se sienta con el laúd, toca con música y se levanta; el premio se avisa al terminar. | No existe. | `9d33e27` |
| 24 nov | **El laúd es una carta de Jamil**: empieza la partida con él. Lo puede vender al mercado de cualquier ciudad por 30 dinares; ese mercado lo revende en 45 a quien lo quiera, y también cambia de manos en un trato. Cuando se vende, todos se enteran. Solo Jamil sabe tocarlo: sin el laúd no puede tocar, y en otras manos no suena. A Jamil no le pesa; a cualquier otro le cuenta como un objeto para el límite de 7. | No existe. | `9d33e27` |

## Sala en línea, turnos y banco

| Fecha | Qué cambia en el 3D | En el 2D | Commit 3D |
|---|---|---|---|
| 23 nov | Al sacar a un jugador ya no se vuelve a ofrecer «Sacarlo». Si todos los que tienen personaje están sacados, la partida espera a que vuelva quien tiene el turno y lo avisa. | Si el sacado era el único jugador, el turno le volvía y «Sacarlo» salía otra vez sin fin. | `3659be2` |
| 23 nov | Votación de partida nueva: el sacado no vota; el banco conectado vota aunque no tenga personaje. | El sacado contaba si seguía conectado; el banco sin personaje no votaba y la votación se caía con 0 a 0. | `3659be2` |
| 23 nov | Quien estaba en la sala sin personaje cuando empezó la partida puede elegir personaje y entrar durante la primera ronda (botones «Ver el tablero» y «Elegir personaje y entrar»). | Quedaba fuera para siempre, sin personaje. | `3659be2` |
| 23 nov | Al tomar el banco con el PIN sale el aviso «Ahora eres el banco». | No avisaba nada. | `3659be2` |

## Pantalla y avisos

| Fecha | Qué cambia en el 3D | En el 2D | Commit 3D |
|---|---|---|---|
| 23 nov | Todas las notificaciones duran **3 segundos** (se quitan antes al tocarlas o deslizarlas). | 5 segundos. | `3659be2` |
| 23 nov | Los dados ruedan 3 segundos en la mesa 3D (también los de Yafar NPC). | 1.7 segundos. | `f01d748` |
| 23 nov | Las cartas de la llegada salen cuando el monito ya llegó a la ciudad (termina la animación del viaje). | Salen al momento. | `f01d748` |
| 23 nov | Cartas con pintura a carta completa (las pinturas de Jorge, con recuadro de texto semitransparente); las que no tienen pintura propia usan los fondos GEN-1, GEN-2 y GEN-3. La carta abierta es más grande y el texto crece al pasar el mouse o tocarla. | Cartas con su arte original. | varios (ver `arteCartas.json`) |
| 23 nov | Elegir personaje: los monitos son las figuras pintadas del 3D, de frente. | Los monitos dibujados del 2D. | `0fc9667` |
| 23 nov | Vista previa de WhatsApp con su propia miniatura y la dirección del link (3d.milyunanoches.net). | La vista previa del 2D. | `08f36f8`, `d99bf5f` |
| 23 nov | La demo (`/demo/` y el botón «Ver demostración 3D») es la demo visual 3D. | La muestra del juego web 2D. | `c819212` |
| 23 nov | Cartas: la de «Tu entrenamiento» sale con la pintura de su carta (R18 cimitarra, R19 jambiya, R42 alfanje, R43 arco, R51 arco máximo, R54 ejército del sultán; la de R25 sigue genérica porque no tiene pintura); las «Dos noches en…» (E13 El Cairo, E14 Aleppo, E15 Damasco) llevan el texto chiquito sin fondo borroso y se agrandan con el mouse; los entrenamientos que se hacen en varias ciudades (R18, R42, R43) nombran en su carta la ciudad donde estás (R43 en Yemen dice «Yemen · C» y «los arqueros de Yemen»). | «Tu entrenamiento» con fondo genérico; «Dos noches» con texto grande en fondo borroso; R43 siempre dice Andalucía. | `5590964` |
| 23 nov | Atajos de teclado: flechas mueven la cámara sobre el mapa; + y − (también del teclado numérico) acercan y alejan; **m** mercado, **a** acciones (en tu turno), **n** mensajes, **c** última carta, **v** la Carta de Trivias por responder, **z** cierra la carta abierta (si ya se puede) o la ventana abierta, **f** pantalla completa (como su botón), **x + espacio** termina el turno (antes Alt + espacio, que en Windows abre el menú de la ventana); **Shift + flecha arriba o abajo** recorre las filas del menú de acciones o del mercado (la marcada se ve con borde dorado) y **Enter** elige su botón. | En el mapa 2D solo flechas y + / − con el mapa enfocado; sin atajos de letras. | `c819212`, `6eed7af`, `5590964`, `ee4eb0f` |

## Tablero y animaciones (solo existen en el 3D)

- Tablero, figuras de los personajes, monturas (caballo, camello, caballo mongol, burro gris, alfombra), dhow, lámpara y genio hechos con las pinturas de Jorge (`c30377b` y anteriores).
- Cámara de vista de pájaro a pie de calle con la rueda del mouse (`f01d748`).
- Día y noche: el día dura la ronda y la luz se reparte por turnos; con 4 o más jugadores el último juega de noche, con 6 o más los dos últimos (`d0ec823`, `051d9a8`).
- Dados que caen en el mapa, levantan polvo, se entierran en la arena y salpican en el mar; incendio de la Cruzada con sonido (`5c116e3`, `766d68f`).
- Sonidos del 3D (mp3, ogg, wav, m4a) (`5609ece`).
- Nur al Din ya no sale con la mano izquierda cortada, ni en la selección de personaje ni en el tablero (`65f8a39`).
- Barcos (dhows): navegan por el agua apartados de la costa (rodean cabos en vez de cruzar tierra); atracan junto a la orilla solo para subir o bajar a alguien y luego esperan donde no tapan nombres ni dibujos del mapa. Esperan paralelos a la costa; el del Mar Rojo espera afuera, en el golfo frente al Cuerno de África, debajo del nombre de Yemen; en mares estrechos el barco es algo más chico (`d337d63`, `0fe6f14`).
| 23 nov | Pelea entre dos jugadores en tres tiempos: con los primeros dados de la pelea se plantan uno frente al otro; si hay arcos, la flecha sale desde ahí; el choque de armas va después de la última tirada y al final sale el conteo. MIENTRAS HAY ANIMACIÓN DE PELEA (golpes o flecha) no se ve ninguna ventana ni aviso ni actúan los atajos: todo sale al terminar. | No hay animación de pelea. | `ee4eb0f` |
| 23 nov | Solo tu monito gira: da vueltas despacio con el acercamiento máximo sobre él y da una vuelta entera si lo tocas. Los de los demás no giran. | No aplica. | `ee4eb0f` |
| 23 nov | Rebelión de los Zanj (H1): solo se huye a ciudades unidas a Bagdad por tierra y a un turno (Damasco, Aleppo, Estambul, Yemen, El Cairo, Isfahán, Samarcanda, Magreb; ni India ni Basra) y cuesta 30 dinares en todo caso. El burro sigue llevando sin tarifa, pero solo a esas ciudades. | Huir a cualquier vecina de tu ciudad por el triple de la tarifa, con tope de 30. | `ddf2a89` |
| 23 nov | Durante la animación de un viaje se esconden todas las ventanas, cartas y avisos, igual que en la pelea. | No aplica. | `ddf2a89` |
| 23 nov | El espacio solo tira el dado de ingreso (y x + espacio termina el turno): ya no aprieta el botón enfocado. Shift + flechas y Enter también recorren las opciones de las decisiones (Rebelión de los Zanj, ifrit…) y de las trivias. | El espacio aprieta el botón enfocado. | `ddf2a89` |
| 23 nov | La ventana de qué salió en tu dado de ingreso se cierra sola a los 1.5 s si no hay carta de sheij (con el mouse encima espera y se cierra al quitarlo); con carta de sheij se cierra a mano. | Siempre a mano (o sola a los 30 s). | `ddf2a89` |
| 23 nov | Cartas: los viajes de Sindbad (R11 a R14) usan la pintura de la Flota de Sindbad; «Acero de Damasco» (al terminar la forja) usa la pintura de R52. | Fondo genérico. | `ddf2a89` |
| 23 nov | Proponer un trato con dinares o noches en negativo: el botón «Enviar propuesta» ya no se apaga si no ofreces dinares ni noches (Nur al Din con −26 no podía vender su caballo). | El botón se apaga con saldo negativo (mismo error; pendiente de que Jorge diga si se corrige). | `4661dda` |
| 23 nov | Si no puedes salir de tu ciudad (muy cargado, estudio, forja…), la hoja de la ciudad destino dice el motivo junto al botón de viajar; el aviso de sobrecarga explica qué pesa. El aviso rojo va dentro del mapa, arriba de su barra, y ya no tapa los botones de abajo. | El motivo solo arriba de la hoja; aviso rojo fijo sobre la barra de acciones. | `4661dda` |
| 23 nov | En el Jorasán el mercado no se despliega: solo dice «Estás en el Jorasán: no hay nada que comprar ni vender». | Se abre el mercado completo. | `4661dda` |
| 23 nov | Toda carta trae el foco en el botón Cerrar y Enter la cierra (respetando el tiempo mínimo de lectura); el espacio ni cierra ni hace de Enter. | Como antes: el espacio también aprieta el botón enfocado. | `992ab78` |
| 23 nov | El texto de una carta pintada se agranda solo con el mouse sobre la carta, no sobre el botón Cerrar ni sobre sus botones. | Igual que antes. | `ee4eb0f` |
| 23 nov | En un trato solo se anotan dinares del 0 al 500 y noches del 0 al 900 (casillas y motor); nunca negativos. Alerta roja «Más de 100 dinares» y «Más de 200 noches» en el trato. | Sin tope: cualquier número de 0 en adelante. | `b6dc600` |
| 23 nov | Ninguna carta pintada lleva recuadro borroso: todas van en letra pequeña (como la Rebelión Zanj) y el texto crece sobre fondo opaco al pasar el mouse. | Sin pinturas de carta. | `fa70129` |
| 23 nov | Si mueres por una tirada tuya (reto de Sherezada y similares), primero lanzas y ves tus dados: el turno no pasa ni la partida termina hasta cerrarlos. | El turno pasa (o la partida termina, si juegas solo) antes de lanzar los dados. | `06094ed` |
| 24 nov | Sonidos reales (CC0) en peleas, retos, cartas, viajes y genio, con botón de volumen y silencio. | Sin sonidos. | `7a17eb2` |
| 24 nov | Armas, flecha y escudo pintados en las peleas; cartas de cimitarra, alfanje, jambiya, arco, flechas, escudo y genio con su pintura; el barco se ve bien desde arriba. | Sin pinturas ni modelos 3D. | `34a3a53`, `fd7e650` |
| 24 nov | Mientras el genio sale de la lámpara, flota y vuelve a meterse, todo lo demás se queda quieto (monitos, barcos, ronda); sigue al esconderse el genio. | El 2D no tiene animación del genio. | `b1dc128` |
| 24 nov | Nur al Din de ocho vistas (v2). Pintura nueva de Zein en la Giralda (R26, vestida como en su hoja) y de Sherezada leyendo (R16); las anteriores se conservan. Botones de la esquina del mapa (girar, vista general, centrar, sonido) a la vista: estaban tapados por el lienzo 3D. Partida de muestra con los ocho personajes (`tools/partida-personajes.mjs`). | El 2D sigue con sus ilustraciones y su tablero de siempre. | `d5b851a`, `1248128` |
| 24 nov | Yafar de ocho vistas (v2), con pintura cenital cuando la cámara lo mira desde arriba. | El 2D sigue con su monito de siempre. | `658cf8a` |
| 24 nov | Cartas de sheij con pintura: la genérica (Averroes, Abu Madyan e Ibn Arabi) y la propia de Ibn Hazm (M5 a M8, M17 y su carta de objeto). | El 2D sigue con su ilustración de siempre. | `309bedf` |
| 24 nov | El Primer Viaje con Sindbad (R11) tiene su propia pintura, la isla viviente; R12, R13, R14 y la Flota de Sindbad siguen con la pintura compartida. | El 2D sigue con su ilustración de siempre. | `b37eea4` |
| 24 nov | Pinturas nuevas: Mercader de armas (E10), La posta urgente (R39), Leva del sultán (H7), Guerra entre hermanos herederos (H12) y Ejército de Kanmakán (K1). | El 2D sigue con sus ilustraciones de siempre. | `f4b6047` |
| 24 nov | Al obtener el Ejército de Kanmakán (500 noches o los cuatro viajes de Sindbad), su carta sale siempre en pantalla para toda la mesa, como la de un reto o un objeto; si hay dados en la mesa, espera a que se cierren. | En el 2D solo queda anotado en el registro y la carta aparece en la mano. | `f4b6047` |
| 24 nov | Jamil de ocho vistas (jamil_v2) con pintura cenital, y un segundo juego de ocho vistas de Jamil sentado tocando el laúd; la carta del laúd lleva la pintura de su hoja. | El 2D sigue con su monito de siempre. | `9d33e27` |

## Despliegue

- El 3D va en su propio servicio de Render, desde la rama `juego-3d` (`182dc2c`), con clave de sala `MUN_CLAVE`.
