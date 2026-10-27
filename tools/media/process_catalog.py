"""Deterministic catalog image edits. Never redraw a product or replace its label."""
import argparse
from concurrent.futures import ThreadPoolExecutor,as_completed
import json
import re
import threading
import time
from pathlib import Path
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageOps
from rapidocr import RapidOCR,OCRVersion,ModelType,LangRec
from rapidocr.inference_engine.onnxruntime.main import OrtInferSession
from rapidocr.ch_ppocr_rec.main import TextRecognizer
from rapidocr.ch_ppocr_rec.typings import TextRecInput
import requests

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'data/media-processing'
for name in ['originals','models','samples','results','output']:(WORK/name).mkdir(parents=True,exist_ok=True)
Image.MAX_IMAGE_PIXELS=60_000_000

# Many OCR sessions run concurrently. Idle native worker pools must not spin
# on the user's CPU between images; this only configures this worker process.
_original_ocr_options=OrtInferSession._init_sess_opts
def _passive_ocr_options(config):
    options=_original_ocr_options(config)
    options.add_session_config_entry('session.intra_op.allow_spinning','0')
    options.add_session_config_entry('session.inter_op.allow_spinning','0')
    if config.get('use_dml',False):
        options.enable_mem_pattern=False;options.execution_mode=ort.ExecutionMode.ORT_SEQUENTIAL
    return options
OrtInferSession._init_sess_opts=staticmethod(_passive_ocr_options)

# Decorative one-pixel borders can look like extremely wide text lines. Bound
# the recognition tensor; the requested domain/phone line fits this ratio.
_original_resize_norm=TextRecognizer.resize_norm_img
def _bounded_resize_norm(self,image,max_wh_ratio):
    return _original_resize_norm(self,image,min(max_wh_ratio,30))
TextRecognizer.resize_norm_img=_bounded_resize_norm

def target_text(text):
    compact=re.sub(r'[^a-z0-9]','',text.lower())
    phone=compact.replace('o','0').replace('l','1').replace('i','1')
    if 'apanichevn' in compact or 'wwwapaniche' in compact or '0961596333' in phone:return True
    # Tiny text over a busy photograph may lose several letters. Restrict
    # this fallback to a near-matching website followed by the phone prefix;
    # printed brand names and unrelated product labels cannot satisfy it.
    domain=re.search(r'(www[a-z]{5,12}(?:vn|yn|xn))09',compact)
    if not domain:return False
    expected='wwwapanichevn';distance=list(range(len(expected)+1))
    for index,char in enumerate(domain.group(1),1):
        current=[index]
        for offset,other in enumerate(expected,1):current.append(min(current[-1]+1,distance[offset]+1,distance[offset-1]+(char!=other)))
        distance=current
    return distance[-1]<=3

class Processor:
    def __init__(self,provider='DmlExecutionProvider',load_segment=True,ocr_threads=1):
        cv2.setNumThreads(1)
        self.ocr_params={'Global.log_level':'error','Global.use_cls':False,
          'Global.use_preprocess_img':False,'Global.use_vertical_padding':False,
          'EngineConfig.onnxruntime.intra_op_num_threads':ocr_threads,'EngineConfig.onnxruntime.inter_op_num_threads':1,
          'Global.model_root_dir':str(WORK/'models/ocr'),'Det.limit_type':'max','Det.limit_side_len':1280,
          # Dynamic OCR tensor shapes are not stable on this DirectML driver.
          # Keep OCR on CPU; fixed-shape foreground extraction can use the GPU.
          'EngineConfig.onnxruntime.use_dml':False,
          'Det.ocr_version':OCRVersion.PPOCRV6,'Det.model_type':ModelType.SMALL,'Rec.ocr_version':OCRVersion.PPOCRV4,'Rec.model_type':ModelType.MOBILE,'Rec.lang_type':LangRec.EN}
        self.ocr_local=threading.local()
        if not load_segment:return
        options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
        options.add_session_config_entry('session.intra_op.allow_spinning','0')
        options.add_session_config_entry('session.inter_op.allow_spinning','0')
        if provider=='DmlExecutionProvider':
            options.enable_mem_pattern=False;options.execution_mode=ort.ExecutionMode.ORT_SEQUENTIAL
        providers=[provider] if provider=='CPUExecutionProvider' else [provider,'CPUExecutionProvider']
        self.segment=ort.InferenceSession(str(WORK/'models/u2net.onnx'),sess_options=options,providers=providers)
        self.segment_lock=threading.Lock()
        print(json.dumps({'segmentationProviders':self.segment.get_providers()}),flush=True)

    def detect(self,image,full=False):
        if not hasattr(self.ocr_local,'engine'):self.ocr_local.engine=RapidOCR(params=self.ocr_params)
        ocr=self.ocr_local.engine
        width,height=image.size
        top=0 if full else int(height*.88)
        crop=image.crop((0,top,width,height))
        scale=min(2.5,max(1,1200/width))
        crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
        if full and max(crop.size)>1600:
            ratio=1600/max(crop.size);crop=crop.resize((round(crop.width*ratio),round(crop.height*ratio)));scale*=ratio
        boxes=[]
        if full:
            det_boxes=ocr(np.array(crop),use_cls=False,use_det=True,use_rec=False).boxes
            if det_boxes is None:return boxes
            pieces=[];polygons=[]
            # Only long, small horizontal lines can be the requested URL/phone line.
            for polygon in det_boxes:
                points=np.array(polygon,dtype=np.float32)
                x1,y1=points.min(axis=0);x2,y2=points.max(axis=0)
                if x2-x1<max(60,crop.width*.10) or (x2-x1)/max(1,y2-y1)<7.5 or y2-y1>max(32,crop.height*.07):continue
                piece=crop.crop((max(0,int(x1)-2),max(0,int(y1)-2),min(crop.width,int(x2)+3),min(crop.height,int(y2)+3)))
                pieces.append(np.array(piece));polygons.append((points/scale).tolist())
            if pieces:
                result=ocr._load_rec_model()(TextRecInput(img=pieces,return_word_box=False))
                for polygon,text,score in zip(polygons,result.txts or [],result.scores):
                    if target_text(text):boxes.append({'polygon':polygon,'text':text,'score':float(score)})
            return boxes
        result=ocr(np.array(crop),use_cls=False,use_det=True,use_rec=True,text_score=.35)
        if result.boxes is None or result.txts is None:return boxes
        for polygon,text,score in zip(result.boxes,result.txts,result.scores):
            if target_text(text):
                points=np.array(polygon,dtype=np.float32)/scale;points[:,1]+=top
                boxes.append({'polygon':points.tolist(),'text':text,'score':float(score)})
        return boxes

    def detect_lines(self,image):
        """Locate thin horizontal text with morphology, then recognize just it.

        Scans the entire image, including faint footer text. Product labels are
        candidates too, but only the exact requested domain/phone is selected.
        """
        if not hasattr(self.ocr_local,'engine'):self.ocr_local.engine=RapidOCR(params=self.ocr_params)
        scale=min(2,1600/max(image.size));small=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS) if scale!=1 else image
        gray=cv2.cvtColor(np.array(small),cv2.COLOR_RGB2GRAY)
        kernel=cv2.getStructuringElement(cv2.MORPH_RECT,(max(15,small.width//40),max(5,small.height//100)))
        dark=cv2.morphologyEx(gray,cv2.MORPH_BLACKHAT,kernel)
        light=cv2.morphologyEx(gray,cv2.MORPH_TOPHAT,kernel)
        features=np.uint8(np.maximum(dark,light)>14)*255
        joined=cv2.morphologyEx(features,cv2.MORPH_CLOSE,np.ones((2,max(10,small.width//25)),np.uint8))
        contours,_=cv2.findContours(joined,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        candidates=[]
        for contour in contours:
            x,y,w,h=cv2.boundingRect(contour)
            # The requested URL plus ten-digit phone is a long line. Short
            # captions and bottle names cannot contain that full line.
            if w<max(55,small.width*.075) or h>max(25,small.height*.065) or h<3 or not 9<=w/h<=45:continue
            candidates.append((x,y,w,h))
        candidates.sort(key=lambda box:box[1],reverse=True)
        matches=[];pieces=[];polygons=[]
        for x,y,w,h in candidates[:100]:
            x1=max(0,x-2);y1=max(0,y-2);x2=min(small.width,x+w+2);y2=min(small.height,y+h+2)
            piece=small.crop((x1,y1,x2,y2))
            pieces.append(np.array(piece));polygons.append((np.array([[x1,y1],[x2,y1],[x2,y2],[x1,y2]],np.float32)/scale).tolist())
        if pieces:
            recognizer=self.ocr_local.engine._load_rec_model()
            result=recognizer(TextRecInput(img=pieces,return_word_box=False))
            for polygon,text,score in zip(polygons,result.txts or [],result.scores):
                if target_text(text):matches.append({'polygon':polygon,'text':text,'score':float(score)})
        return matches

    def clean(self,rgba,full_fallback=False,reference_boxes=None,detected_boxes=None):
        opaque=rgba.getextrema()[3][0]==255
        if opaque:rgb=rgba.convert('RGB')
        else:
            white=Image.new('RGBA',rgba.size,'white');white.alpha_composite(rgba);rgb=white.convert('RGB');del white
        footer=np.array(rgb.crop((0,int(rgb.height*.88),rgb.width,rgb.height)))
        gray=cv2.cvtColor(footer,cv2.COLOR_RGB2GRAY)
        boxes=list(detected_boxes) if detected_boxes is not None else (self.detect(rgb) if np.max(gray)-np.min(gray)>10 else [])
        # Collages can repeat the same line inside several panels. Always scan
        # the whole surface, even when a footer match has already been found.
        candidates=[] if detected_boxes is not None else self.detect_lines(rgb)
        if full_fallback and detected_boxes is None:candidates+=self.detect(rgb,full=True)
        for candidate in candidates:
            points=np.array(candidate['polygon']);lo=points.min(axis=0);hi=points.max(axis=0)
            overlaps=[existing for existing in boxes if np.all(np.minimum(hi,np.array(existing['polygon']).max(axis=0))>np.maximum(lo,np.array(existing['polygon']).min(axis=0)))]
            for existing in overlaps:
                points=np.array(existing['polygon']);lo=np.minimum(lo,points.min(axis=0));hi=np.maximum(hi,points.max(axis=0));boxes.remove(existing)
            merged={**candidate,'polygon':[[float(lo[0]),float(lo[1])],[float(hi[0]),float(lo[1])],[float(hi[0]),float(hi[1])],[float(lo[0]),float(hi[1])]]}
            if overlaps:merged['text']=max([candidate['text']]+[box['text'] for box in overlaps],key=len)
            boxes.append(merged)
        # A collage can place the end of a repeated stamp over a busy photo.
        # If OCR clips its phone suffix, use a fully recognized identical stamp
        # on the same image as the width reference, at the same text height.
        for box in boxes:
            if len(re.findall(r'\d',box['text']))>=8:continue
            points=np.array(box['polygon']);lo=points.min(axis=0);hi=points.max(axis=0);height=hi[1]-lo[1];width=hi[0]-lo[0]
            references=[]
            for other in boxes+(reference_boxes or []):
                bounds=np.array(other['polygon']);span=bounds.max(axis=0)-bounds.min(axis=0)
                if len(re.findall(r'\d',other['text']))>=8 and .75*height<=span[1]<=1.35*height:references.append(span[0])
            if references and width<.85*max(references):
                hi[0]=min(rgba.width,lo[0]+max(references))
                box['polygon']=[[float(lo[0]),float(lo[1])],[float(hi[0]),float(lo[1])],[float(hi[0]),float(hi[1])],[float(lo[0]),float(hi[1])]]
        mask=np.zeros((rgba.height,rgba.width),np.uint8)
        for box in boxes:
            polygon=np.rint(box['polygon']).astype(np.int32)
            cv2.fillConvexPoly(mask,polygon,255)
        if not boxes:return rgba,boxes,mask
        mask=cv2.dilate(mask,np.ones((3,3),np.uint8))
        # Inpaint only bounded text regions. Running the solver on a full
        # camera-resolution photo allocates huge maps for untouched pixels.
        regions=[]
        for box in boxes:
            points=np.array(box['polygon']);lo=np.floor(points.min(axis=0)).astype(int)-20;hi=np.ceil(points.max(axis=0)).astype(int)+21
            region=[max(0,int(lo[0])),max(0,int(lo[1])),min(rgba.width,int(hi[0])),min(rgba.height,int(hi[1]))]
            changed=True
            while changed:
                changed=False
                for previous in regions[:]:
                    if region[0]<=previous[2] and previous[0]<=region[2] and region[1]<=previous[3] and previous[1]<=region[3]:
                        region=[min(region[0],previous[0]),min(region[1],previous[1]),max(region[2],previous[2]),max(region[3],previous[3])];regions.remove(previous);changed=True
            regions.append(region)
        output=np.array(rgba)
        # Text on a genuinely transparent footer should disappear into transparency.
        transparent_footer=not opaque and np.mean(np.array(rgba.crop((0,rgba.height-max(4,round(rgba.height*.02)),rgba.width,rgba.height)).getchannel('A')))<220
        for x1,y1,x2,y2 in regions:
            local_mask=mask[y1:y2,x1:x2]
            bgr=cv2.cvtColor(np.array(rgb.crop((x1,y1,x2,y2))),cv2.COLOR_RGB2BGR)
            cleaned=cv2.cvtColor(cv2.inpaint(bgr,local_mask,3,cv2.INPAINT_TELEA),cv2.COLOR_BGR2RGB)
            selected=local_mask>0;target=output[y1:y2,x1:x2]
            target[selected,:3]=cleaned[selected,:]
            if transparent_footer:target[selected,3]=0
        return Image.fromarray(output),boxes,mask

    def cutout(self,rgba):
        old_alpha=np.array(rgba.getchannel('A'))
        if np.mean(old_alpha<8)>.08 and np.mean(old_alpha>200)>.015:
            return rgba,{'method':'existing-alpha','foregroundRatio':round(float(np.mean(old_alpha>128)),4)}
        white=Image.new('RGBA',rgba.size,'white');white.alpha_composite(rgba)
        resized=np.array(white.convert('RGB').resize((320,320),Image.Resampling.LANCZOS),dtype=np.float32)
        normalized=resized/max(float(resized.max()),1)
        normalized=(normalized-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)
        tensor=normalized.transpose(2,0,1)[None].astype(np.float32)
        with self.segment_lock:pred=self.segment.run(None,{self.segment.get_inputs()[0].name:tensor})[0][0,0]
        pred=(pred-pred.min())/max(float(pred.max()-pred.min()),1e-6)
        alpha=np.array(Image.fromarray(np.uint8(np.clip(pred,0,1)*255)).resize(rgba.size,Image.Resampling.LANCZOS))
        # Remove isolated text/shadow noise; retain substantial product/packaging parts.
        count,labels,stats,_=cv2.connectedComponentsWithStats(np.uint8(alpha>96),8)
        if count>1:
            biggest=max(stats[1:,cv2.CC_STAT_AREA]);keep=np.zeros(count,np.uint8)
            for label in range(1,count):
                if stats[label,cv2.CC_STAT_AREA]>=max(20,biggest*.008):keep[label]=1
            allowed=cv2.dilate(keep[labels],np.ones((5,5),np.uint8))>0
            alpha=np.where(allowed,alpha,0).astype(np.uint8)
        alpha[alpha<12]=0;alpha[alpha>245]=255
        ratio=float(np.mean(alpha>128))
        if ratio<.008 or ratio>.98:raise ValueError(f'Unreliable foreground area: {ratio:.4f}')
        output=rgba.copy();output.putalpha(Image.fromarray(np.minimum(alpha,old_alpha)))
        return output,{'method':'u2net','foregroundRatio':round(ratio,4)}

    def process(self,item):
        started=time.monotonic();destination=WORK/'results'/f"{item['key']}.json"
        try:cached=json.loads(destination.read_text(encoding='utf-8')) if destination.exists() else None
        except (json.JSONDecodeError,UnicodeError):
            destination.replace(destination.with_suffix(f'.interrupted-{time.time_ns()}'))
            cached=None
        if cached and (cached.get('pipelineVersion',0)>=3 or cached.get('watermarkMatches')):return cached
        raw=WORK/'originals'/f"{item['key']}.bin"
        download(item['url'],raw)
        try:
            with Image.open(raw) as source:rgba=ImageOps.exif_transpose(source).convert('RGBA')
        except (OSError,ValueError):
            # A stopped machine can leave a previously downloaded cache file
            # incomplete. Preserve it for diagnosis and fetch the source again.
            raw.replace(raw.with_suffix(f'.interrupted-{time.time_ns()}'))
            download(item['url'],raw)
            with Image.open(raw) as source:rgba=ImageOps.exif_transpose(source).convert('RGBA')
        step=time.monotonic();cleaned,boxes,mask=self.clean(rgba,any(term in item['url'].lower() for term in ['thiet-ke','thiet_ke','co-wm','co_wm']));ocr_seconds=time.monotonic()-step
        row={'key':item['key'],'url':item['url'],'avatar':item['avatar'],'width':rgba.width,'height':rgba.height,'watermarkMatches':boxes,'status':'done','pipelineVersion':3}
        if boxes:
            relative=f"output/{item['key']}-clean.webp"
            web_image=cleaned if not item['avatar'] else cleaned.copy()
            if not item['avatar'] and max(web_image.size)>2000:
                web_image.thumbnail((2000,2000),Image.Resampling.LANCZOS);row['webOptimizedSize']=list(web_image.size)
            web_image.save(WORK/relative,lossless=True,quality=100,method=3,exact=True);row['cleanPath']=relative
        if item['avatar']:
            step=time.monotonic()
            if cached and cached.get('cutoutPath') and not boxes:
                row['cutoutPath']=cached['cutoutPath'];row['cutout']=cached['cutout']
            else:
                cutout,stats=self.cutout(cleaned)
                relative=f"output/{item['key']}-cutout.webp";cutout.save(WORK/relative,lossless=True,quality=100,method=3,exact=True);row['cutoutPath']=relative;row['cutout']=stats
            row['cutoutSeconds']=round(time.monotonic()-step,3)
        row['ocrSeconds']=round(ocr_seconds,3)
        row['elapsedSeconds']=round(time.monotonic()-started,3)
        temporary=destination.with_suffix('.part');temporary.write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8');temporary.replace(destination)
        return row

_download_lock=threading.Lock();_last_download=0
_local=threading.local()
def download(url,destination):
    global _last_download
    if destination.exists():return
    if not hasattr(_local,'session'):
        _local.session=requests.Session();_local.session.headers['User-Agent']='VeloursCatalogMediaProcessor/1.0'
    for attempt in range(4):
        with _download_lock:
            wait=max(0,.10-(time.monotonic()-_last_download))
            if wait:time.sleep(wait)
            _last_download=time.monotonic()
        try:response=_local.session.get(url,timeout=(15,65))
        except requests.RequestException:
            if attempt==3:raise
            time.sleep(2**attempt);continue
        if response.status_code==429 or response.status_code>=500:
            time.sleep(min(30,int(response.headers.get('Retry-After','0') or '0') or 2**attempt*2));continue
        response.raise_for_status()
        if len(response.content)>40*1024*1024:raise ValueError('Image is too large')
        part=destination.with_suffix('.part');part.write_bytes(response.content);part.replace(destination);return
    raise RuntimeError('Source unavailable after backoff')

def contact_sheet(items,filename):
    size=250;sheet=Image.new('RGB',(size*4,(len(items)+3)//4*(size+22)),'#f0f4f0');draw=ImageDraw.Draw(sheet)
    for index,item in enumerate(items):
        result=WORK/'results'/f"{item['key']}.json"
        if not result.exists():result=WORK/'extra-results'/f"{item['key']}.json"
        if not result.exists():continue
        row=json.loads(result.read_text(encoding='utf-8'));src=row.get('cutoutPath') or row.get('cleanPath')
        im=Image.open(WORK/src).convert('RGBA') if src else Image.open(WORK/'originals'/f"{item['key']}.bin").convert('RGBA')
        im.thumbnail((size-16,size-16));x=(index%4)*size+(size-im.width)//2;y=(index//4)*(size+22)
        sheet.paste(im,(x,y),im.getchannel('A'));draw.text(((index%4)*size+5,y+size),f"{index}: WM {len(row['watermarkMatches'])} {row['key'][:8]}",fill='black')
    sheet.save(filename,quality=94)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--sample',action='store_true');parser.add_argument('--limit',type=int);parser.add_argument('--workers',type=int,default=3);parser.add_argument('--cpu',action='store_true');parser.add_argument('--retry-errors',action='store_true');parser.add_argument('--gallery-tail',type=int);parser.add_argument('--gallery-only',action='store_true');args=parser.parse_args()
    plan=json.loads((WORK/'plan.json').read_text(encoding='utf-8'))
    items=json.loads((WORK/'samples/selection.json').read_text(encoding='utf-8')) if args.sample else sorted(plan['assets'],key=lambda item:not item['avatar'])
    base_progress=0
    if args.gallery_only:
        ready={p.stem for p in (WORK/'results').glob('*.json')}
        if any(item['key'] not in ready for item in items if item['avatar']):raise RuntimeError('Finish avatars before gallery-only mode')
        base_progress=sum(item['avatar'] for item in items);items=[item for item in items if not item['avatar']]
    if args.gallery_tail:items=list(reversed([item for item in items if not item['avatar']][-args.gallery_tail:]))
    previous_errors={}
    if args.retry_errors:
        previous_errors={item['key']:item for item in json.loads((WORK/'failures.json').read_text(encoding='utf-8'))}
        items=[item for item in items if item['key'] in previous_errors]
    if args.limit:items=items[:args.limit]
    processor=Processor('CPUExecutionProvider' if args.cpu else 'DmlExecutionProvider',load_segment=not (args.gallery_tail or args.gallery_only))
    started=time.monotonic();done=0;failed=[]
    def one(item):
        try:return processor.process(item)
        except Exception as error:return {'key':item['key'],'url':item['url'],'status':'error','error':str(error)}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures=[pool.submit(one,item) for item in items]
        for future in as_completed(futures):
            result=future.result()
            done+=1
            if result['status']=='error':failed.append(result);previous_errors[result['key']]=result;print(json.dumps(result),flush=True)
            else:previous_errors.pop(result['key'],None)
            if done%20==0 or done==len(items):
                progress={'done':done+base_progress,'total':len(items)+base_progress,'failed':len(failed),'elapsedSeconds':round(time.monotonic()-started),'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z')}
                (WORK/('gallery-progress.json' if args.gallery_tail else 'progress.json')).write_text(json.dumps(progress),encoding='utf-8');print(json.dumps(progress),flush=True)
    remaining=list(previous_errors.values()) if args.retry_errors else failed
    (WORK/('gallery-failures.json' if args.gallery_tail else 'failures.json')).write_text(json.dumps(remaining,indent=2),encoding='utf-8')
    if not args.sample and not args.limit and not args.gallery_tail:(WORK/'processing-complete.json').write_text(json.dumps({'total':len(plan['assets']),'failed':len(remaining),'completedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z')}),encoding='utf-8')
    if args.sample:contact_sheet(items,WORK/'samples/processed.jpg')
