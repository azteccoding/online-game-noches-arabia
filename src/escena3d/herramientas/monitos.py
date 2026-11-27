# Versiones de los monitos (Jorge, 23 de noviembre de 2026): cada escaneo de un personaje se guarda con nombre, por ejemplo
# «nur-al-din_v1» o «zubayda_v2», y se puede volver a cualquiera sin rehacerlo.
# Uso, desde la raíz del repositorio:
#     python3 src/escena3d/herramientas/monitos.py lista
#     python3 src/escena3d/herramientas/monitos.py guardar <id> <nombre> [hoja pose-a]   guarda el monito que está puesto ahora
#     python3 src/escena3d/herramientas/monitos.py usar <nombre>                          pone esa versión en el juego
# Una versión vive en src/escena3d/monitos/<nombre>/: fig.webp, busto.webp, elegir.webp (lo que preparar-figuras.py y
# preparar-elegir.py dejan en public/arte3d con el id del personaje), figura.json (su entrada de datos/figuras.json),
# info.json y, si se da, la hoja «-pose-a» de la que salió. Una versión guardada nunca se sobrescribe: para otra, otro nombre.
# Cuál está puesta de cada personaje queda en src/escena3d/datos/monitos.json.
# El <id> es el de la figura en datos/figuras.json: el de un personaje ('1' a '7', 'B', '4t') o el de una figura que no es
# personaje jugable, como 'EP' (el esclavo peleador, 27 de noviembre: solo tiene fig-EP.webp, sin busto ni retrato para elegir).
import sys, os, json, shutil, hashlib, datetime, re

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..', '..'))
A = os.path.join(RAIZ, 'public', 'arte3d')
DATOS = os.path.join(RAIZ, 'src', 'escena3d', 'datos')
V = os.path.join(RAIZ, 'src', 'escena3d', 'monitos')
FIGURAS = os.path.join(DATOS, 'figuras.json')
ACTIVOS = os.path.join(DATOS, 'monitos.json')
ARCHIVOS = (('fig', 'fig'), ('busto', 'busto'), ('elegir', 'elegir'))      # (en public/arte3d: <nombre>-<id>.webp, en la versión: <nombre>.webp)


def leer(ruta, defecto):
    return json.load(open(ruta, encoding='utf8')) if os.path.exists(ruta) else defecto


def escribir(ruta, datos, compacto=False):
    with open(ruta, 'w', encoding='utf8') as f:
        json.dump(datos, f, ensure_ascii=False, separators=(',', ':') if compacto else None, indent=None if compacto else 2)
        f.write('\n')


def lista():
    activos = leer(ACTIVOS, {})
    nombres = sorted(os.listdir(V)) if os.path.isdir(V) else []
    if not nombres: print('No hay versiones guardadas.')
    for n in nombres:
        info = leer(os.path.join(V, n, 'info.json'), {})
        puesto = ' (puesto)' if activos.get(info.get('id')) == n else ''
        print(f"{n}: personaje {info.get('id')}, guardado {info.get('fecha', '?')}{puesto}")


def guardar(pid, nombre, hoja=None):
    if not re.fullmatch(r'[a-z0-9-]+_v\d+', nombre): sys.exit(f'Nombre «{nombre}»: usa el estilo zubayda_v2 (minúsculas, guiones y _v con número).')
    destino = os.path.join(V, nombre)
    if os.path.exists(destino): sys.exit(f'Ya existe la versión {nombre}; no se sobrescribe. Usa otro número.')
    figuras = leer(FIGURAS, {})
    if pid not in figuras: sys.exit(f'No hay figura del personaje {pid} en figuras.json.')
    os.makedirs(destino)
    for en_arte, en_version in ARCHIVOS:
        origen = os.path.join(A, f'{en_arte}-{pid}.webp')
        if os.path.exists(origen): shutil.copy2(origen, os.path.join(destino, f'{en_version}.webp'))
    escribir(os.path.join(destino, 'figura.json'), figuras[pid], compacto=True)
    info = {'nombre': nombre, 'id': pid, 'fecha': datetime.date.today().isoformat()}
    if hoja:
        shutil.copy2(hoja, os.path.join(destino, os.path.basename(hoja)))
        info['hoja'] = os.path.basename(hoja); info['sha256_hoja'] = hashlib.sha256(open(hoja, 'rb').read()).hexdigest()
    escribir(os.path.join(destino, 'info.json'), info)
    activos = leer(ACTIVOS, {}); activos[pid] = nombre; escribir(ACTIVOS, dict(sorted(activos.items())))
    print(f'Guardado {nombre} (personaje {pid}) en {os.path.relpath(destino, RAIZ)}')


def usar(nombre):
    origen = os.path.join(V, nombre)
    if not os.path.isdir(origen): sys.exit(f'No existe la versión {nombre}. Mira las que hay con: monitos.py lista')
    info = leer(os.path.join(origen, 'info.json'), {}); pid = info['id']
    for en_arte, en_version in ARCHIVOS:
        f = os.path.join(origen, f'{en_version}.webp')
        if os.path.exists(f): shutil.copy2(f, os.path.join(A, f'{en_arte}-{pid}.webp'))
    figuras = leer(FIGURAS, {}); figuras[pid] = leer(os.path.join(origen, 'figura.json'), None)
    json.dump(figuras, open(FIGURAS, 'w', encoding='utf8'), ensure_ascii=False)      # el mismo formato que deja preparar-figuras.py
    activos = leer(ACTIVOS, {}); activos[pid] = nombre; escribir(ACTIVOS, dict(sorted(activos.items())))
    print(f'Puesto {nombre} como monito del personaje {pid}.')
    # los monitos de ocho vistas guardados antes del 24 de noviembre no traen el giro continuo entre vistas: se calcula ahora
    # (y los guardados ese día con la primera versión solo traen el corrimiento de lado, sin alturas ni relieve: también)
    if figuras[pid].get('vistas') and not (figuras[pid].get('giro8') and figuras[pid].get('giroEscZ')):
        try:
            import importlib.util
            esp = importlib.util.spec_from_file_location('preparar_giro8', os.path.join(AQUI, 'preparar-giro8.py')); giro = importlib.util.module_from_spec(esp); esp.loader.exec_module(giro)
            giro.preparar(pid)
        except ImportError as e:
            print(f'OJO: falta calcular el giro continuo de {pid} ({e}). Corre: python3 src/escena3d/herramientas/preparar-giro8.py {pid}')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['lista']: lista()
    elif a[:1] == ['guardar'] and len(a) in (3, 4): guardar(a[1], a[2], a[3] if len(a) == 4 else None)
    elif a[:1] == ['usar'] and len(a) == 2: usar(a[1])
    else: sys.exit(__doc__ or 'Uso: monitos.py lista | guardar <id> <nombre> [hoja] | usar <nombre>')
