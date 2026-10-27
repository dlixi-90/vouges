import hashlib
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests
from PIL import Image, ImageDraw, ImageOps

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'data/media-processing'
for name in ['originals','models','samples','results']:(WORK/name).mkdir(parents=True,exist_ok=True)

def download(url,destination,md5=None):
    if destination.exists() and (not md5 or hashlib.md5(destination.read_bytes()).hexdigest()==md5):return
    with requests.get(url,stream=True,timeout=(20,120)) as response:
        response.raise_for_status()
        part=destination.with_suffix('.part')
        with part.open('wb') as handle:
            for chunk in response.iter_content(1024*256):handle.write(chunk)
        if md5 and hashlib.md5(part.read_bytes()).hexdigest()!=md5:raise ValueError('Model checksum mismatch')
        part.replace(destination)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--model',action='store_true');args=parser.parse_args()
    if args.model:
        download('https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx',WORK/'models/u2net.onnx','60024c5c889badc19c04ad937298a77b')
        print('Model ready',flush=True)
    else:
        plan=json.loads((WORK/'plan.json').read_text(encoding='utf-8'))
        avatars=[item for item in plan['assets'] if item['avatar']]
        galleries=[item for item in plan['assets'] if not item['avatar']]
        selected=avatars[:4]+[avatars[int(i*(len(avatars)-1)/11)] for i in range(12)]+galleries[:8]
        selected=list({item['key']:item for item in selected}.values())
        def one(item):
            destination=WORK/'originals'/f"{item['key']}.bin"
            try:download(item['url'],destination);return item
            except Exception as error:print(item['key'],str(error),flush=True);return None
        with ThreadPoolExecutor(max_workers=4) as pool:items=[item for item in pool.map(one,selected) if item]
        (WORK/'samples/selection.json').write_text(json.dumps(items,indent=2),encoding='utf-8')
        size=240;sheet=Image.new('RGB',(size*4,(len(items)+3)//4*(size+26)),'white');draw=ImageDraw.Draw(sheet)
        for i,item in enumerate(items):
            im=Image.open(WORK/'originals'/f"{item['key']}.bin").convert('RGB');im.thumbnail((size-12,size-12))
            x=(i%4)*size+(size-im.width)//2;y=(i//4)*(size+26)
            sheet.paste(im,(x,y));draw.text(((i%4)*size+6,y+size),f"{i}: {'AVATAR' if item['avatar'] else 'GALLERY'} {item['key'][:8]}",fill='black')
        sheet.save(WORK/'samples/originals.jpg',quality=92)
        print(json.dumps({'downloadedSamples':len(items),'contactSheet':str(WORK/'samples/originals.jpg')}),flush=True)
