import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
P='/mnt/project-files/juego-3d/arte/personajes/'
def figs(f):
    a=np.asarray(Image.open(f).convert('RGB'),dtype=np.float32); bg=np.median(a[:8].reshape(-1,3),axis=0)
    fig=np.sqrt(((ndi.gaussian_filter(a,(1,1,0))-bg)**2).sum(axis=2))>30
    col=fig.sum(axis=0)>3; lab,n=ndi.label(ndi.binary_closing(col,iterations=4))
    g=[(np.where(lab==i)[0][0],np.where(lab==i)[0][-1]) for i in range(1,n+1)]; g=[x for x in g if x[1]-x[0]>60]; print(f[-10:],g)
    return a,bg,g
a1,bg,g1=figs(P+'hoja-tecnica-zubayda-360-fila1.png'); a2,_,g2=figs(P+'hoja-tecnica-zubayda-360-fila2.png')
def pieza(a,g,k,pad=40):
    x0,x1=g[k]; iz=(x0-g[k-1][1])//2-1 if k else x0; de=(g[k+1][0]-x1)//2-1 if k+1<len(g) else a.shape[1]-1-x1
    i0,i1=x0-min(12,iz),x1+min(12,de)+1; t=a[:,i0:i1]; r=np.broadcast_to(bg,(a.shape[0],t.shape[1]+2*pad,3)).copy(); r[:,pad:pad+t.shape[1]]=t; return r
def hoja(piezas,out):
    H=max(p.shape[0] for p in piezas)+60; W=sum(p.shape[1] for p in piezas); L=np.broadcast_to(bg,(H,W,3)).copy(); x=0
    for p in piezas: L[30:30+p.shape[0],x:x+p.shape[1]]=p; x+=p.shape[1]
    Image.fromarray(L.clip(0,255).astype(np.uint8)).save(out); print(out,L.shape)
hoja([pieza(a1,g1,0),pieza(a1,g1,1),pieza(a1,g1,2),pieza(a2,g2,0)],sys.argv[1])
hoja([pieza(a2,g2,3),pieza(a2,g2,1),pieza(a2,g2,2),pieza(a2,g2,0)],sys.argv[2])
