// Aviso antes de viajar con burro fuera de su zona (Jorge, 10 de noviembre). La regla vive en shared/objetos.js.
import { avisoBurro } from '../../shared/objetos.js';
export const confirmarViajeBurro = (s, destino) => { const t = avisoBurro({ mano: s?.mano || [] }, destino); return !t || window.confirm(t); };
