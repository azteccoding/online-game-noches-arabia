"""Texto -> path SVG (sin depender de fuentes en el navegador).
Usa HarfBuzz (uharfbuzz) para el modelado del árabe (formas contextuales, ligaduras) y fontTools para los contornos.
Dependencias SOLO de herramientas (no van en el cliente): pip install fonttools uharfbuzz"""
import os
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fuentes')
_cache = {}


def _font(fn):
    if fn not in _cache:
        p = os.path.join(FONTS, fn)
        face = hb.Face(hb.Blob.from_file_path(p))
        tt = TTFont(p)
        _cache[fn] = (hb.Font(face), tt, tt.getGlyphSet(), tt.getGlyphOrder(), tt['head'].unitsPerEm)
    return _cache[fn]


def text_path(text, fn, size, x=0.0, y=0.0, anchor='start', spacing=0.0, rtl=False, prec=1):
    """Devuelve (d, ancho). (x, y) es el punto de la línea base; anchor: start|middle|end. spacing en unidades de salida."""
    hf, tt, gs, order, upem = _font(fn)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    if rtl:
        buf.direction = 'rtl'
    hb.shape(hf, buf, {'kern': True, 'liga': True, 'calt': True, 'init': True, 'medi': True, 'fina': True, 'rlig': True})
    sc = size / upem
    glyphs = []
    pen_x = 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        glyphs.append((order[info.codepoint], pen_x + pos.x_offset * sc, pos.y_offset * sc))
        pen_x += pos.x_advance * sc + spacing
    width = pen_x - spacing if glyphs else 0.0
    ox = x - (width / 2 if anchor == 'middle' else width if anchor == 'end' else 0.0)
    out = []
    for name, gx, gy in glyphs:
        sp = SVGPathPen(gs, ntos=lambda v: ('%.*f' % (prec, v)).rstrip('0').rstrip('.') if prec else '%d' % round(v))
        gs[name].draw(TransformPen(sp, (sc, 0, 0, -sc, ox + gx, y - gy)))
        c = sp.getCommands()
        if c:
            out.append(c)
    return ''.join(out), width


def text_group(text, fn, size, x, y, anchor='middle', fill='#2b130c', halo=None, halo_w=0, spacing=0.0, rtl=False, rot=0, opacity=None, prec=1):
    d, w = text_path(text, fn, size, x, y, anchor, spacing, rtl, prec)
    if not d:
        return ''
    a = f' opacity="{opacity}"' if opacity is not None else ''
    tr = f' transform="rotate({rot} {x:.0f} {y:.0f})"' if rot else ''
    if halo:
        return f'<g{tr}{a}><path d="{d}" fill="{halo}" stroke="{halo}" stroke-width="{halo_w}" stroke-linejoin="round"/><path d="{d}" fill="{fill}"/></g>'
    return f'<path d="{d}" fill="{fill}"{tr}{a}/>'


# ---- Modo «glifos compartidos»: cada glifo se define una vez (<path id>) y se coloca con <use> (reduce el peso ~4x) ----
GLYPHS = {}
GLYPH_UNIT = 100.0
YSIGN = 1


def glyph_id(fn, name):
    key = (fn, name)
    if key not in GLYPHS:
        hf, tt, gs, order, upem = _font(fn)
        sp = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.') if abs(v) >= 1 or v == 0 else ('%.2f' % v).rstrip('0').rstrip('.'))
        k = GLYPH_UNIT / upem
        gs[name].draw(TransformPen(sp, (k, 0, 0, -k, 0, 0)))
        GLYPHS[key] = ('g%d' % len(GLYPHS), sp.getCommands())
    return GLYPHS[key]


def glyph_defs():
    return '<defs>' + ''.join(f'<path id="{i}" d="{d}"/>' for i, d in GLYPHS.values() if d) + '</defs>'


def text_use(text, fn, size, x, y, anchor='middle', fill='#2b130c', halo=None, halo_w=0, spacing=0.0, rtl=False, rot=0, opacity=None):
    hf, tt, gs, order, upem = _font(fn)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    if rtl:
        buf.direction = 'rtl'
    hb.shape(hf, buf, {'kern': True, 'liga': True, 'calt': True, 'init': True, 'medi': True, 'fina': True, 'rlig': True})
    sc = GLYPH_UNIT / upem
    k = size / GLYPH_UNIT
    pen = 0.0
    items = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        gid, d = glyph_id(fn, order[info.codepoint])
        if d:
            items.append((gid, pen + pos.x_offset * sc, -pos.y_offset * sc * YSIGN))
        pen += pos.x_advance * sc + spacing / k
    width = (pen - spacing / k) if items else 0.0
    ox = -(width / 2 if anchor == 'middle' else width if anchor == 'end' else 0.0)
    r = lambda v: ('%.1f' % v).rstrip('0').rstrip('.')
    uses = ''.join(f'<use href="#{g}" x="{r(ox+gx)}"' + (f' y="{r(gy)}"' if gy else '') + '/>' for g, gx, gy in items)
    tr = f'translate({x:.1f},{y:.1f})' + (f' rotate({rot})' if rot else '') + f' scale({k:.4f})'
    a = f' opacity="{opacity}"' if opacity is not None else ''
    if halo:
        return f'<g transform="{tr}"{a}><g fill="{halo}" stroke="{halo}" stroke-width="{halo_w / k:.1f}" stroke-linejoin="round">{uses}</g><g fill="{fill}">{uses}</g></g>'
    return f'<g transform="{tr}" fill="{fill}"{a}>{uses}</g>'
