// Jorge (27 nov): en todas las cartas, cada frase en su renglón. Se parte tras «.», «!», «?» o «…» (con comillas o paréntesis
// de cierre) cuando sigue una mayúscula, un número o «¿ ¡ «». No se parte tras una abreviatura de una sola letra minúscula
// («518 a. C.», «622 d. C.»). Los saltos de línea que ya trae el texto se respetan.
const CORTE = /([.!?…]["»”')\]]*)([ \t]+)(?=[¿¡«"“(]?[A-ZÁÉÍÓÚÜÑ0-9])/g;
export function conSaltos(texto) {
  if (typeof texto !== 'string' || !texto) return texto;
  return texto.replace(CORTE, (m, fin, esp, pos, s) => {
    const antes = s.slice(Math.max(0, pos - 3), pos);
    if (fin === '.' && /(^|[\s(])[a-zñ]$/.test(antes)) return m;      // «a. C.», «d. C.»
    return fin + '\n';
  });
}
