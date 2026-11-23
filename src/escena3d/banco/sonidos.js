// ============================================================================================================
//  RANURAS DE SONIDO de la escena 3D de «Mil y Una Noches»
//  Cada ranura es un momento de la escena. Para enchufar un sonido, cambia  null  por la URL del archivo, por
//  ejemplo:   'dados-lanzar': '/sonidos/dados-lanzar.mp3',
//  También vale con volumen propio:   'amanecer': { archivo: '/sonidos/amanecer.mp3', volumen: 0.6 },
//  Sirven .mp3, .ogg, .wav o .m4a. Si la ranura queda en null suena el provisional sintetizado, si lo hay
//  (marcado con *), o nada. Las de ambiente y las marcadas «bucle» se repiten mientras dura lo que acompañan;
//  las demás suenan una vez por evento. La tabla se pasa a crearEscena(…, { sonidos: SONIDOS }).
// ============================================================================================================
export const SONIDOS = {
  // --- Dados
  'dados-lanzar': null,      //   al soltar una fila de dados sobre la bandeja
  'dados-golpe': null,       // * cada choque de un dado contra el fieltro, la madera u otro dado
  'dados-resultado': null,   //   cuando la última fila de la tirada queda quieta
  // --- Fichas
  'ficha-elegir': null,      //   al elegir una ficha (lo toca la interfaz: escena.tocar('ficha-elegir'))
  'ficha-viaje': null,       // * cada paso de la figura mientras camina por la ruta
  'ficha-llegada': null,     // * cuando la figura llega a la ciudad de destino
  // --- Ronda: día y noche
  'anochecer': null,         //   al empezar transicionRonda(), cuando empieza a caer la tarde
  'ronda-nueva': null,       //   cuando se avisa la ronda nueva (alCambiarRonda), ya de noche
  'amanecer': null,          //   cuando empieza a amanecer la ronda nueva
  'ambiente-dia': null,      //   bucle de fondo mientras es de día
  'ambiente-noche': null,    //   bucle de fondo mientras es de noche
  // --- Peleas (solo animación)
  'pelea-inicio': null,      //   al empezar pelear(), cuando las figuras se encaran y sacan el arma
  'pelea-cimitarra': null,   // * cada tajo de cimitarra, al empezar el barrido
  'pelea-jambiya': null,     // * cada estocada de jambiya
  'pelea-alfanje': null,     // * cada golpe pesado de alfanje, al descargarlo
  'pelea-punos': null,       // * cada puñetazo o empujón (sin armas), en el momento del contacto
  'arco-tensar': null,       //   al tensar el arco
  'arco-disparo': null,      // * al soltar la flecha
  'flecha-impacto': null,    // * cuando la flecha esquivada se clava en el suelo
  'flecha-acierto': null,    //   cuando la flecha da en el blanco (dispararFlecha con acierta: true)
  'choque-metal': null,      // * cuando una hoja para un golpe o desvía una flecha (salen chispas)
  'golpe-suelo': null,       // * cuando el alfanje, esquivado, golpea el suelo
  'esquiva': null,           //   cuando una figura sin hoja esquiva un tajo o una estocada
  'pelea-fin': null,         //   cuando las figuras guardan el arma y vuelven a su sitio
  // --- Mar y dhow
  'mar-olas': null,          // * oleaje suave: al acercarse la figura a la orilla para embarcar
  'barco-zarpar': null,      // * cuando el dhow suelta amarras con la figura a bordo
  'barco-navegar': null,     //   bucle mientras el dhow cruza con la figura a bordo
  'barco-llegar': null,      // * cuando el dhow fondea en el puerto de llegada
  // --- Monturas y alfombra
  'caballo-galope': null,    // * cada batida del galope del caballo
  'caballo-mongol': null,    // * cada batida del paso corto y rápido del caballo mongol
  'camello-paso': null,      // * cada pisada del camello
  'burro-trote': null,       // * cada batida del trote del burro
  'burro-rebuzno': null,     //   al montar el burro para salir de viaje
  'alfombra-despegue': null, // * cuando la alfombra se desenrolla y se eleva
  'alfombra-vuelo': null,    //   bucle mientras la alfombra vuela
  'alfombra-guardar': null,  // * cuando la alfombra se enrolla y se guarda al llegar
  // --- Ifrit
  'ifrit-lampara': null,     //   cuando aparece la lámpara y empieza a temblar y a humear
  'ifrit-aparece': null,     //   cuando el genio brota de la lámpara
  'ifrit-ambiente': null,    //   bucle mientras el genio está fuera
  'ifrit-se-esconde': null,  //   cuando el genio es absorbido y la lámpara se cierra y desaparece
};
