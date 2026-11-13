// Sonidos (Jorge, 12 de noviembre de 2026; PRUEBA, sin commit): suenan solo en local (el servidor manda sonidos: true cuando no hay
// MUN_CLAVE) y después de tocar «Activar sonido». Los audios son candidatos de uso libre: juegoMilNoches_src\sonidos-candidatos\FUENTES.txt.
// En TODOS los navegadores: trompetas al iniciar un duelo, escudos al iniciar un ataque a muerte, el sonido del robo, relincho al viajar en
// caballo o caballo mongol, rebuzno al viajar en burro y un grito de dolor cuando alguien muere.
// Solo en el tuyo: caja registradora cuando te suben los dinares y monedas cayendo cuando te bajan.
// Para probar otro candidato, cambia aquí el archivo (están todos en public/sonidos) y vuelve a correr «npm run build».
const ELEGIDOS = {
  duelo: 'duelo-1.ogg',            // elegido por Jorge
  ataque: 'ataque-1.ogg',          // elegido por Jorge
  robo: 'robo-monedas-1.ogg',      // también: robo-monedas-2.ogg, robo-tambor-1.wav, robo-daga-1.wav, robo-daga-2.ogg, robo-campana-1.ogg, robo-campana-2.ogg
  cobro: 'cobro-1.ogg',            // también: cobro-2.wav
  pierde: 'pierde-1.ogg',          // también: pierde-2.ogg
  caballo: 'caballo-1.ogg',        // también: caballo-2.oga
  burro: 'burro-1.ogg',            // también: burro-2.wav
  muerte: 'muerte-1.wav',          // también: muerte-2.wav, muerte-3.ogg
};
const ruta = (tipo) => `/sonidos/${ELEGIDOS[tipo]}`;
const MENORES = ['cobro', 'pierde'];   // los del dinero ceden el paso: si acaba de sonar otro, no se enciman

// Jorge: el botón, ya activado, también silencia y vuelve a activar. No se recuerda: al recargar la página hay que tocarlo otra vez.
let activado = false, silenciado = false, desbloqueado = false, ultimoMayor = 0;
const oyentes = new Set();
export const sonidoActivado = () => activado;
const avisar = () => { for (const f of oyentes) f(activado); };
export const alCambiarSonido = (f) => { oyentes.add(f); return () => oyentes.delete(f); };

// El navegador no deja sonar nada hasta que la persona toca algo: el botón «Activar sonido» los reproduce en silencio una vez.
export function activarSonido() {
  if (!desbloqueado) {
    for (const tipo of Object.keys(ELEGIDOS)) {
      try { const a = new Audio(ruta(tipo)); a.muted = true; const p = a.play(); if (p?.catch) p.then(() => a.pause()).catch(() => {}); } catch { /* silencio */ }
    }
    desbloqueado = true;
  }
  activado = true; silenciado = false; avisar();
}
export function silenciarSonido() { activado = false; silenciado = true; avisar(); }
export const sonidoSilenciado = () => silenciado;
export function sonar(tipo) {
  if (!ELEGIDOS[tipo] || !activado) return;
  const ahora = Date.now();
  if (MENORES.includes(tipo)) { if (ahora - ultimoMayor < 1500) return; } else ultimoMayor = ahora;
  try { const p = new Audio(ruta(tipo)).play(); if (p?.catch) p.catch(() => {}); } catch { /* el navegador lo bloqueó: silencio, sin error */ }
}
// Líneas del registro que suenan para todos (shared/pelea.js atacar, engine.js viajarPropio, base.js eliminar).
export function sonidoDeLinea(texto) {
  if (/ grita «¡Esto es un asalto!» contra /.test(texto)) return 'robo';
  if (/ ataca a muerte a /.test(texto)) return 'ataque';
  if (/ desafía a duelo a /.test(texto)) return 'duelo';
  if (/ viaja de .+ a .+ en (caballo|caballo mongol)( y termina su turno)?\.$/.test(texto)) return 'caballo';
  if (/ viaja de .+ a .+ en burro( y termina su turno)?\.$/.test(texto)) return 'burro';
  if (/ queda eliminado/.test(texto)) return 'muerte';
  return null;
}
