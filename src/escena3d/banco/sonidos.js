// ============================================================================================================
//  RANURAS DE SONIDO de la escena 3D (y del juego 3D) de «Mil y Una Noches»
//  Cada ranura es un momento de la escena. Para enchufar un sonido, cambia  null  por la URL del archivo, por
//  ejemplo:   'dados-lanzar': '/sonidos/dados-lanzar.mp3',
//  También vale con volumen propio:   'amanecer': { archivo: '/sonidos/amanecer.mp3', volumen: 0.6 },
//  Sirven .mp3, .ogg, .wav o .m4a. Si la ranura queda en null suena el provisional sintetizado, si lo hay
//  (marcado con *), o nada. Las de ambiente y las marcadas «bucle» se repiten mientras dura lo que acompañan;
//  las demás suenan una vez por evento. La tabla se pasa a crearEscena(…, { sonidos: SONIDOS }).
// ============================================================================================================
const S = '/sonidos/';     // archivos en public/sonidos (créditos y licencias en public/sonidos/CREDITOS.md)
export const SONIDOS = {
  // --- Dados
  'dados-lanzar': { archivos: [S + 'dados-lanzar.mp3'], volumen: 0.8 },      //   al soltar una fila de dados sobre la bandeja
  'dados-golpe': { archivos: [S + 'dado-golpe-1.mp3', S + 'dado-golpe-2.mp3', S + 'dado-golpe-3.mp3', S + 'dado-golpe-4.mp3', S + 'dado-golpe-5.mp3', S + 'dado-golpe-6.mp3'], volumen: 0.7 },       // * cada choque de un dado contra el fieltro, la madera u otro dado
  'dados-arena': { archivos: [S + 'dado-arena-1.mp3', S + 'dado-arena-2.mp3', S + 'dado-arena-3.mp3', S + 'dado-arena-4.mp3', S + 'dado-arena-5.mp3'], volumen: 0.7 },       //   con los dados sobre el mapa: cada golpe de un dado contra la arena (si queda en null, suena 'dados-golpe')
  'dados-agua': null,        // * con los dados sobre el mapa: cada golpe de un dado que cae en el mar (chapoteo)
  'dados-resultado': null,   //   cuando la última fila de la tirada queda quieta
  // --- Fichas
  'ficha-elegir': null,      //   al elegir una ficha (lo toca la interfaz: escena.tocar('ficha-elegir'))
  'ficha-viaje': { archivos: [S + 'pasos-1.mp3', S + 'pasos-2.mp3', S + 'pasos-3.mp3', S + 'pasos-4.mp3'], volumen: 0.8 },       // * cada paso de la figura mientras camina por la ruta
  'ficha-llegada': { archivos: [S + 'pasos-1.mp3', S + 'pasos-3.mp3'], volumen: 0.9 },     // * cuando la figura llega a la ciudad de destino
  // --- Ronda: día y noche
  'anochecer': null,         //   al empezar transicionRonda(), cuando empieza a caer la tarde
  'ronda-nueva': null,       //   cuando se avisa la ronda nueva (alCambiarRonda), ya de noche
  'amanecer': { archivos: [S + 'gallo.mp3'], volumen: 0.5 },          //   cuando empieza a amanecer la ronda nueva
  'ambiente-dia': { archivos: [S + 'pajaros.mp3'], volumen: 0.35 },      //   bucle de fondo mientras es de día
  'ambiente-noche': { archivos: [S + 'grillos.mp3'], volumen: 0.35 },    //   bucle de fondo mientras es de noche
  // --- Peleas (solo animación)
  'pelea-inicio': { archivos: [S + 'desenvainar.mp3'], volumen: 0.9 },      //   al empezar pelear(), cuando las figuras se encaran y sacan el arma
  'pelea-cimitarra': { archivos: [S + 'tajo-1.mp3', S + 'tajo-2.mp3'], volumen: 0.8 },   // * cada tajo de cimitarra, al empezar el barrido
  'pelea-jambiya': { archivos: [S + 'estocada-1.mp3', S + 'estocada-2.mp3'], volumen: 0.8 },     // * cada estocada de jambiya
  'pelea-alfanje': { archivos: [S + 'tajo-pesado.mp3'], volumen: 0.9 },     // * cada golpe pesado de alfanje, al descargarlo
  'pelea-punos': { archivos: [S + 'punetazo-1.mp3', S + 'punetazo-2.mp3'], volumen: 0.9 },       // * cada puñetazo o empujón (sin armas), en el momento del contacto
  'arco-tensar': null,       //   al tensar el arco
  'arco-disparo': { archivos: [S + 'arco-disparo.mp3'], volumen: 0.9 },      // * al soltar la flecha
  'flecha-impacto': { archivos: [S + 'flecha-clavada.mp3'], volumen: 0.8 },    // * cuando la flecha esquivada se clava en el suelo
  'flecha-acierto': { archivos: [S + 'flecha-acierto.mp3'], volumen: 0.9 },    //   cuando la flecha da en el blanco (dispararFlecha con acierta: true)
  'choque-metal': { archivos: [S + 'choque-espadas-1.mp3', S + 'choque-espadas-2.mp3', S + 'choque-espadas-3.mp3'], volumen: 0.8 },      // * cuando una hoja para un golpe o desvía una flecha (salen chispas)
  'golpe-suelo': { archivos: [S + 'golpe-suelo.mp3'], volumen: 0.9 },       // * cuando el alfanje, esquivado, golpea el suelo
  'escudo-bloqueo': { archivos: [S + 'escudo-bloqueo.mp3'], volumen: 0.9 }, //   cuando el golpe pesado da en el escudo de quien lo lleva
  'esquiva': { archivos: [S + 'tajo-2.mp3'], volumen: 0.45 },           //   cuando una figura sin hoja esquiva un tajo o una estocada
  'pelea-fin': { archivos: [S + 'envainar.mp3'], volumen: 0.6 },         //   cuando las figuras guardan el arma y vuelven a su sitio
  // --- Mar y dhow
  'mar-olas': { archivos: [S + 'olas-1.mp3', S + 'olas-2.mp3'], volumen: 0.3 },          // * oleaje suave: al acercarse la figura a la orilla para embarcar
  'barco-zarpar': { archivos: [S + 'barco-zarpar.mp3'], volumen: 0.6 },      // * cuando el dhow suelta amarras con la figura a bordo
  'barco-navegar': { archivos: [S + 'barco-navegar.mp3'], volumen: 0.6 },     //   bucle mientras el dhow cruza con la figura a bordo
  'barco-llegar': { archivos: [S + 'barco-llegar.mp3'], volumen: 0.6 },      // * cuando el dhow fondea en el puerto de llegada
  // --- Monturas y alfombra
  'caballo-galope': { archivos: [S + 'galope-1.mp3', S + 'galope-2.mp3', S + 'galope-3.mp3'], volumen: 0.6 },    // * cada batida del galope del caballo
  'caballo-mongol': { archivos: [S + 'mongol-1.mp3', S + 'mongol-2.mp3'], volumen: 0.6 },    // * cada batida del paso corto y rápido del caballo mongol
  'camello-paso': { archivos: [S + 'pata-camello-1.mp3', S + 'pata-camello-2.mp3'], volumen: 0.6 },      // * cada pisada del camello
  'burro-trote': { archivos: [S + 'casco-burro-1.mp3', S + 'casco-burro-2.mp3', S + 'casco-burro-3.mp3', S + 'casco-burro-4.mp3'], volumen: 0.6 },       // * cada batida del trote del burro
  'camello-montar': { archivos: [S + 'camello-grunido.mp3'], volumen: 0.6 }, //   al montar el camello para salir de viaje
  'burro-rebuzno': { archivos: [S + 'rebuzno-burro.mp3'], volumen: 0.7 },     //   al montar el burro para salir de viaje
  'alfombra-despegue': { archivos: [S + 'alfombra-despegue.mp3'], volumen: 0.7 }, // * cuando la alfombra se desenrolla y se eleva
  'alfombra-vuelo': { archivos: [S + 'alfombra-vuelo.mp3'], volumen: 0.5 },    //   bucle mientras la alfombra vuela
  'alfombra-guardar': { archivos: [S + 'alfombra-guardar.mp3'], volumen: 0.6 },  // * cuando la alfombra se enrolla y se guarda al llegar
  // --- Incendio (ciudades quemadas)
  'fuego-ardiendo': { archivos: [S + 'fuego.mp3'], volumen: 0.8 },    // * bucle mientras arde alguna ciudad: el volumen sube al acercar la cámara al incendio y de lejos casi no se oye
  // --- Ifrit
  'ifrit-lampara': { archivos: [S + 'genio-lampara.mp3'], volumen: 0.8 },     //   cuando aparece la lámpara y empieza a temblar y a humear
  'ifrit-aparece': { archivos: [S + 'genio-aparece.mp3'], volumen: 0.9 },     //   cuando el genio brota de la lámpara
  'ifrit-ambiente': null,    //   bucle mientras el genio está fuera
  'ifrit-se-esconde': { archivos: [S + 'genio-se-esconde.mp3'], volumen: 0.8 },  //   cuando el genio es absorbido y la lámpara se cierra y desaparece
  // --- Momentos del juego (los toca la interfaz, no la escena)
  'muerte': { archivos: [S + 'muerte.mp3'], volumen: 0.85 },            //   cuando un personaje muere y su figura se retira del mapa
  'monedas': { archivos: [S + 'monedas.mp3'], volumen: 0.7 },           //   cuando te suben los dinares (ya con la carta cerrada)
  'monedas-pagar': { archivos: [S + 'monedas-pagar.mp3'], volumen: 0.5 }, //   cuando pagas o te bajan los dinares
  'carta-voltear': null,     // * al girar el dorso de una carta
  'carta-tormenta': { archivos: [S + 'tormenta.mp3'], volumen: 0.7 },    //   al mostrarse la carta (ver SONIDO_CARTA en src/game/sonidos3d.js)
  'carta-mar': { archivos: [S + 'olas-carta.mp3'], volumen: 0.6 },
  'carta-acero': { archivos: [S + 'desenvainar.mp3'], volumen: 0.7 },
  'carta-torneo': { archivos: [S + 'choque-espadas-1.mp3', S + 'choque-espadas-3.mp3'], volumen: 0.7 },
  'carta-misterio': { archivos: [S + 'genio-lampara.mp3'], volumen: 0.6 },
};
