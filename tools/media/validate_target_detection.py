from PIL import Image,ImageDraw,ImageFont
from process_catalog import Processor

p=Processor('CPUExecutionProvider',load_segment=False)
for y,size,color in [(125,14,'#555555'),(370,8,'#999999'),(40,18,'black')]:
    image=Image.new('RGBA',(600,400),'white');draw=ImageDraw.Draw(image)
    draw.rectangle((240,170,360,330),fill='#46354f')
    draw.text((250,215),'DIOR',fill='white',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14))
    draw.text((35,y),'www.apaniche.vn - 0961596333',fill=color,font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',size))
    _,boxes,_=p.clean(image)
    assert boxes,f'Missed target at y={y}, size={size}'
    print({'targetY':y,'fontSize':size,'detected':True},flush=True)
