import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {parseProductArticle} from './product-article-parser.mjs';
import {buildProductArticle,designDetails,articleWords} from './build-product-article.mjs';
import {productArticleUpdate} from './product-article-import-plan.mjs';
import {sanitizeArticle,articleToPlainText} from '../../client/src/utils/productArticle.js';
import {mentionsSourceStore} from './library-parser.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../../data/product-article-media-2026-11-01.json',import.meta.url),'utf8'));

test('article images retain lower-page order and sections, use lazy sources and exclude executable URLs',()=>{
 const html='<h2>Giới thiệu</h2><p>Đây là bài giới thiệu hương thơm với các nguyên liệu hoa và gỗ.</p><img data-lazy-src="/wp-content/uploads/intro.jpg" src="data:image/gif,placeholder"/><h2>Thiết kế</h2><p>Thân chai trong suốt và nắp kim loại tạo những đường nét rõ ràng.</p><img src="/wp-content/uploads/design.png"/><h2>Mùi hương</h2><img src="/wp-content/uploads/scent.webp"/><img src="/wp-content/uploads/scent.webp"/><img src="javascript:alert(1)"/>';
 const row=parseProductArticle(html,'https://apaniche.vn/product');
 assert.deepEqual(row.images.map(image=>image.section),['intro','design','scent']);assert.equal(row.images[0].sourceUrl,'https://apaniche.vn/wp-content/uploads/intro.jpg');assert.equal(row.rejected.length,1);
});

test('branded/commercial paragraphs stay excluded without losing their actual product illustrations',()=>{
 const row=parseProductArticle('<h2>Thiết kế</h2><p>Thân chai trong suốt giúp nhìn thấy màu dung dịch ở bên trong chai.</p><h2>Mua tại Apa Niche</h2><p>Đặt hàng ngay, cam kết giao hàng miễn phí.</p><img src="/wp-content/uploads/product.jpg"/>','https://apaniche.vn/product');
 assert.equal(row.blocks.length,1);assert.equal(row.images.length,1);assert.equal(mentionsSourceStore(row.blocks[0].text),false);
});

test('source design distinguishes cap details from the bottle and does not invent a pyramid for one-note phases',()=>{
 const article=parseProductArticle('<h2>Thiết kế</h2><p>Thân chai thủy tinh trong suốt. Nắp chai màu đen, có những vân tối màu trên bề mặt.</p><h2>Mùi hương</h2><p>Hương thơm gỗ dịu với nét gia vị ngọt và cảm giác hoa mềm.</p><p>Hương đầu: Gỗ đàn hương.</p><p>Hương giữa: Bạch đậu khấu.</p><p>Hương cuối: Hoa vòi voi.</p>','https://apaniche.vn/product');
 assert.ok(designDetails(article).includes('nắp màu đen'));assert.equal(designDetails(article).includes('thân chai phủ vàng'),false);
 const result=buildProductArticle({title:'Scent',brand:'Brand',fragrance:{}},article,new Map(),{descriptionContent:{type:'doc',content:[]}});
 assert.match(result.description,/Các note được ghi nhận/);assert.doesNotMatch(result.description,/Phần mở đầu có/);
});

test('the requested Adone example includes three inline pictures in the matching text sections',()=>{
 const entry=manifest.entries.find(row=>row.sourceId===50121);assert.equal(entry.imageCount,3);
 assert.match(entry.description,/Maurizio Cerizza/);assert.match(entry.description,/Aphrodite và Adonis/);assert.match(entry.description,/vân đen/);
 assert.deepEqual(entry.descriptionContent.content.map(node=>node.type),['heading','paragraph','image','heading','paragraph','image','heading','paragraph','image']);
 assert.equal(manifest.verification.apiIsLowerPageArticle,true);assert.equal(manifest.verification.matchedArticlePhotos,3);
});

test('all active products have bounded safe articles and every publicly available source image is represented',()=>{
 assert.equal(manifest.entries.length,2324);assert.equal(new Set(manifest.entries.map(row=>row.id)).size,2324);
 assert.equal(manifest.entries.filter(row=>row.imageCount).length,2323);assert.equal(manifest.entries.reduce((n,row)=>n+row.imageCount,0),8382);
 const byUrl=new Map(manifest.assets.map(asset=>[asset.sourceUrl,asset]));
 for(const row of manifest.entries){
  assert.ok(isDeepStrictEqual(sanitizeArticle(row.descriptionContent),row.descriptionContent));assert.equal(articleToPlainText(row.descriptionContent).trim(),row.description);
  assert.equal(mentionsSourceStore(row.description),false,row.title);assert.ok(articleWords(row.descriptionContent)>=20&&articleWords(row.descriptionContent)<=200,row.title);
  assert.equal(row.evidence.sourceField,'description');
  const expected=new Set(row.evidence.imageUrls.filter(url=>!row.evidence.unavailableImages.some(image=>image.sourceUrl===url)).map(url=>{assert.ok(byUrl.has(url));return byUrl.get(url).src;}));
  const nodes=row.descriptionContent.content.filter(node=>node.type==='image');assert.deepEqual(new Set(nodes.map(node=>node.attrs.src)),expected);
  for(const node of nodes){assert.ok(node.attrs.width>0&&node.attrs.height>0);assert.ok(node.attrs.src.startsWith('/images/'));}
 }
 assert.equal(manifest.entries.filter(row=>row.evidence.supplementaryUrls.length).length,30);
 const inaccessible=manifest.entries.flatMap(row=>row.evidence.unavailableImages);assert.equal(inaccessible.length,1);assert.equal(inaccessible[0].reason,'requires-authentication');
});

test('all 8373 image URL receipts map to present, nonempty original-frame assets',()=>{
 assert.equal(manifest.assets.length,8373);
 assert.equal(new Set(manifest.assets.map(asset=>asset.src)).size,8361);
 for(const asset of manifest.assets){assert.equal(asset.sha256.length,64);assert.ok(fs.statSync(new URL(`../../client/public${asset.src}`,import.meta.url)).size>0);assert.ok(asset.width>0&&asset.height>0);}
});

test('import changes only article fields, rejects stale identities/archives and is idempotent',()=>{
 const entry=manifest.entries[0],product={_id:entry.id,title:entry.title,source:{id:entry.sourceId,url:entry.evidence.originalUrl},updatedAt:new Date(entry.expectedUpdatedAt),description:'Owner edit',descriptionContent:null,price:{'50ml':100},stockBySize:{'50ml':7},images:['existing-gallery.webp']};
 const update=productArticleUpdate(product,entry,new Date());assert.deepEqual(Object.keys(update).sort(),['description','descriptionContent','updatedAt']);assert.equal(update.description,entry.description);
 assert.throws(()=>productArticleUpdate({...product,isDeleted:true},entry,new Date()));assert.throws(()=>productArticleUpdate({...product,source:{...product.source,id:1}},entry,new Date()));assert.throws(()=>productArticleUpdate({...product,updatedAt:new Date(0)},entry,new Date()));
 assert.equal(productArticleUpdate({...product,...update},entry,new Date()),null);
 assert.throws(()=>productArticleUpdate(product,{...entry,description:'Apa Niche'},new Date()));
});
