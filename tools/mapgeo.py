import json, math, random
import os
G = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'geo') + '/'
LON0, LON1, LAT0, LAT1 = -13.0, 79.0, 1.0, 53.0
W, H = 2970, 2100
KX = W/(LON1-LON0); KY = H/(LAT1-LAT0)
def P(lon, lat): return ((lon-LON0)*KX, (LAT1-lat)*KY)

def clip_ring(pts, x0, y0, x1, y1):
    def clip(pts, inside, inter):
        out=[]
        for i in range(len(pts)):
            a=pts[i-1]; b=pts[i]
            ia, ib = inside(a), inside(b)
            if ib:
                if not ia: out.append(inter(a,b))
                out.append(b)
            elif ia: out.append(inter(a,b))
        return out
    def ix(xc): return lambda a,b: (xc, a[1]+(b[1]-a[1])*(xc-a[0])/(b[0]-a[0]))
    def iy(yc): return lambda a,b: (a[0]+(b[0]-a[0])*(yc-a[1])/(b[1]-a[1]), yc)
    for ins,it in [(lambda p:p[0]>=x0,ix(x0)),(lambda p:p[0]<=x1,ix(x1)),(lambda p:p[1]>=y0,iy(y0)),(lambda p:p[1]<=y1,iy(y1))]:
        if not pts: return []
        pts = clip(pts, ins, it)
    return pts

def rdp(pts, eps):
    if len(pts)<3: return pts
    keep=[False]*len(pts); keep[0]=keep[-1]=True; st=[(0,len(pts)-1)]
    while st:
        a,b=st.pop(); (ax,ay),(bx,by)=pts[a],pts[b]; dx,dy=bx-ax,by-ay; L=math.hypot(dx,dy) or 1e-9; md=-1; mi=a
        for i in range(a+1,b):
            d=abs(dy*(pts[i][0]-ax)-dx*(pts[i][1]-ay))/L
            if d>md: md,mi=d,i
        if md>eps: keep[mi]=True; st+= [(a,mi),(mi,b)]
    return [p for p,k in zip(pts,keep) if k]

def rings_of(fn, eps=3.0, margin=80, min_area=300):
    d=json.load(open(G+fn)); out=[]
    for f in d['features']:
        g=f['geometry']
        if not g: continue
        polys = g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
        for poly in polys:
            for ri,ring in enumerate(poly):
                pr=[P(*c[:2]) for c in ring]
                if pr[0]==pr[-1]: pr=pr[:-1]
                xs=[p[0] for p in pr]; ys=[p[1] for p in pr]
                if max(xs)<-margin or min(xs)>W+margin or max(ys)<-margin or min(ys)>H+margin: continue
                c=clip_ring(pr,-margin,-margin,W+margin,H+margin)
                if len(c)<3: continue
                c=rdp(c,eps)
                a=abs(sum(c[i-1][0]*c[i][1]-c[i][0]*c[i-1][1] for i in range(len(c))))/2
                if a<min_area: continue
                out.append((c,f.get('properties',{}),ri))
    return out
def path_d(c): return 'M'+' L'.join(f'{x:.0f},{y:.0f}' for x,y in c)+'Z'

def smooth(pts, t=0.5):
    if len(pts)==2: return f'M{pts[0][0]:.0f},{pts[0][1]:.0f} L{pts[1][0]:.0f},{pts[1][1]:.0f}'
    d=f'M{pts[0][0]:.0f},{pts[0][1]:.0f}'
    for i in range(len(pts)-1):
        p0=pts[i-1] if i>0 else pts[i]; p1=pts[i]; p2=pts[i+1]; p3=pts[i+2] if i+2<len(pts) else pts[i+1]
        c1=(p1[0]+(p2[0]-p0[0])*t/3*1.0, p1[1]+(p2[1]-p0[1])*t/3*1.0); c2=(p2[0]-(p3[0]-p1[0])*t/3, p2[1]-(p3[1]-p1[1])*t/3)
        d+=f' C{c1[0]:.0f},{c1[1]:.0f} {c2[0]:.0f},{c2[1]:.0f} {p2[0]:.0f},{p2[1]:.0f}'
    return d

CITIES = {  # nombre: (lon, lat, árabe)
 'Andalucía':(-4.78,37.88,'الأندلس'),'Magreb':(-5.0,34.03,'المغرب'),'El Cairo':(31.24,30.04,'القاهرة'),'Estambul':(28.98,41.01,'إسطنبول'),
 'Aleppo':(37.16,36.2,'حلب'),'Damasco':(36.3,33.51,'دمشق'),'Yemen':(44.2,15.35,'اليمن'),'Basra':(47.8,30.5,'البصرة'),
 'Bagdad':(44.4,33.31,'بغداد'),'Isfahán':(51.67,32.65,'أصفهان'),'Samarcanda':(66.97,39.65,'سمرقند'),'India':(75.8,11.25,'الهند')}
JORASAN=(59.0,36.4)
D={('Bagdad','Damasco'):10,('Bagdad','Aleppo'):10,('Bagdad','Basra'):5,('Bagdad','Estambul'):6,('Bagdad','Yemen'):15,('Bagdad','El Cairo'):20,
('Damasco','Bagdad'):2,('Damasco','Aleppo'):1,('Damasco','Basra'):2,('Damasco','Estambul'):5,('Damasco','Yemen'):10,('Damasco','El Cairo'):10,
('Aleppo','Bagdad'):1,('Aleppo','Damasco'):1,('Aleppo','Basra'):5,('Aleppo','Estambul'):5,('Aleppo','El Cairo'):15,
('Basra','Bagdad'):1,('Basra','Damasco'):4,('Basra','Aleppo'):3,('Estambul','Bagdad'):4,('Estambul','Damasco'):5,('Estambul','Aleppo'):2,
('Yemen','Bagdad'):10,('Yemen','Damasco'):15,('Yemen','El Cairo'):10,('El Cairo','Bagdad'):4,('El Cairo','Damasco'):1,('El Cairo','Aleppo'):2,('El Cairo','Yemen'):5,
('Bagdad','Isfahán'):10,('Bagdad','Samarcanda'):50,('Bagdad','India'):50,('Isfahán','Bagdad'):12,('Isfahán','Samarcanda'):35,('Isfahán','India'):20,
('Samarcanda','Isfahán'):35,('Samarcanda','India'):10,('India','Isfahán'):25,('India','Samarcanda'):20,
('Bagdad','Magreb'):20,('Bagdad','Andalucía'):20,('Bagdad','El Cairo'):20,('El Cairo','Magreb'):15,('Magreb','El Cairo'):20,('Magreb','Andalucía'):1,('Andalucía','Magreb'):2,('Andalucía','Bagdad'):25,('Andalucía','El Cairo'):15}
D[('El Cairo','Bagdad')]=4
# (a,b,modo,waypoints lon/lat intermedios)
EDGES=[
('Bagdad','Damasco','t',[(40.4,33.7)]),('Bagdad','Aleppo','t',[(41.2,35.3)]),('Bagdad','Basra','r',[(46.0,31.9)]),
('Bagdad','Estambul','t',[(42.8,36.6),(38.5,39.2),(33,40.7)]),('Bagdad','Yemen','t',[(42.6,27.5),(43.8,21.5)]),
('Bagdad','El Cairo','t',[(39.0,31.2),(34.8,30.6)]),
('Damasco','Aleppo','t',[]),('Damasco','Basra','t',[(41.2,31.7),(44.8,31.0)]),('Damasco','Estambul','t',[(35.2,37.0),(31.5,39.5)]),
('Damasco','Yemen','t',[(37.5,27.5),(40.3,20.8)]),('Damasco','El Cairo','t',[(34.0,31.6)]),
('Aleppo','Basra','t',[(41.0,34.2),(44.2,31.6)]),('Aleppo','Estambul','t',[(34.0,38.4),(31.0,40.2)]),('Aleppo','El Cairo','t',[(35.0,32.5),(33.2,31.0)]),
('Yemen','El Cairo','m',[(42.6,12.8),(39.0,19.0),(34.8,26.5),(33.0,29.6)]),
('Bagdad','Isfahán','t',[(48.2,33.4)]),('Bagdad','Samarcanda','t',[(50.0,35.4),(56.5,37.6),(62.0,38.6)]),
('Bagdad','India','m',[(47.8,30.5),(50.5,28.0),(56.8,26.0),(61.5,24.3),(68,19.0),(72.6,14.2)]),
('Isfahán','Samarcanda','t',[(56.0,35.6),(62.0,38.0)]),('Isfahán','India','t',[(56.5,28.5),(61.5,26.0),(67.5,24.0),(72.5,17.5)]),
('Samarcanda','India','t',[(68.0,36.0),(70.5,31.0),(73.0,24.5),(75.0,17.0)]),
('Bagdad','Magreb','t',[(36.0,32.2),(24.0,31.2),(13.0,32.8),(4.0,34.6)]),
('Bagdad','Andalucía','m',[(38.5,35.4),(26.0,36.2),(12.0,37.6),(0.5,36.5)]),
('El Cairo','Magreb','t',[(24.5,29.2),(14.0,31.0),(4.0,33.4)]),
('El Cairo','Andalucía','m',[(27.0,33.2),(15.5,35.2),(3.0,36.2)]),
('Magreb','Andalucía','m',[]),
]
def edge_pts(a,b,w):
    pa=P(*CITIES[a][:2]); pb=P(*CITIES[b][:2])
    return [pa]+[P(*q) for q in w]+[pb]

def fare_pos(pts, frac):
    L=[math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]) for i in range(len(pts)-1)]; T=sum(L); tgt=T*frac; acc=0
    for i,l in enumerate(L):
        if acc+l>=tgt:
            u=(tgt-acc)/l; return (pts[i][0]+(pts[i+1][0]-pts[i][0])*u, pts[i][1]+(pts[i+1][1]-pts[i][1])*u)
        acc+=l
    return pts[-1]

def poly_pts(lonlat): return [P(*p) for p in lonlat]
def pip(x,y,poly):
    c=False
    for i in range(len(poly)):
        x1,y1=poly[i-1]; x2,y2=poly[i]
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1: c=not c
    return c
DESIERTOS={'arabia':[(36,28),(39,30.5),(43,31),(47,29.5),(51,24.5),(56,22),(55,18.5),(50,16.8),(46,17),(43.5,19),(40,22),(38,25)],
 'sahara':[(-12,21),(-6,28),(0,29.5),(8,30),(15,29.5),(24,28),(30,26),(30,20),(15,18),(0,17.5),(-12,17.5)],
 'karakum':[(54,40.5),(57,41.8),(62,41),(63,38.5),(60,37.8),(55,38.2)],
 'lut':[(55.5,33),(58.5,34),(60.5,31),(59,28.5),(56,28.8)],
 'thar':[(69,28.5),(72.5,29),(73.5,26),(70.5,24.5)]}
MONTES={'Atlas':[(-9,31),(-5.5,32.3),(-1,33.6),(3,34.6),(7.5,35.6)],'Zagros':[(45.5,36.3),(47.5,34.2),(49.5,32),(52,30),(55,27.8)],
 'Tauro':[(30.5,36.9),(34,37.3),(37.5,37.6),(41,38.2)],'Cáucaso':[(38,44.2),(41.5,43.2),(45,42.3),(48,41.5)],'Elburz':[(50.5,36.6),(53.5,36.5),(56.5,36.7)],
 'Hindu Kush':[(66.5,34.8),(69,35.6),(71.5,36.4),(73.5,37.4)],'Pamir':[(72.5,38.4),(74.5,39.0),(77,39.2)],'Sierra Nevada':[(-4.5,36.9),(-2.5,37.1)],
 'Pirineos':[(-1.5,42.8),(1.5,42.6),(3.0,42.5)],'Alpes':[(6,45.5),(9,46.4),(13,46.6)],'Sinaí':[(33.6,28.8),(34.4,28.4)],'Hijaz':[(36,28),(37.5,25),(39.5,20.5),(42.5,17)]}
def mountains(rng, scale):
    out=[]
    for name,pts in MONTES.items():
        pp=poly_pts(pts)
        for i in range(len(pp)-1):
            (x0,y0),(x1,y1)=pp[i],pp[i+1]; n=max(2,int(math.hypot(x1-x0,y1-y0)/(34*scale)))
            for k in range(n+1):
                u=k/n; x=x0+(x1-x0)*u+rng.uniform(-14,14); y=y0+(y1-y0)*u+rng.uniform(-12,12); s=rng.uniform(.8,1.25)*scale
                out.append((x,y,s))
    return out
def peak(x,y,s):
    w=26*s; h=30*s
    return (f'<path d="M{x-w:.0f},{y:.0f} L{x-w*.2:.0f},{y-h:.0f} L{x+w*.15:.0f},{y-h*.72:.0f} L{x+w*.35:.0f},{y-h:.0f} L{x+w:.0f},{y:.0f}" fill="#d8c08a" stroke="#6a4520" stroke-width="{3.2*s:.1f}" stroke-linejoin="round"/>'
            f'<path d="M{x-w*.2:.0f},{y-h:.0f} L{x+w*.05:.0f},{y-h*.3:.0f} L{x+w*.55:.0f},{y-h*.2:.0f} L{x+w*.35:.0f},{y-h:.0f}" fill="#9b7a45" opacity=".45"/>')
