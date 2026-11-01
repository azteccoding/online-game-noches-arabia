"""Extrae los datos del juego a JSON (src/data/*.json) para que nadie tenga que parsear los Word.

Fuentes (trabajo de diseño, ver docsJuegoMesa/.progreso/scripts):
  - reglamento extendido ensamblado (markdown)  -> ciudades, eventos E/H, mensajes M, retos R4-R27, ifrit, objetos originales
  - objetos.py (mazo de 45 objetos), retos_extra.py (R28-R39), cc_bank.py (80 CC), routes.py / mapgeo.py (tarifas)
Uso:  python3 tools/extract_data.py [ruta_reglamento.md] [carpeta_scripts]
Los JSON ya generados están versionados; este script documenta cómo se obtuvieron y permite regenerarlos.
Los JSON NO referencian PNG de cartas: cada carta lleva su 'arte' (clave de categoría) y el cliente la dibuja con el componente Carta."""
import json, os, re, sys


def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', t.lower().replace('/', '-').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')).strip('-')

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'data')
REG = sys.argv[1] if len(sys.argv) > 1 else '/tmp/build/reg/reglamento.md'
SCR = sys.argv[2] if len(sys.argv) > 2 else '/tmp/build/reg'
sys.path.insert(0, SCR); sys.path.insert(0, os.path.dirname(SCR))
os.makedirs(OUT, exist_ok=True)
md = open(REG, encoding='utf-8').read()


def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    print(name, len(json.dumps(obj)) // 1024, 'KB')


def rows(prefix_re):
    """Filas de tabla markdown cuya primera celda coincide con prefix_re."""
    out = []
    for line in md.split('\n'):
        if line.startswith('|'):
            cells = [c.strip().replace('**', '') for c in line.strip().strip('|').split('|')]
            if cells and re.fullmatch(prefix_re, cells[0]):
                out.append(cells)
    return out


def slug_ok(s):
    return s.replace('·', '').strip()

# ---------------------------------------------------------------- tablero + ciudades
tablero = json.load(open(os.path.join(OUT, 'tablero.json'), encoding='utf-8'))
CIUDADES_REG = {}
for r in rows(r'Bagdad|El Cairo|Isfahán|Basra|Damasco|Yemen|Aleppo|Estambul|Magreb|Andalucía|Samarcanda|India|Jorasán'):
    if len(r) == 6 and r[1][:1].isdigit():
        CIUDADES_REG[r[0]] = r
REGION = {'Andalucía': 'Occidente', 'Magreb': 'Occidente', 'El Cairo': 'Occidente', 'Isfahán': 'Oriente', 'Samarcanda': 'Oriente', 'India': 'Oriente'}
NOCHES = {'Bagdad': (30, 30), 'El Cairo': (15, 15), 'Isfahán': (15, 15), 'Basra': (15, 15), 'Damasco': (10, 10), 'Yemen': (5, 5), 'Aleppo': (5, 5), 'Estambul': (5, 5),
          'Magreb': (50, 5), 'Andalucía': (30, 5), 'Samarcanda': (20, 20), 'India': (25, 25)}
ALOJ = {'Bagdad': 15, 'El Cairo': 5, 'Isfahán': 5, 'Basra': 5, 'Damasco': 5, 'Yemen': 3, 'Aleppo': 3, 'Estambul': 3, 'Magreb': 3, 'Andalucía': 3, 'Samarcanda': 10, 'India': 10}
MAZO = {'Bagdad': 'Bagdad', 'Isfahán': 'Isfahán', 'Aleppo': 'Aleppo', 'Damasco': 'Damasco', 'Basra': 'Basra', 'El Cairo': 'El Cairo'}
ciudades = []
for n, c in tablero['cities'].items():
    reg = CIUDADES_REG.get(n)
    ciudades.append({
        'id': n, 'ar': c['ar'], 'region': REGION.get(n, 'Centro'), 'x': c['x'], 'y': c['y'], 'label': c['label'],
        'nochesLlegada': NOCHES[n][0], 'nochesLuego': NOCHES[n][1], 'alojamiento': ALOJ[n],
        'mazoCC': MAZO.get(n, 'Bagdad'), 'retos': re.findall(r'R\d+', reg[4]) if reg else [],
        'notas': reg[5] if reg else '', 'impuestoVenta': 0 if n == 'Bagdad' else (50 if n == 'Samarcanda' else 20)})
dump('ciudades.json', {'ciudades': ciudades, 'jorasan': {'id': 'Jorasán', 'ar': 'خراسان', 'x': tablero['jorasan']['x'], 'y': tablero['jorasan']['y']}})

# ---------------------------------------------------------------- rutas y tarifas
import importlib.util
spec = importlib.util.spec_from_file_location('mapgeo', os.path.join(HERE, 'mapgeo.py')); mg = importlib.util.module_from_spec(spec); spec.loader.exec_module(mg)
tarifas = {f'{a}>{b}': v for (a, b), v in mg.D.items()}
rutas = [{'a': r['a'], 'b': r['b'], 'modo': r['mode'], 'd': r['d'], 'fares': r['fares'], 'puntos': r['points']} for r in tablero['routes']]
dump('rutas.json', {'tarifas': tarifas, 'rutas': rutas,
                    'caravanasIniciales': [['Bagdad', 'Damasco'], ['Damasco', 'Bagdad'], ['Bagdad', 'Samarcanda']],
                    'nota': 'tarifas[origen>destino] en dinares; ausencia = X (sin ruta directa). Máx. 2 tramos por turno (7.3).'})

# ---------------------------------------------------------------- personajes
PERS = [
 dict(id='1', slug='nur-al-din', nombre='Nur al Din', titulo='El valiente', inicio=dict(dinares=10, ingreso=5), arma=['cimitarra'], destreza=True,
      habilidades=['Reto de honor en El Cairo, Damasco o Aleppo: quien se niegue paga lo que pida.', 'Inmune a robos; no puede robar; la cimitarra no se usa en Bagdad.'], limite='No puede robar.', stats=[2, 3, 5, 2, 3], cita='«Si me aceptas, pelea; si me rechazas, paga.»', refReglamento='10.2'),
 dict(id='2', slug='zein', nombre='Zein al Mawasif', titulo='La hermosa', inicio=dict(dinares=10, ingreso=5), arma=[], destreza=False,
      habilidades=['Noche discreta: con otro jugador de su ciudad gana 25 dinares (10 con Anís) si el esposo no los sorprende.', 'Dados del Cairo: una vez por ronda repite uno de sus dados.'], limite='El esposo puede sorprender a los dos.', stats=[2, 4, 2, 4, 3], cita='«Todos apuestan. Yo cobro.»', refReglamento='10.3'),
 dict(id='3', slug='anis', nombre='Anís', titulo='El joven y guapo', inicio=dict(dinares=10, ingreso=5), arma=[], destreza=False,
      habilidades=['Amigo de Zein: gana 10 dinares (+20 si no lo sorprenden).', 'Por la ventana: una vez por ronda, si lo atacan, con 5 o 6 huye y el agresor pierde su acción.'], limite='Sin armas ni destreza al inicio.', stats=[2, 4, 2, 3, 4], cita='«Siempre hay otra ventana.»', refReglamento='10.4'),
 dict(id='4', slug='jamil', nombre='Jamil al Udhrí', titulo='El poeta', inicio=dict(dinares=10, ingreso=5), arma=[], destreza=False,
      habilidades=['Gana 5 noches por turno sin hacer nada.', 'Viaja gratis de El Cairo a Bagdad; recita crímenes en Bagdad (5 dinares por estrofa) y difama.'], limite='Sin armas ni destreza al inicio.', stats=[4, 5, 1, 2, 3], cita='«Lo que hagas hoy, lo canto mañana.»', refReglamento='10.6'),
 dict(id='5', slug='ruyan', nombre='Sabio Ruyán', titulo='El sabio', inicio=dict(dinares=10, ingreso=5, noches=200), arma=[], destreza=False,
      habilidades=['Empieza con 200 noches y 20 CRP que vende o usa.', 'Cada visitante recibe 50 noches y le paga 5 dinares; viaja gratis de Bagdad a El Cairo.'], limite='Débil; nunca el último en tirar.', stats=[5, 3, 1, 4, 2], cita='«Cincuenta noches por cinco dinares: la ganga más vieja del mundo.»', refReglamento='10.5'),
 dict(id='6', slug='zubayda', nombre='Zubayda', titulo='La del harén', inicio=dict(dinares=10, ingreso=5), arma=[], destreza=False,
      habilidades=['Harén del Califa en Bagdad: termina su turno, gana 15 dinares y no puede ser robada ni asesinada allí.', 'Paga caravanas con servicios (riesgo de apedreo).'], limite='Riesgo de apedreo al prostituirse.', stats=[3, 4, 2, 2, 4], cita='«Cada puerta tiene su precio; yo elijo la moneda.»', refReglamento='10.7'),
 dict(id='7', slug='adi', nombre='Adí hijo de Hatim al Taí', titulo='El rico', inicio=dict(dinares=30, ingreso=10), arma=[], destreza=False,
      habilidades=['Empieza con 30 dinares y gana 10 por turno.', 'Cuentos de noche: ambos ganan 5 dinares y el invitado 10 noches.'], limite='Siempre es el último en el orden de turnos.', stats=[3, 3, 2, 3, 3], cita='«El dinero no lo compra todo; por eso lo gasto en lo que sí.»', refReglamento='10.8'),
 dict(id='B', slug='yafar', nombre='Yafar el Bermekí', titulo='Visir de todos los bolsillos', inicio=dict(dinares=10, ingreso=5, firman=1), arma=['jambiya'], destreza=True,
      habilidades=['Comisión de bolsillo: 5 dinares por cada otro jugador en su ciudad (máx. 15).', 'Paga la mitad de caravanas, sobornos y servicios; empieza con un Firmán.'], limite='Doble alojamiento; blanco de todos; no puede esconder tesoro.', stats=[3, 5, 2, 1, 4], cita='«Todo tiene precio; casi siempre, el tuyo.»', refReglamento='10.1 y 20'),
]
for p in PERS:
    p['sprite'] = f"svg/personajes/{p['id']}-{p['slug']}.svg"
    p['arte'] = 'pj-' + p['id']
    p['statsEtiquetas'] = ['Saber', 'Labia', 'Fuerza', 'Poesía', 'Astucia']
dump('personajes.json', {'personajes': PERS, 'npc': [
    {'id': 'YAFAR_NPC', 'nombre': 'Yafar el Bermekí (NPC)', 'sprite': 'svg/personajes/yafar-npc.svg', 'refReglamento': '20.4'},
    {'id': 'ASESINOS', 'nombre': 'Los Asesinos', 'sprite': 'svg/personajes/asesinos.svg', 'refReglamento': '13'}]})

# ---------------------------------------------------------------- eventos E y H, mensajes M
ev = []
for r in rows(r'E\d+'):
    ev.append({'id': r[0], 'tipo': 'evento', 'nombre': re.sub(r'\s*\(.*', '', r[1]), 'detalle': r[1], 'efecto': r[2], 'arte': 'ev', 'refReglamento': '17.1'})
hist = []
for r in rows(r'H\d+'):
    m = re.match(r'(.*?)\s*\((.*)\)\s*$', r[1])
    nombre = m.group(1) if m else r[1]; ciudades_h = m.group(2) if m else ''
    hist.append({'id': r[0], 'tipo': 'historico', 'nombre': nombre, 'ciudades': ciudades_h, 'efecto': r[2], 'costo': r[3], 'fomenta': r[4], 'arte': 'hi', 'refReglamento': '17.2'})
msg = []
SHEIJ = {'Averroes': 'Cadí Averroes (Dios tenga misericordia de él)', 'Ibn Hazm': 'Sheij Ibn Hazm (Dios tenga misericordia de él)', 'Abu Madyan': 'Sheij Abu Madyan (Dios tenga misericordia de él)', 'Ibn Arabi': 'Sheij al-Akbar Ibn Arabi (Dios esté complacido con él)'}
for r in rows(r'M\d+'):
    de = re.sub(r'\s*\(.*', '', r[1])
    pd = re.match(r'(\d+) dinares(?: \+ (\d+) noches)?', r[3])
    msg.append({'id': r[0], 'de': de, 'honorifico': SHEIJ[de], 'tipoSheij': 'místico' if 'stico' in r[1] else 'jurista', 'encargo': r[2], 'premio': r[3],
                'dinares': int(pd.group(1)) if pd else 0, 'noches': int(pd.group(2)) if pd and pd.group(2) else 0, 'plazoTurnos': 3, 'arte': 'me', 'refReglamento': '18.3'})
assert len(ev) == 12 and len(hist) == 20 and len(msg) == 16, (len(ev), len(hist), len(msg))
dump('eventos.json', {'eventos': ev, 'historicos': hist, 'nota': 'Los efectos están en texto; el motor implementa un subconjunto (ver plan, sección Implementado/Pendiente).'})
dump('mensajes.json', {'mensajes': msg, 'nota': 'Regla oficial 18.2: un solo Mensaje activo por jugador; cada uno de los 16 sale una sola vez por partida (cumplido, vencido o de un eliminado: sale del juego, no se baraja de nuevo); agotados, ya no salen más y un 6 en el ingreso no tiene efecto.'})

# ---------------------------------------------------------------- retos
retos = []
RETO_TXT = {
 'R1': ('Buscar un cofre en el Éufrates', 'Bagdad', 'N, A', '', 'Acepta o rechaza; búsqueda con dado (1 = cofre); deuda con la ciudad.', 'Camello, 50 dinares, caballo, pergamino (30 dinares en Damasco), 50 noches y viaje gratis.', 'Crucifixión (eliminación) si no pagas la deuda.', '14.2'),
 'R2': ('El visir Yafar y el testigo', 'Bagdad', 'C', 'Haber jugado 5 turnos', 'Matar al último jugador que visitó Damasco en 3 turnos.', 'Astrolabio, 100 dinares y alfanje; o recompensa de 60 dinares.', 'Envenenamiento si no devuelves los 50 dinares en 4 turnos.', '14.2'),
 'R3': ('Órdenes del Califa: el ejército de los cristianos', 'Bagdad', 'V', '', 'Viajar a Estambul y volver a Bagdad en 3 turnos o menos.', 'Dado x 5 dinares.', '30 dinares de deuda y riesgo de muerte.', '14.2'),
 'R5': ('Alquimia', 'Bagdad', 'A', '', '4 intentos para convertir un dado en 6.', '50/40/30/20 dinares según el intento y un camello.', 'Si no lo logras: 10 dinares y una brújula.', '14.3'),
 'R6': ('Álgebra en la Madrasa', 'Bagdad', 'A', '', 'Tira 3 dados, promedia hacia abajo; un dado más debe ser ±1.', '50 dinares y 1 libro.', 'Si no: segunda tirada (par 20 dinares) o pagas 1 dinar y tomas 1 libro.', '14.3'),
}
for k, (n, c, t, rq, res, pr, rs, ref) in RETO_TXT.items():
    retos.append({'id': k, 'nombre': n, 'ciudad': c, 'tipo': t, 'requisito': rq, 'resolucion': res, 'premio': pr, 'riesgo': rs, 'objetos': '', 'refReglamento': ref})
for r in rows(r'R\d+(-s\d)?\s.*'):
    pass
for line in md.split('\n'):
    m = re.match(r'\| (R\d+)(?:-s\d)? ([^|]+?) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$', line)
    if m and 4 <= int(m.group(1)[1:]) <= 27:
        i, n, c, t, rq, res, pr = [g.strip() for g in m.groups()]
        retos.append({'id': i, 'nombre': n, 'ciudad': c, 'tipo': t, 'requisito': rq if rq != '-' else '', 'resolucion': res, 'premio': pr, 'riesgo': '', 'objetos': '', 'refReglamento': '14.4'})
from retos_extra import RETOS as RX
for (rid, nombre, ciudad, tipo, req, res, premio, riesgo, objs, humor) in RX:
    retos.append({'id': rid, 'nombre': nombre, 'ciudad': ciudad, 'tipo': tipo, 'requisito': req if req != '-' else '', 'resolucion': res, 'premio': premio, 'riesgo': riesgo, 'objetos': objs, 'humor': humor, 'refReglamento': '14.7', 'añadido': True})
retos.sort(key=lambda x: int(x['id'][1:]))
for r in retos:
    r['arte'] = 're'
ids = [r['id'] for r in retos]
assert ids == [f'R{i}' for i in range(1, 40)], ids
dump('retos.json', {'retos': retos})

# ---------------------------------------------------------------- objetos
from objetos import OBJ, TIPOS
mazo = []
for i, (nom, tipo, cant, val, dur, mom, ef, sirve, merc, humor) in enumerate(OBJ, 1):
    mazo.append({'id': f'OB{i:02d}', 'nombre': nom, 'tipo': tipo, 'copias': cant, 'valor': val, 'duracion': dur, 'momento': mom, 'efecto': ef, 'sirvePara': sirve,
                 'seConsigueEn': merc, 'humor': humor, 'arte': 'ob-' + slug(tipo), 'sinVenta': nom in ('Botella de genio', 'Joya de granate')})
originales = []
for r in rows(r'Caballo|Camello|Burro|Alfombra mágica|Libros, papiros, etc\.|Arco|Flechas|Alfanje|Cimitarra|Jambiya|Veneno|Brújula|Astrolabio|Esclavas.*|Esclavos \(hombres\)|Botellas de vino|Buza|Papel amate|Alfombras de Isfahán|Cesta de manzanas|Sacos de sal|Velo quemado'):
    if len(r) == 3:
        originales.append({'nombre': r[0], 'efecto': r[1], 'precio': r[2]})
ifrit_deseos = {}
for r in rows(r'[A-J]'):
    if len(r) == 2 and len(r[0]) == 1:
        ifrit_deseos[r[0]] = r[1]
ifrit_cartas = []
for r in rows(r'Ifrit \d+'):
    n = int(r[0].split()[1])
    ifrit_cartas.append({'id': f'I{n}', 'deseos': [x.split()[0] for x in r[1:5]], 'arte': 'if'})
especiales = [
    {'id': 'F1', 'nombre': 'Firmán del Califa', 'copias': 3, 'arte': 'es', 'refReglamento': '15.3'},
    {'id': 'K1', 'nombre': 'Ejército de Kanmakán', 'copias': 1, 'arte': 'es', 'refReglamento': '15.5'},
    {'id': 'G1', 'nombre': 'Genio malo', 'arte': 'es', 'refReglamento': '16.4'},
    {'id': 'G2', 'nombre': 'Genio que te ignora', 'arte': 'es', 'refReglamento': '16.4'}]
dump('objetos.json', {'tipos': TIPOS, 'mazo': mazo, 'originales': originales, 'especiales': especiales,
                      'ifrit': {'deseos': ifrit_deseos, 'cartas': ifrit_cartas},
                      'limiteManoObjetos': 5, 'botin': 47, 'mercado': 89, 'refReglamento': '15'})

# ---------------------------------------------------------------- trivias (CC/CRP)
import cc_bank
trivias, mesa = [], []
for c in cc_bank.cards:
    if c['kind'] == 'trivia':
        trivias.append({'id': f"CC-{c['n']:02d}", 'n': c['n'], 'ciudad': c['city'], 'categoria': c['cat'], 'gancho': c['gancho'], 'pregunta': c['q'],
                        'opciones': c['opts'], 'correcta': c['ans'], 'nota': c['nota'], 'premio': 10})
    else:
        mesa.append({'id': f"CC-{c['n']:02d}", 'n': c['n'], 'ciudad': c['city'], 'votacion': c['q'].startswith('Pregunta de votación'), 'pregunta': c['q'], 'comoSeComprueba': c.get('how', ''), 'planB': c.get('planb', ''), 'premio': 10})
assert len(trivias) == 60 and len(mesa) == 20
dump('trivias.json', {'trivias': trivias, 'deMesa': mesa, 'maxPorTurno': 3,
                      'nota': "La respuesta ('correcta' y 'nota') es CRP: el servidor solo la envía tras responder (ver plan, privacidad)."})

# ---------------------------------------------------------------- cuentos de ambiente (7 cartas, premio oficial de 2 dinares al lector)
import ast
_cards = open(os.path.join(SCR, '..', 'game', 'cards.py') if os.path.exists(os.path.join(SCR, '..', 'game', 'cards.py')) else '/tmp/build/game/cards.py', encoding='utf-8').read()
_a = _cards.index('CUENTOS = ['); _b = _cards.index(']\nfor (ciu')
_lista = ast.literal_eval(_cards[_a + 10:_b + 1])
_resp = ('Respuestas', 'R', 'Scheherezade y el sultán', None, 'شهرزاد',
         'Scheherezade cuenta un cuento cada noche y lo corta en lo más interesante para que el sultán la deje vivir un día más. Funciona mil y una noches: el mejor argumento de ventas de la historia.')
cuentos = []
for (ciu, k, titulo, _art, ar, texto) in _lista + [_resp]:
    cuentos.append({'id': 'CU-' + k, 'clave': ciu, 'titulo': titulo, 'sub': ('Cuento de ' + ciu if k != 'R' else 'Cuento de las Respuestas') + ' · carta de ambiente',
                    'texto': texto, 'arabe': ar, 'premio': 2, 'refReglamento': '19.7'})
assert len(cuentos) == 7
dump('cuentos.json', {'cuentos': cuentos, 'premioLector': 2,
                      'nota': "Regla oficial 19.7: cada carta se saca una sola vez por partida; la de una ciudad con la primera CC de ese mazo, la de Respuestas con la primera trivia resuelta. La lee quien la saca y cobra 2 dinares del banco. No cobra un eliminado ni Yafar NPC (que no lee ni cobra); una persona que juega a Yafar el Bermekí sí cobra como cualquier jugador."})

# ---------------------------------------------------------------- configuración numérica
dump('config.json', {
    'meta': 1001, 'dinaresIniciales': 10, 'ingresoTurno': 5, 'premioTrivia': 10, 'premioCuento': 2, 'reglasCasa': {'bonosArmaAmbosBandos': True, 'cimitarraExtraAlAtacar': True, 'defensorQueMataSinBuscado': True, 'mensajesUnoActivo': True, 'mensajesSinRepetir': True, 'yafarNpcNoCobraCuentos': True, 'oficiales': True}, 'maxCCPorTurno': 3, 'armas': {'cimitarra': {'bono': 2, 'extraAtacante': 2, 'precio': 35}, 'alfanje': {'bono': 1, 'precio': 25}, 'arco': {'bono': 1, 'precio': 15}},
    'multiplicadorNoches': [[1, 3, 1], [4, 6, 2], [7, 9, 3], [10, 999, 4]], 'multiplicador7a8Jugadores': [[1, 2, 1], [3, 5, 2], [6, 8, 3], [9, 999, 4]],
    'cinco_noches_por_dinar': 5, 'impuestoVentaPct': 20, 'maxTramosPorTurno': 2, 'primerosTurnosSinMatar': 2,
    'duelo': {'rechazo': 20, 'nochesPerdedor': 30}, 'buscadoRondas': 2, 'recompensaBuscado': 20, 'minimoMensajeDado': 6,
    'refReglamento': {'turno': '6', 'movimiento': '7', 'economia': '8', 'cartas': '9', 'personajes': '10', 'combate': '11', 'robos': '12', 'asesinos': '13', 'retos': '14', 'objetos': '15', 'tesoros': '16', 'eventos': '17', 'mensajes': '18', 'cc': '19', 'yafar': '20', 'solitario': '21', 'jugadores': '22'}})
print('OK')
