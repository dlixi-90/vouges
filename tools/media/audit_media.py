import argparse,json,random
from pathlib import Path
import numpy as np
from PIL import Image,ImageOps
from process_catalog import WORK,contact_sheet,Processor

parser=argparse.ArgumentParser();parser.add_argument('--scan-residual',action='store_true');parser.add_argument('--sample',type=int,default=24);args=parser.parse_args()
plan=json.loads((WORK/'plan.json').read_text(encoding='utf-8'))
extra=json.loads((WORK/'extra-plan.json').read_text(encoding='utf-8')) if (WORK/'extra-plan.json').exists() else {'assets':[]}
by_key={item['key']:item for item in plan['assets']+extra['assets']}
rows=[json.loads(file.read_text(encoding='utf-8')) for folder in ['results','extra-results'] for file in (WORK/folder).glob('*.json')]
avatars=[row for row in rows if row.get('cutoutPath')];marked=[row for row in rows if row.get('cleanPath')]
random.seed(42);selected=random.sample(avatars,min(args.sample,len(avatars)))
contact_sheet([by_key[row['key']] for row in selected],WORK/'samples/avatar-audit.jpg')
sampled=random.sample(avatars,min(100,len(avatars)));checked=0
for row in sampled:
    original=ImageOps.exif_transpose(Image.open(WORK/'originals'/f"{row['key']}.bin")).convert('RGBA')
    base=Image.open(WORK/row['cleanPath']).convert('RGBA') if row.get('cleanPath') else original
    if row.get('cutoutPath'):
        cutout=Image.open(WORK/row['cutoutPath']).convert('RGBA')
        assert cutout.size==original.size
        assert np.array_equal(np.array(cutout)[:,:,:3],np.array(base)[:,:,:3]),f"Product colors changed: {row['key']}"
        assert cutout.getextrema()[3][0]==0,f"No transparency: {row['key']}"
        checked+=1
residual=[]
if args.scan_residual:
    processor=Processor(load_segment=False);candidates=random.sample(marked,min(100,len(marked)))
    for row in candidates:
        rgba=Image.open(WORK/row['cleanPath']).convert('RGBA');white=Image.new('RGBA',rgba.size,'white');white.alpha_composite(rgba)
        rgb=white.convert('RGB')
        boxes=processor.detect(rgb) or processor.detect_lines(rgb) or processor.detect(rgb,full=True)
        if boxes:residual.append({'key':row['key'],'matches':boxes})
report={'processed':len(rows),'avatars':len(avatars),'watermarkImages':len(marked),'preservedPixelSamples':checked,'residualSampleSize':min(100,len(marked)) if args.scan_residual else 0,'residual':residual}
(WORK/'audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
