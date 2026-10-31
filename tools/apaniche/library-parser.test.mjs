import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLibraryPage,mentionsSourceStore} from './library-parser.mjs';
test('store names are detected across case, accents, whitespace and punctuation',()=>{
 for(const value of ['Apa Niche','APA NICHE','apa\n niche','apaniche.vn','Apa-Niche','Ápá Niche'])assert.ok(mentionsSourceStore(value));
 assert.equal(mentionsSourceStore('Cam Bergamot'),false);
});
test('notes use only their introduction and factual name/family, without navigation or products',()=>{
 const html='<main><div id="ab-snote"><h1>Cam Bergamot</h1><h2 class="note-huong-english">Bergamot</h2><nav>Apa Niche / Note</nav><div class="group-noteh">Nhóm: Cam Chanh</div></div><div class="des-noteh">Vỏ quả có mùi thanh mát, hơi đắng.</div><div id="note-product-list"><p>Fake product facts</p></div></main><footer>Fake footer</footer>';
 const r=parseLibraryPage(html,'note');assert.equal(r.title,'Cam Bergamot');assert.equal(r.englishName,'Bergamot');assert.equal(r.group,'Cam Chanh');
 assert.deepEqual(r.blocks,[{type:'paragraph',text:'Vỏ quả có mùi thanh mát, hơi đắng.'}]);
});
test('branded paragraphs and commercial sections are removed whole, including inline-split names',()=>{
 const html='<main><h1>Nước Hoa Example</h1><div class="term-description"><h2>Lịch sử</h2><p>Thương hiệu được thành lập năm 1990.</p><p>Phân phối tại <b>Apa</b> <em>Niche</em> với khuyến mại.</p><h2>Mua nước hoa chính hãng ở đâu?</h2><p>Địa chỉ và khuyến mại của cửa hàng.</p></div></main>';
 const r=parseLibraryPage(html,'brand');assert.equal(r.blocks.length,2);assert.ok(r.excluded.length>=2);assert.ok(r.blocks.every(b=>!mentionsSourceStore(b.text)));
});
test('a page without an actual introduction is recorded as missing instead of using a product list',()=>{
 const r=parseLibraryPage('<main><h1>Brand</h1><p>Product listing only</p></main>','brand');assert.deepEqual(r.blocks,[]);assert.equal(r.reason,'no-description-container');
});
test('nested duplicate accord paragraphs are collected once and PHP debris never becomes copy',()=>{
 const r=parseLibraryPage('<main><h1>Gỗ</h1><div class="mui-huong-right"><p><div class="desc"><p>Đàn hương có nét kem.</p></div></p></div><div class="thu-vien-extra"><h2>Vai trò <?php the_title(); ?></h2><p>Đàn hương có nét kem.</p></div></main>','accord');
 assert.equal(r.blocks.filter(b=>b.text==='Đàn hương có nét kem.').length,1);assert.ok(r.blocks.every(b=>!b.text.includes('php')));
});
