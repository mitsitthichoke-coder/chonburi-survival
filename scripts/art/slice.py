import numpy as np, sys
from PIL import Image
from collections import deque
S='/tmp/claude-0/-home-user-chonburi-survival/1d6af6be-9f4d-510b-a042-07b2c6612a1d/images/'
O='/home/user/chonburi-survival/public/img/face/'
def load(n):
    return np.array(Image.open(S+n).convert('RGB')).astype(int)
def bgmask(a):
    mx=a.max(2); mn=a.min(2); cand=(mn>222)&((mx-mn)<14)
    h,w=cand.shape; bg=np.zeros_like(cand); q=deque()
    for x in range(w):
        for y in (0,h-1):
            if cand[y,x] and not bg[y,x]: bg[y,x]=True; q.append((y,x))
    for y in range(h):
        for x in (0,w-1):
            if cand[y,x] and not bg[y,x]: bg[y,x]=True; q.append((y,x))
    while q:
        y,x=q.popleft()
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny,nx=y+dy,x+dx
            if 0<=ny<h and 0<=nx<w and cand[ny,nx] and not bg[ny,nx]: bg[ny,nx]=True; q.append((ny,nx))
    return bg
def comps(fg,minsz=400):
    h,w=fg.shape; seen=np.zeros_like(fg); out=[]
    for sy in range(0,h):
        for sx in range(0,w):
            if fg[sy,sx] and not seen[sy,sx]:
                q=deque([(sy,sx)]); seen[sy,sx]=True; pts=[]
                while q:
                    y,x=q.popleft(); pts.append((y,x))
                    for dy in (-1,0,1):
                        for dx in (-1,0,1):
                            ny,nx=y+dy,x+dx
                            if 0<=ny<h and 0<=nx<w and fg[ny,nx] and not seen[ny,nx]: seen[ny,nx]=True; q.append((ny,nx))
                if len(pts)>=minsz: out.append(pts)
    return out
def cut(n, base):
    a=load(n); bg=bgmask(a); fg=~bg
    cs=comps(fg)
    boxes=[]
    for pts in cs:
        ys=[p[0] for p in pts]; xs=[p[1] for p in pts]; boxes.append((min(xs),min(ys),max(xs),max(ys),pts))
    return a,bg,boxes
if __name__=='__main__':
    for n in ['9.png','10.webp','11.png','12.png','13.png']:
        a,bg,b=cut(n,'')
        print(n,len(b),[ (x0,y0,x1,y1) for x0,y0,x1,y1,_ in sorted(b,key=lambda t:(t[1]//200,t[0]))])
