// Lo que llevas, para la barra de abajo (Jorge, 12 de noviembre): armas, transporte y dados. Las destrezas se ven en Personajes.
const ARMAS = { cimitarra: 'Cimitarra', alfanje: 'Alfanje', jambiya: 'Jambiya', arco: 'Arco' };
const TRANSPORTE = { caballo: 'Caballo', camello: 'Camello', burro: 'Burro', caballoMongol: 'Caballo mongol', alfombra: 'Alfombra mágica' };
const DADOS = { dadosCairo: 'Dados del Cairo', dadosPersia: 'Dados de Persia' };
export function equipo(s) {
  const mano = (s?.mano || []).filter((c) => c.tipo === 'item');
  const n = (ref) => mano.filter((c) => c.ref === ref).length;
  const lista = (mapa) => Object.entries(mapa).filter(([ref]) => n(ref)).map(([ref, nom]) => (n(ref) > 1 ? `${nom} (${n(ref)})` : nom));
  const armas = lista(ARMAS).map((x) => (x === 'Arco' ? `Arco (${n('flechas')} flecha${n('flechas') === 1 ? '' : 's'})` : x));
  return { armas, transporte: lista(TRANSPORTE), dados: lista(DADOS) };
}
export function textoEquipo(s) {
  const q = equipo(s);
  return [`Armas: ${q.armas.join(', ') || 'ninguna'}`, `Transporte: ${q.transporte.join(', ') || 'ninguno'}`, `Dados: ${q.dados.join(', ') || 'ninguno'}`].join(' · ');
}
