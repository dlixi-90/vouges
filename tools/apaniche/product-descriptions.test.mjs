import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseProductDescription,productDescriptionFacts} from './product-description-parser.mjs';
import {buildProductDescription} from './build-product-description.mjs';
import {productDescriptionUpdate} from './product-description-import-plan.mjs';
import {sanitizeArticle,articleToPlainText} from '../../client/src/utils/productArticle.js';
import {mentionsSourceStore} from './library-parser.mjs';
test('source description parsing rejects promotions, placeholders, scripts and nested duplicate content',()=>{
 const parsed=parseProductDescription('<script>evil()</script><h2>Mùi hương</h2><p>Một tổ hợp hoa hồng được kết nối với gỗ và các sắc thái xanh.</p><h2>Mua tại Apa <b>Niche</b></h2><p>Cam kết giao hàng và bảo hành nhanh chóng.</p>');
 assert.equal(parsed.blocks.length,1);assert.ok(parsed.excludedCount>=2);assert.equal(mentionsSourceStore(parsed.blocks[0].text),false);
 assert.equal(parseProductDescription('<p>Đang cập nhật</p><p><img src="x" /></p>').characters,0);
});
test('launch year extraction excludes company foundation context and ambiguous multiple years',()=>{
 assert.equal(productDescriptionFacts(parseProductDescription('<p>Thương hiệu thành lập năm 1900 rồi ra mắt vào năm 2000 với nhiều sáng tạo khác nhau.</p>')).launchYear,null);
 assert.equal(productDescriptionFacts(parseProductDescription('<p>Nước hoa được ra mắt vào năm 2024 với các sắc thái hoa hồng và xạ hương nhẹ.</p>')).launchYear,2024);
});
test('bottle cap colour is never assigned to the bottle body and source note pyramids remain explicit',()=>{
 const facts=productDescriptionFacts(parseProductDescription('<h2>Thiết kế</h2><p>Thân thủy tinh trong suốt và nắp chai màu đen cùng nhãn trắng tạo nên thiết kế tối giản.</p><h2>Mùi hương</h2><ul><li>Hương đầu: bưởi, bạc hà.</li><li>Hương giữa: hoa hồng, vải.</li><li>Hương cuối: gỗ tuyết tùng, tonka.</li></ul>'));
 assert.ok(facts.design.includes('nắp màu đen'));assert.equal(facts.design.includes('tông màu đen'),false);
 assert.deepEqual(facts.articleNotes.top,['bưởi','bạc hà']);assert.deepEqual(facts.articleNotes.base,['gỗ tuyết tùng','tonka']);
});
test('all products are covered, all content is safe and every originally empty source has supplementary research',()=>{
 const a=JSON.parse(fs.readFileSync(new URL('../../data/product-descriptions-2026-11-01.json',import.meta.url))).entries;
 assert.equal(a.length,2324);assert.equal(new Set(a.map(e=>e.id)).size,2324);
 for(const e of a){assert.equal(mentionsSourceStore(e.description),false);assert.equal(articleToPlainText(sanitizeArticle(e.descriptionContent)).trim(),e.description);assert.ok(e.description.split(/\s+/).length<=200);if(e.evidence.sourceCharacters<120)assert.ok(e.evidence.supplementaryUrls.length);}
 assert.equal(a.filter(e=>e.evidence.supplementaryUrls.length).length,30);
});
test('import intentionally replaces owner edits but cannot change inventory, source identity or archived products',()=>{
 const entry=JSON.parse(fs.readFileSync(new URL('../../data/product-descriptions-2026-11-01.json',import.meta.url))).entries[0];
 const product={_id:entry.id,title:entry.title,description:'Nội dung tôi đã tự sửa',descriptionContent:{type:'doc',content:[]},source:{id:entry.sourceId,url:entry.evidence.originalUrl},updatedAt:new Date(entry.expectedUpdatedAt)};
 const set=productDescriptionUpdate(product,entry,new Date());assert.deepEqual(Object.keys(set).sort(),['description','descriptionContent','updatedAt']);assert.equal(set.description,entry.description);
 assert.throws(()=>productDescriptionUpdate({...product,isDeleted:true},entry,new Date()));assert.throws(()=>productDescriptionUpdate({...product,updatedAt:new Date('2000-01-01')},entry,new Date()));
 assert.equal(productDescriptionUpdate({...product,description:entry.description,descriptionContent:entry.descriptionContent},entry,new Date()),null);
});
test('builder never carries previous editor text and keeps accessory/set meanings separate from perfume',()=>{
 const previous='KEEP_MY_CUSTOM_TEXT';
 const product={title:'Vỏ Case',brand:'Test',source:{id:46900},description:previous,fragrance:{profileKind:'accessory'}};
 const article=buildProductDescription(product,{}, {},{design:[],perfumers:[]});
 assert.equal(article.description.includes(previous),false);assert.match(article.description,/phụ kiện/);assert.doesNotMatch(article.description,/Cấu trúc hương/);
});
