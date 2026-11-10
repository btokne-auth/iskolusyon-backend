import random, json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
random.seed(7)
F = '/usr/share/fonts/truetype/dejavu/'
fR = lambda s: ImageFont.truetype(F+'DejaVuSerif.ttf', s)
fB = lambda s: ImageFont.truetype(F+'DejaVuSerif-Bold.ttf', s)
first = ['Maria Clara','Juan Miguel','Andrea Mae','Carlo Jose','Bianca Rose','Paolo','Kristine Joy','Mark Anthony','Angelica','Jerome','Patricia Ann','Rafael','Nicole','Joshua','Camille']
last = ['Santos','Dela Cruz','Reyes','Garcia','Mendoza','Ramos','Villanueva','Bautista','Aquino','Navarro','Castillo','Torres','Flores','Rivera','Lopez']
calamba_brgy = ['Real','Parian','Canlubang','Halang','Pansol','Bucal','Mayapa','Lecheria','Punta','Sirang Lupa']
others = [('Cabuyao','Banlic'),('Santa Rosa','Balibago'),('Biñan','Canlalay'),('Los Baños','Batong Malake'),('San Pedro','Landayan'),('Cabuyao','Pulo'),('Santa Rosa','Tagapo'),('Biñan','Platero'),('Los Baños','Anos'),('San Pedro','Nueva')]

def voter_cert(name, brgy, city, precinct, street=None):
    W,H=1240,1754
    im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im)
    y=110
    for t,f in [('Republic of the Philippines',fR(30)),('COMMISSION ON ELECTIONS',fB(44)),('Office of the Election Officer',fR(30)),(f'City of {city}, Laguna',fR(30))]:
        w=d.textlength(t,font=f); d.text(((W-w)/2,y),t,fill='black',font=f); y+=58
    y+=60; t="VOTER'S CERTIFICATION"; f=fB(48); d.text(((W-d.textlength(t,font=f))/2,y),t,fill='black',font=f); y+=130
    addr = f"{street + ', ' if street else ''}Barangay {brgy}, City of {city}, Laguna"
    body = [ 'TO WHOM IT MAY CONCERN:', '',
      f'This is to certify that {name.upper()} is a registered voter of',
      f'{addr},', f'with Precinct No. {precinct}, based on the records of this Office.', '',
      'This certification is issued upon the request of the above-named person',
      'for whatever legal purpose it may serve.', '',
      'Issued this 3rd day of November 2026.' ]
    for line in body:
        d.text((130,y),line,fill='black',font=fR(30)); y+=52
    y+=120; d.text((760,y),'ELECTION OFFICER',fill='black',font=fB(28))
    d.text((130,H-110),'SAMPLE DOCUMENT FOR SYSTEM TESTING ONLY. NOT AN OFFICIAL RECORD.',fill=(90,90,90),font=fR(22))
    return im

def not_voter(name, brgy):
    W,H=1240,1754
    im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im); y=110
    for t,f in [('Republic of the Philippines',fR(30)),('Province of Laguna',fR(30)),('City of Calamba',fR(30)),(f'BARANGAY {brgy.upper()}',fB(40))]:
        d.text(((W-d.textlength(t,font=f))/2,y),t,fill='black',font=f); y+=58
    y+=60; t='BARANGAY CLEARANCE'; f=fB(48); d.text(((W-d.textlength(t,font=f))/2,y),t,fill='black',font=f); y+=130
    for line in ['TO WHOM IT MAY CONCERN:','',f'This is to certify that {name.upper()}, of legal age,',f'is a resident of Barangay {brgy}, City of Calamba, Laguna,','and has no derogatory record in this barangay.','','Issued this 3rd day of November 2026.']:
        d.text((130,y),line,fill='black',font=fR(30)); y+=52
    d.text((130,H-110),'SAMPLE DOCUMENT FOR SYSTEM TESTING ONLY. NOT AN OFFICIAL RECORD.',fill=(90,90,90),font=fR(22))
    return im

def cond(im, c):
    if c=='clean': return im
    if c=='dim':
        im=ImageEnhance.Brightness(im).enhance(0.45); return ImageEnhance.Contrast(im).enhance(0.6)
    if c=='blurry': return im.filter(ImageFilter.GaussianBlur(3.2))
    if c=='tilted': return im.rotate(8, expand=True, fillcolor=(200,200,200))
    if c=='angled':
        W,H=im.size; # perspective: top edge narrower
        coeffs = find_coeffs([(0,0),(W,0),(W,H),(0,H)], [(120,60),(W-120,0),(W,H),(0,H-40)])
        return im.transform((W,H), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=(200,200,200))
    if c=='low_res':
        W,H=im.size; return im.resize((W//4,H//4)).resize((W//2,H//2))
    if c=='very_blurry': return im.filter(ImageFilter.GaussianBlur(6))
    if c=='very_dark':
        im=ImageEnhance.Brightness(im).enhance(0.22); return ImageEnhance.Contrast(im).enhance(0.45)
    if c=='very_low_res':
        W,H=im.size; return im.resize((W//7,H//7)).resize((W//2,H//2))
    if c=='shadow':
        import numpy as np
        a=np.array(im).astype('float'); W=a.shape[1]; g=np.linspace(0.25,1.0,W)[None,:,None]; return Image.fromarray((a*g).clip(0,255).astype('uint8'))
    if c=='compressed':
        import io, numpy as np
        a=np.array(im).astype('int16'); a=a+np.random.RandomState(1).randint(-40,40,a.shape); a=a.clip(0,255).astype('uint8')
        b=io.BytesIO(); Image.fromarray(a).resize((im.size[0]*2//3, im.size[1]*2//3)).save(b,'JPEG',quality=12); b.seek(0); return Image.open(b).convert('RGB')
def find_coeffs(pa, pb):
    import numpy as np
    m=[]
    for p1,p2 in zip(pa,pb):
        m.append([p1[0],p1[1],1,0,0,0,-p2[0]*p1[0],-p2[0]*p1[1]]); m.append([0,0,0,p1[0],p1[1],1,-p2[1]*p1[0],-p2[1]*p1[1]])
    A=np.matrix(m,dtype=float); B=np.array(pb).reshape(8)
    return np.array(np.dot(np.linalg.inv(A.T*A)*A.T,B)).reshape(8)

CONDS=['clean','dim','blurry','tilted','angled','low_res','compressed','shadow','very_blurry','very_dark','very_low_res']
docs=[]
for i in range(10):
    n=f'{first[i]} {last[i]}'; docs.append(('calamba_voter',True,voter_cert(n,calamba_brgy[i],'Calamba',f'0{400+i*7}A'),n))
for i in range(10):
    n=f'{first[(i+3)%15]} {last[(i+5)%15]}'; city,b=others[i]
    street='Calamba Road' if i==5 else None  # trap: other city, but a street named Calamba
    docs.append(('other_city_voter',False,voter_cert(n,b,city,f'0{200+i*5}B',street),n))
for i in range(5):
    n=f'{first[(i+8)%15]} {last[(i+9)%15]}'; docs.append(('not_voter_doc',False,not_voter(n,calamba_brgy[i]),n))
meta=[]
for k,(kind,exp,im,n) in enumerate(docs):
    for c in CONDS:
        fn=f'{k:02d}_{kind}_{c}.jpg'; cond(im,c).save('img/'+fn,'JPEG',quality=90)
        meta.append({'file':fn,'kind':kind,'expected_pass':exp,'condition':c,'name':n,'trap': kind=='other_city_voter' and k==15})
json.dump(meta,open('meta.json','w'),indent=1); print(len(meta))
