// Lo más que se puede ganar en cada reto, en dinares y noches, para la ficha de la ciudad (Jorge, 12 de noviembre de 2026).
// Sale del premio de cada reto (src/data/retos.json). Solo están los retos cuyo premio es únicamente dinares y noches; los que dan objetos,
// destrezas, viajes o dependen de otras cosas se muestran sin cifra hasta que Jorge diga cómo resumirlos.
export const PREMIO_MAX = {
  R3: { dinares: 30 },               // dado × 5
  R8: { dinares: 50, noches: 20 },
  R10: { dinares: 70, noches: 15 },
  R11: { dinares: 100, noches: 50 },
  R12: { dinares: 120, noches: 60 },
  R13: { dinares: 150, noches: 80 },
  R15: { noches: 200 },              // solo el primer contratante
  R16: { noches: 300 },
  R22: { dinares: 30, noches: 15 },
  R23: { dinares: 120 },             // 40 por saco, 3 sacos
  R24: { dinares: 30 },
  R26: { dinares: 25, noches: 20 },
  R28: { dinares: 45, noches: 10 },
  R29: { dinares: 40, noches: 15 },
  R30: { dinares: 60, noches: 15 },
  R33: { dinares: 35, noches: 10 },
  R35: { dinares: 70, noches: 20 },
  R38: { dinares: 30 },
  R39: { dinares: 45, noches: 10 },
  R45: { dinares: 40, noches: 10 },  // 10 + 5 por punto del dado
};
// Jorge (12 de noviembre): los demás, con una o dos palabras (tres si hace falta) de lo que dan.
export const PREMIO_TEXTO = {
  R1: 'animal y dinares', R2: 'astrolabio y caballo', R4: 'valor de libros', R5: 'camello y dinares', R6: 'dinares y libro', R7: 'dinares y viaje gratis',
  R9: 'dinares o mapa', R14: 'dinares y Kanmakán', R17: 'compra alfombras', R18: 'entrena cimitarra', R19: 'entrena jambiya', R20: 'compra velo',
  R21: 'dinares o mapa', R25: 'destreza bélica', R27: 'da veneno', R31: 'dinares y botín', R32: 'dinares y botín', R34: 'botella de genio',
  R36: 'dinares y botín', R37: 'dinares y Cuentos extra', R40: 'carta de Ifrit', R41: 'Ídolo de Toledo', R42: 'entrena alfanje', R43: 'entrena arco',
  R44: 'noches y dado', R46: 'aprende persa', R47: 'aprende árabe', R48: '4 por noche', R49: '4 por noche', R50: '150 por yegua',
  R51: 'campeón de arco',
};
export function textoPremio(id) {
  const p = PREMIO_MAX[id]; if (!p) return PREMIO_TEXTO[id] || '';
  const partes = [p.dinares && `${p.dinares} dinares`, p.noches && `${p.noches} noches`].filter(Boolean);
  return 'hasta ' + partes.join(' y ');
}
