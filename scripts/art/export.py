from slice import *
from PIL import ImageFilter
def save(a,pts,name,skin_key=False):
    ys=[p[0] for p in pts]; xs=[p[1] for p in pts]; x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
    m=np.zeros(a.shape[:2],bool)
    for y,x in pts: m[y,x]=True
    sub=a[y0:y1+1,x0:x1+1]; mm=m[y0:y1+1,x0:x1+1]
    if skin_key:
        med=np.median(sub[mm],axis=0); d=np.sqrt(((sub-med)**2).sum(2)); mm=mm&(d>66)
        # ตัดขอบผิวที่ยังเหลือ: เก็บเฉพาะก้อนที่อยู่ลึกเข้ามาจากขอบครึ่งวงกลม
        from PIL import ImageFilter as IF
        inner=np.array(Image.fromarray((m[y0:y1+1,x0:x1+1]*255).astype('uint8')).filter(IF.MinFilter(21)))>128
        mm=mm&inner
    al=Image.fromarray((mm*255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.8))
    im=Image.fromarray(sub.astype('uint8')).convert('RGBA'); im.putalpha(al)
    bb=im.getbbox(); im=im.crop(bb) if bb else im
    im.save(O+name+'.png',optimize=True); return im.size
def ordered(b,rows):
    b=sorted(b,key=lambda t:(round((t[1]+t[3])/2/ (800/rows)),t[0])); return b
meta={}
a,bg,b=cut('9.png',''); b=ordered(b,2)
meta['head']=[save(a,t[4],f'head{i}') for i,t in enumerate(b)]
a,bg,b=cut('10.webp',''); b=ordered(b,4)
for i,t in enumerate(b): 
    p=(i//4)*2+(i%4)//2; side='L' if i%2==0 else 'R'; save(a,t[4],f'eye{p}{side}')
a,bg,b=cut('11.png',''); b=ordered(b,4)
for i,t in enumerate(b):
    p=(i//4)*2+(i%4)//2; side='L' if i%2==0 else 'R'; save(a,t[4],f'brow{p}{side}')
a,bg,b=cut('12.png',''); b=ordered(b,2)
for i,t in enumerate(b): save(a,t[4],f'nose{i}')
a,bg,b=cut('13.png',''); b=ordered(b,2)
for i,t in enumerate(b): save(a,t[4],f'mouth{i}',skin_key=True)
import os; print(sorted(os.listdir(O)), sum(os.path.getsize(O+f) for f in os.listdir(O)))
# contact sheet
fs=sorted(os.listdir(O)); W=Image.new('RGBA',(1300,700),(200,160,120,255)); x=y=0
for f in fs:
    im=Image.open(O+f); 
    if x+im.width>1290: x=0; y+=130
    W.alpha_composite(im,(x,y)); x+=im.width+8
W.convert('RGB').save('sheet.png')
