"""Check edited photos over their entire surface, including repeated stamps."""
import argparse,json,time,random,threading,os
from concurrent.futures import ThreadPoolExecutor,as_completed
from PIL import Image,ImageOps,ImageChops
from process_catalog import WORK,Processor

parser=argparse.ArgumentParser();parser.add_argument('--workers',type=int,default=2);args=parser.parse_args()
plan=json.loads((WORK/'plan.json').read_text(encoding='utf-8'))
assets={asset['key']:asset for asset in plan['assets']}
rows=[json.loads(file.read_text(encoding='utf-8')) for file in (WORK/'results').glob('*.json')]
if len(rows)!=len(assets):raise RuntimeError('Finish the initial image scan first')
processor=Processor(load_segment=False,ocr_threads=4)
def save_json(file,value):
    part=file.with_suffix(f'.{threading.get_ident()}.part')
    with part.open('w',encoding='utf-8') as stream:
        json.dump(value,stream,ensure_ascii=False,indent=2);stream.flush();os.fsync(stream.fileno())
    part.replace(file)
def save_image(file,image):
    part=file.with_suffix('.recheck.webp')
    with part.open('wb') as stream:
        image.save(stream,format='WEBP',lossless=True,quality=100,method=3,exact=True);stream.flush();os.fsync(stream.fileno())
    part.replace(file)
def check(row):
    if row.get('fullSurfaceChecked') and row.get('fullSurfaceVersion')==2:return row
    asset=assets[row['key']]
    # Existing cleaned files already passed footer and morphology detection.
    # Check them with the independent learned full-image detector. Avoid
    # re-encoding untouched photos or repeating the initial OCR work.
    source=WORK/row['cleanPath'] if row.get('cleanPath') else WORK/'originals'/f"{row['key']}.bin"
    with Image.open(source) as original:rgba=ImageOps.exif_transpose(original).convert('RGBA')
    white=Image.new('RGBA',rgba.size,'white');white.alpha_composite(rgba)
    boxes=processor.detect(white.convert('RGB'),full=True)
    references=[]
    sx=rgba.width/row['width'];sy=rgba.height/row['height']
    for previous in row.get('watermarkMatches',[]):
        references.append({**previous,'polygon':[[x*sx,y*sy] for x,y in previous['polygon']]})
    cleaned,boxes,_=processor.clean(rgba,reference_boxes=references,detected_boxes=boxes) if boxes else (rgba,[],None)
    # Removing stronger lines can help the detector see faint text in another
    # panel. Keep same-image complete stamps as references for clipped suffixes.
    references+=boxes
    if boxes and (len(boxes)>1 or any(term in asset['url'].lower() for term in ['thiet-ke','thiet_ke'])):
        for _ in range(2):
            white=Image.new('RGBA',cleaned.size,'white');white.alpha_composite(cleaned)
            extra=processor.detect(white.convert('RGB'),full=True)
            if not extra:break
            cleaned,extra,_=processor.clean(cleaned,reference_boxes=references,detected_boxes=extra)
            boxes+=extra;references+=extra
    if boxes:
        relative=f"output/{row['key']}-clean.webp";web=cleaned.copy() if row.get('cutoutPath') else cleaned
        if not row.get('cutoutPath') and max(web.size)>2000:web.thumbnail((2000,2000),Image.Resampling.LANCZOS)
        file=WORK/relative;save_image(file,web)
        row['cleanPath']=relative
    if row.get('cutoutPath') and row.get('cleanPath'):
        # Also recover an interrupted edit between clean-file and cutout-file
        # commits. Keep the already approved alpha, with the corrected RGB.
        file=WORK/row['cutoutPath']
        with Image.open(file) as previous:
            alpha=previous.getchannel('A')
            changed=ImageChops.difference(previous.convert('RGB'),cleaned.convert('RGB')).getbbox() is not None
        if changed:
            cutout=cleaned.copy();cutout.putalpha(alpha)
            save_image(file,cutout)
    row['watermarkMatches']=row.get('watermarkMatches',[])+[{**box,'polygon':[[x/sx,y/sy] for x,y in box['polygon']]} for box in boxes]
    row['fullSurfaceChecked']=True;row['fullSurfaceVersion']=2;row['pipelineVersion']=4
    save_json(WORK/'results'/f"{row['key']}.json",row)
    return row

started=time.monotonic();failed=[];done=0;additional=0
def batch(items):
    global done,additional
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs={pool.submit(check,row):(row,len(row.get('watermarkMatches',[]))) for row in items}
        for future in as_completed(jobs):
            old,count=jobs[future]
            try:
                updated=future.result();additional+=max(0,len(updated.get('watermarkMatches',[]))-count)
            except Exception as error:failed.append({'key':old['key'],'error':str(error)})
            done+=1
            if done%20==0:
                progress={'done':done,'additionalLines':additional,'failed':len(failed),'elapsedSeconds':round(time.monotonic()-started)}
                save_json(WORK/'full-surface-progress.json',progress);print(json.dumps(progress),flush=True)

unmarked=[row for row in rows if not row.get('watermarkMatches')]
random.seed(84);sample=random.sample(unmarked,min(100,len(unmarked)))
batch(sample)
# If the control sample reveals missed text, extend the learned full-image
# detector to every remaining unmarked photo, rather than accepting the gap.
sample_misses=sum(bool(row.get('watermarkMatches')) for row in sample)
control_file=WORK/'full-surface-control.json'
if control_file.exists():sample_misses=max(sample_misses,json.loads(control_file.read_text(encoding='utf-8')).get('misses',0))
save_json(control_file,{'sample':len(sample),'misses':sample_misses})
selected=[row for row in rows if row.get('watermarkMatches')]
if sample_misses:selected=[row for row in rows if not row.get('fullSurfaceChecked')]
batch(selected)
report={'version':2,'total':len(rows),'fullImageChecks':done,'controlSample':len(sample),'controlMisses':sample_misses,'additionalLines':additional,'failed':failed,'completedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z')}
save_json(WORK/'full-surface-complete.json',report);print(json.dumps(report),flush=True)
if failed:raise SystemExit(1)
