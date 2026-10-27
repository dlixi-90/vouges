import unittest
import numpy as np
from PIL import Image,ImageDraw
from process_catalog import Processor,target_text

class ProcessingTests(unittest.TestCase):
    def test_only_requested_watermark_text_is_selected(self):
        for text in ['www.apaniche.vn - 0961596333','www.apaniche.vn - 0961 596 333','apaniche.vn','www.epanicne.yn - 09otgpdy']:
            self.assertTrue(target_text(text))
        for text in ['APANICHE','APA NICHE','Dior Sauvage','EAU DE PARFUM 100ml','www.dior.com','www.amazon.vn - 0901234567','www.diptyqueparis.com - 0901234567']:
            self.assertFalse(target_text(text))

    def test_inpainting_preserves_all_pixels_outside_requested_text(self):
        image=Image.new('RGBA',(300,300),'white');draw=ImageDraw.Draw(image)
        draw.rectangle((110,50,190,220),fill='#426457');draw.text((115,120),'DIOR',fill='white')
        draw.text((40,270),'www.apaniche.vn - 0961596333',fill='black')
        processor=Processor.__new__(Processor)
        processor.detect_lines=lambda _:[{'polygon':[[37,267],[285,267],[285,289],[37,289]],'text':'www.apaniche.vn - 0961596333','score':1}]
        processor.detect=processor.detect_lines
        clean,boxes,mask=processor.clean(image)
        before=np.array(image);after=np.array(clean)
        self.assertTrue(np.array_equal(before[mask==0],after[mask==0]))
        self.assertTrue(np.array_equal(before[50:221,110:191],after[50:221,110:191]))
        self.assertEqual(len(boxes),1)
        self.assertFalse(np.array_equal(before[mask>0],after[mask>0]))

    def test_existing_alpha_is_preserved_without_redrawing(self):
        image=Image.new('RGBA',(100,100),(0,0,0,0));ImageDraw.Draw(image).rectangle((30,10,70,90),fill=(20,45,60,255))
        processor=Processor.__new__(Processor)
        result,stats=processor.cutout(image)
        self.assertEqual(stats['method'],'existing-alpha')
        self.assertTrue(np.array_equal(np.array(image),np.array(result)))

    def test_footer_does_not_hide_repeated_stamps_inside_a_collage(self):
        image=Image.new('RGBA',(400,400),'white');draw=ImageDraw.Draw(image)
        stamps=[]
        for x,y in [(10,170),(210,170),(10,370),(210,370)]:
            draw.text((x,y),'www.apaniche.vn',fill='black')
            stamps.append({'polygon':[[x-1,y-1],[x+145,y-1],[x+145,y+12],[x-1,y+12]],'text':'www.apaniche.vn - 0961596333','score':1})
        draw.rectangle((170,30,230,140),fill='#294c63')
        processor=Processor.__new__(Processor)
        processor.detect=lambda _,full=False:stamps if full else stamps[-1:]
        processor.detect_lines=lambda _:stamps[:1]
        cleaned,boxes,mask=processor.clean(image,full_fallback=True)
        self.assertEqual(len(boxes),4)
        before=np.array(image);after=np.array(cleaned)
        for stamp in stamps:
            x,y=stamp['polygon'][0]
            self.assertTrue(mask[y+3:y+10,x+1:x+100].any())
        self.assertTrue(np.array_equal(before[30:141,170:231],after[30:141,170:231]))

if __name__=='__main__':unittest.main()
