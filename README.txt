MIL Y UNA NOCHES — juego web en red local
=========================================

Varios teléfonos, tabletas o PC abren una dirección en el navegador (misma red Wi-Fi, sin internet).
Todos ven el tablero; cada jugador ve SOLO su propia mano, cartas privadas y objetos.
Un servidor Node muy ligero guarda y reparte el estado (puede ser un PC o una Raspberry Pi sin pantalla).
Es el juego COMPLETO, de 2 a 8 jugadores (también solitario contra Yafar NPC), jugable de principio a fin hasta las 1.001 noches.

Documento completo y detallado: plan-juego-web.md (árbol de archivos, reglas implementadas y decisiones de
interpretación, protocolo, presupuestos, pruebas, mejoras futuras).


1. JUGAR (pasos exactos)
------------------------
  Requisitos: Node 18 o superior (https://nodejs.org; comprobar con  node --version). Internet solo para instalar.
  En la carpeta onlineGame, en una terminal:

    npm install          (instala react, vite, ws y qrcode-terminal; una sola vez)
    npm run build        (compila el cliente de juego en dist/; repetir solo si cambia el código)
    npm start            (arranca el servidor; Ctrl+C lo detiene)

  La consola imprime las direcciones, el PIN del banco y un código QR, por ejemplo:

      http://192.168.1.5:8080   (wlan0)
      PIN de anfitrión (para recuperar el rol de banco desde otro dispositivo): 1234

  CONECTAR LOS DISPOSITIVOS: todos en la misma red Wi-Fi que el servidor. Cada jugador abre esa dirección en el
  navegador (o escanea el QR de la consola), escribe su nombre y elige personaje.
  El primero que entra es el BANCO (anfitrión) y pulsa «Comenzar partida» cuando todos están listos
  (con 4 o más jugadores alguien debe llevar a Yafar el Bermekí; con 1 jugador se activa el modo solitario).
  Si el cortafuegos del PC pregunta, permite Node en redes privadas. Puerto por defecto: 8080.

  VISTA: en un teléfono o tablet en vertical, TODA la interfaz va en vertical a pantalla completa (entrada, sala, elegir
  personaje y partida) y el mapa se ve siempre apaisado, con el norte arriba, ajustado al ancho, con zoom y arrastre.
  Nada se gira. En PC o pantallas anchas, la vista es horizontal. No hay selector de vista.

  GUARDADO Y RECUPERACIÓN: la partida se guarda sola (datos/partida.json con copias .bak1..bak3).
    - Un teléfono que se apaga o recarga vuelve a su sitio solo (token en el navegador).
    - Si se apaga el servidor o se va la luz: volver a ejecutar  npm start  y la partida continúa donde estaba.
    - Si un jugador cambia de navegador o borra los datos del suyo: entra con el MISMO nombre y recupera su sitio mientras
      su dispositivo anterior esté desconectado (un nombre desconocido no puede entrar a media partida).
    - Si el banco pierde su dispositivo: entrar desde otro dispositivo, menú «Más» → «Banco / anfitrión», escribir el PIN (1234) y «Ser el banco».
    - Partida nueva:  npm start -- --nuevo   (la anterior queda como partida-anterior-<fecha>.json)
    - Restaurar una copia:  npm start -- --restaurar ./datos/partida.json.bak1

  Opciones del servidor (se pueden combinar):
    npm start -- --puerto 8080 --datos ./datos --nuevo --sin-qr --rapido --restaurar ./copia.json
    --rapido  omite las animaciones de dados (para pruebas y simulaciones).
    Variables: MUN_DATOS (carpeta de datos), PORT.


2. DEMOSTRACIÓN (sin red, con bots)
-----------------------------------
    npm run dev          y abrir  http://localhost:5173/?demo=1
  Parámetros: ?demo=lobby  &bots=0  &pj=4  &minLectura=50  &semilla=7  ?galeria=evento|historico|mensaje|objeto|trivia|mesa|cuento|personaje
  IMPORTANTE: «npm run build:demo» incluye la demostración y los textos de las trivias con su respuesta.
  Para jugar usa siempre «npm run build» (sin demo): ahí las respuestas NO están en el cliente.
  Capturas de la interfaz (PC, tablet y teléfono, modo horizontal y vertical): docs/capturas/ (14 imágenes).
  Una muestra de un solo archivo, sin instalar nada: ejemplos/muestra-juego.html (se abre con doble clic).


3. SERVIDOR: PC, BANCO O RASPBERRY PI
-------------------------------------
  Tres lugares posibles (el programa es el mismo):
    a) el PC de alguien que no juega;
    b) el PC del jugador que hace de banco (si ese PC se apaga, se detiene el servidor);
    c) una Raspberry Pi que solo guarda y reparte el estado (recomendado; no necesita pantalla ni navegador).
  El «banco» es un ROL guardado en el servidor: si el dispositivo del banco se desconecta, la partida SIGUE
  (cualquiera puede tirar los dados de los NPC). El banco tiene un panel para corregir errores (dar o quitar dinares y
  noches, repartir o barajar cartas, tirar por los NPC, pasar turno, eliminar, ceder el banco).

  Raspberry Pi OS (ARM 32 o 64 bits), Node 18/20/22: usa poca CPU y unos 55 MB de RAM. Sin dependencias nativas.
    En el PC:   npm install && npm run build && npm run empaquetar      (crea ./paquete-servidor/)
    En la Pi:   copiar paquete-servidor/ y ejecutar  npm install --omit=dev && npm start

  Arranque automático (systemd): archivo /etc/systemd/system/mil-y-una-noches.service

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
      [Install]
      WantedBy=multi-user.target

      sudo systemctl daemon-reload && sudo systemctl enable --now mil-y-una-noches
      journalctl -u mil-y-una-noches -n 30        (muestra la dirección y el PIN)

  Red: todos en la misma red local, SIN «aislamiento de clientes» en el Wi-Fi (frecuente en redes de invitados);
  puerto TCP 8080 abierto. Sin router: usa la Pi o un teléfono como punto de acceso Wi-Fi. No hace falta internet para jugar.


4. QUÉ INCLUYE EL JUEGO
-----------------------
  Reglas completas del reglamento extendido: viajes y tarifas, noches de llegada con multiplicador por ronda, hospedaje,
  mercado y objetos (efectos automáticos), tratos, trueque, venta y robo; combate, duelos y rechazos (R 11), robos (R 12),
  Asesinos y subasta de contratos (R 13), retos y misiones (R 14), tesoros y Jorasán (R 16), Yafar NPC y Yafar como jugador
  (R 20), modo solitario (R 21), cartas de evento y eventos históricos, mensajes de sheijs (uno a la vez, sin repetirse),
  trivias CC/CRP y cuentos de ambiente, economía, muerte y eliminación, victoria única a 1.001 noches con pantalla final,
  registro de eventos, «Acerca de» con créditos, panel del banco.
  Las reglas del juego no se cambian desde el código: la fuente es el reglamento extendido. Reglas de la casa y ajustes
  (p. ej. la cimitarra) están en src/data/config.json (reglasCasa, armas) y se explican en plan-juego-web.md, sección 8.

  Interfaz: tablero vectorial con arrastre y zoom (pellizco o rueda), minimapa y «centrar en mi personaje»; peones
  pseudo-3D con sombra; dados rojos sincronizados con modal de resultado (al cerrarlo uno desaparecen para todos);
  cartas en modal de lectura de 5 s con barra descendente y «Última carta»; menú de personajes; mano privada.

  Cartas siempre bajo demanda: el cliente no carga las más de 190 cartas. Solo hay UNA carta completa montada a la vez y
  se destruye al cerrarla; solo queda su dato en el historial. Comprobado: tras abrir y cerrar 100 cartas el DOM y las
  imágenes no crecen; 180 cartas sin texto desbordado. Las ilustraciones son 23 WebP de categoría (≈8 KB c/u).
  Privacidad: el servidor envía a cada cliente una vista filtrada (nunca manos, opciones privadas ni respuestas ajenas).


5. TABLERO NÍTIDO EN CUALQUIER ZOOM
-----------------------------------
  - Tablero 100 % vectorial (SVG), generado desde Natural Earth con el texto convertido a trazos; sin imágenes raster.
  - Peones, dados, iconos y marcadores también son SVG.
  - Zoom limitado por nitidez:  z_min = max(Fu/(0,60·W), Fv/(1,15·H));  z_max = max(min(min(Fu,Fv)/220, 10/DPR), 3·z_min)
  - Durante el gesto solo se mueve una transformación GPU (sin re-render de React); al soltar se «confirma» el vector.
  - No se muestra el tablero entero: arrastre, pellizco/rueda, minimapa, «centrar en mi personaje».
  - Verificado a DPR 1/2/3 y con el lienzo girado (pan y pellizco siguen al dedo).
  - Regenerar: python3 tools/build_board_svg.py


6. PRUEBAS
----------
    npm test                         motor (reglas, privacidad, empate/victoria, veneno, cimitarra), cuentos, mensajes,
                                     48 partidas aleatorias completas con serializar/restaurar, y servidor real
    npm run simular                  partidas completas por WebSocket con varios clientes: 4 jugadores hasta 1.001 noches,
                                     solitario con Yafar, 8 jugadores y 3 + NPC difícil (servidor con --rapido)
    node tests/sim.mjs 6000          6000 partidas aleatorias (1 a 8 jugadores) sin excepciones ni bloqueos
    tests/navegador/*.py             Chrome headless con Playwright para Python (pip install playwright; usa Chrome instalado).
                                     Demo en http://127.0.0.1:4173 tras «npm run build:demo && npx vite preview --port 4173»
                                     (01, 03, 04, 05, 06, 08, 09, 10); la 07 usa el servidor real en :8090:
                                     npm run build && node server/index.js --puerto 8090 --datos /tmp/mun-07 --nuevo --sin-qr
                                     10 = vista horizontal/vertical en teléfono, tablet y PC (gestos, modales, paneles).


7. ESTRUCTURA
-------------
    server/   servidor HTTP + WebSocket      shared/  motor de reglas autoritativo (compartido con la demo)
    src/      cliente React                  public/  SVG, arte, dorsos, fuentes
    tools/    generadores (solo desarrollo)  tests/   pruebas
    docs/capturas/  capturas de la interfaz
    ejemplos/muestra-juego.html  muestra de un solo archivo
    fallback/cartas-completas/  PNG completos, opcionales (no entran al build)
  No se incluyen node_modules/, dist/, package-lock.json ni datos/ (se generan con npm install / npm run build / al jugar).


8. CRÉDITOS
-----------
  Diseño y redacción: Jorge Montes Carrillo.
  Publicado por la Biblioteca Ibn Hazm de México / gracias a Mullah Khalid Montes.
  (También en «Acerca de» dentro del juego.)
