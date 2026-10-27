"""Recover incomplete local cache writes; never modify live database records."""
import argparse,json,os,time
from datetime import datetime
from PIL import Image,ImageOps
import requests
from process_catalog import WORK,Processor

parser=argparse.ArgumentParser();parser.add_argument('--since',required=True);args=parser.parse_args()
since=datetime.fromisoformat(args.since).timestamp()
plan=json.loads((WORK/'plan.json').read_text(encoding='utf-8'))
processor=Processor(load_segment=False);repaired=[];failures=[]
def save_image(file,image):
    temporary=file.with_suffix('.recovery.webp')
    with temporary.open('wb') as stream:
        image.save(stream,format='WEBP',lossless=True,quality=100,method=3,exact=True);stream.flush();os.fsync(stream.fileno())
    temporary.replace(file)
def recover(asset,row):
    with Image.open(WORK/'originals'/f"{asset['key']}.bin") as original:rgba=ImageOps.exif_transpose(original).convert('RGBA')
    previous=(row or {}).get('watermarkMatches',[])
    cleaned,_,_=processor.clean(rgba,detected_boxes=previous) if previous else (rgba,[],None)
    cleaned,boxes,_=processor.clean(cleaned,full_fallback=True,reference_boxes=previous)
    row={'key':asset['key'],'url':asset['url'],'avatar':asset['avatar'],'width':rgba.width,'height':rgba.height,'status':'done','pipelineVersion':3,'watermarkMatches':previous+boxes,'recoveredAt':time.strftime('%Y-%m-%dT%H:%M:%S%z')}
    if row['watermarkMatches']:
        web=cleaned.copy()
        if not asset['avatar']:web.thumbnail((2000,2000),Image.Resampling.LANCZOS)
        row['cleanPath']=f"output/{asset['key']}-clean.webp";save_image(WORK/row['cleanPath'],web)
    if asset['avatar']:
        file=WORK/'output'/f"{asset['key']}-cutout.webp"
        try:
            with Image.open(file) as old:alpha=old.getchannel('A');alpha.load()
        except OSError:
            record=json.loads((WORK/'uploads'/f"{asset['key']}-cutout.json").read_text(encoding='utf-8'))
            response=requests.get(record['url'],timeout=60);response.raise_for_status()
            downloaded=WORK/'originals'/f"{asset['key']}-approved-alpha.webp";downloaded.write_bytes(response.content)
            with Image.open(downloaded) as old:alpha=old.getchannel('A');alpha.load()
        if alpha.size!=rgba.size:raise ValueError('Approved alpha dimensions do not match the source')
        cutout=cleaned.copy();cutout.putalpha(alpha);save_image(file,cutout)
        row['cutoutPath']=f"output/{asset['key']}-cutout.webp";row['cutout']={'method':'approved-alpha-recovered'}
    destination=WORK/'results'/f"{asset['key']}.json"
    if destination.exists():destination.replace(destination.with_suffix(f'.interrupted-{time.time_ns()}'))
    temporary=destination.with_suffix('.recovery.part')
    with temporary.open('w',encoding='utf-8') as stream:
        json.dump(row,stream,ensure_ascii=False,indent=2);stream.flush();os.fsync(stream.fileno())
    temporary.replace(destination)

for index,asset in enumerate(plan['assets']):
    file=WORK/'results'/f"{asset['key']}.json";row=None;bad=False
    try:row=json.loads(file.read_text(encoding='utf-8'))
    except (OSError,ValueError):bad=True
    if row:
        for kind in ['clean','cutout']:
            if not row.get(f'{kind}Path'):continue
            output=WORK/row[f'{kind}Path']
            if output.exists() and output.stat().st_mtime<since:continue
            try:
                with Image.open(output) as image:image.verify()
            except (OSError,ValueError):bad=True
    if bad:
        try:recover(asset,row);repaired.append(asset['key']);print(json.dumps({'recovered':asset['key']}),flush=True)
        except Exception as error:failures.append({'key':asset['key'],'error':str(error)})
    if index%1000==0:print(json.dumps({'checked':index,'repaired':len(repaired),'failed':len(failures)}),flush=True)
report={'checked':len(plan['assets']),'repaired':repaired,'failures':failures}
(WORK/'recovery.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
if failures:raise SystemExit(1)
