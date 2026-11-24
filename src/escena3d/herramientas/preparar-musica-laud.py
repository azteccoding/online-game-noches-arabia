#!/usr/bin/env python3
"""Canción de Jamil (Jorge, 24 de noviembre): «debe empezar en el segundo 15 y durar 20 segundos».

Corta ese tramo de la pieza completa y lo deja en public/sonidos/laud-jamil.mp3, con el final ya fundido: así dura lo mismo en
cualquier equipo y no hace falta adelantar el audio en el navegador (el servidor del juego no lo permitía).

Uso:  python3 src/escena3d/herramientas/preparar-musica-laud.py <pieza-completa.mp3> [desde] [dura]
La pieza completa es Freesound #182730 (ver public/sonidos/CREDITOS.md); necesita ffmpeg.
"""
import subprocess, sys
from pathlib import Path

DESDE, DURA, ENTRADA, FUNDIDO = 15.0, 20.0, 0.04, 1.2      # segundos

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    desde = float(sys.argv[2]) if len(sys.argv) > 2 else DESDE
    dura = float(sys.argv[3]) if len(sys.argv) > 3 else DURA
    salida = Path(__file__).resolve().parents[3] / 'public' / 'sonidos' / 'laud-jamil.mp3'
    filtros = f'afade=t=in:st=0:d={ENTRADA},afade=t=out:st={dura - FUNDIDO}:d={FUNDIDO}'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(desde), '-t', str(dura), '-i', sys.argv[1], '-af', filtros,
                    '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '192k', str(salida)], check=True)
    print(f'{salida}: del segundo {desde:g} al {desde + dura:g} ({salida.stat().st_size // 1024} KB)')

if __name__ == '__main__':
    main()
