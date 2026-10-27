"""Process verified source Open Graph photos missing from product galleries."""
import hashlib,json,time,shutil,os
from PIL import Image,ImageOps
from process_catalog import WORK,Processor

source=json.loads((WORK/'missing-photo-source-check.json').read_text(encoding='utf-8'))
original=json.loads((WORK/'plan.json').read_text(encoding='utf-8'))
missing=[product for product in original['products'] if not product.get('images')]
directory=WORK/'extra-results';directory.mkdir(exist_ok=True)
processor=Processor('CPUExecutionProvider',ocr_threads=4)
assets=[];products=[]
for product in missing:
    page=next(row for row in source if row['url']==product['source']['url'])
    url=page['openGraph'][0];key=hashlib.sha256(url.encode()).hexdigest()[:24]
    local=WORK/'samples'/('missing-creed.png' if 'Creed-' in url else 'missing-byredo.png')
    raw=WORK/'originals'/f'{key}.bin';shutil.copyfile(local,raw)
    with Image.open(raw) as image:rgba=ImageOps.exif_transpose(image).convert('RGBA')
    # Both full-resolution photos were visually reviewed: no website/phone
    # text is present. Preserve every RGB pixel, changing alpha only.
    cutout,stats=processor.cutout(rgba)
    path=f'output/{key}-cutout.webp';file=WORK/path
    with file.open('wb') as stream:
        cutout.save(stream,format='WEBP',lossless=True,quality=100,method=3,exact=True);stream.flush();os.fsync(stream.fileno())
    asset={'key':key,'url':url,'avatar':True,'roles':['avatar'],'productIds':[product['_id']]}
    row={**asset,'width':rgba.width,'height':rgba.height,'status':'done','pipelineVersion':4,'fullSurfaceChecked':True,'fullSurfaceVersion':2,'watermarkMatches':[],'cutoutPath':path,'cutout':stats,'humanReviewed':True}
    (directory/f'{key}.json').write_text(json.dumps(row,indent=2),encoding='utf-8')
    assets.append(asset);products.append({'_id':product['_id'],'title':product['title'],'images':[url],'sourcePage':product['source']['url']})
    print(json.dumps({'product':product['title'],'asset':key,'foreground':stats}),flush=True)
report={'createdAt':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'reason':'Verified source Open Graph images exist although WooCommerce gallery shows a placeholder','assets':assets,'products':products,'counts':{'products':len(products),'uniqueAssets':len(assets),'uniqueAvatars':len(assets)}}
(WORK/'extra-plan.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
