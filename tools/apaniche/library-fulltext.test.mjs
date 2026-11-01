import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFullLibraryArticle} from './library-fulltext.mjs';
import {sanitizeArticle,articleToPlainText,getArticleDocument,LIBRARY_ARTICLE_LIMITS} from '../../client/src/utils/productArticle.js';

const url='https://apaniche.vn/mui-huong-go';
test('full articles preserve source paragraphs, lists, formatting and inline image order without generated annotations',()=>{
 const long=Array.from({length:220},(_,i)=>`word${i}`).join(' ');
 const html=`<header>Navigation</header><main><nav class="breadcrumbs">Old home</nav><span class="sub-title">Library label</span><h1>Source title</h1><h4>Woody</h4><p><strong>Opening</strong> ${long}</p><p>Before<img data-lazy-src="/wp-content/uploads/inline.jpg" alt="Original image">After</p><h2>Original section</h2><ul><li>First <em>item</em></li><li>Second item</li></ul><figure><img src="/wp-content/uploads/last.jpg"><figcaption>Original caption</figcaption></figure></main>`;
 const result=parseFullLibraryArticle(html,'accord',{url,resolveImage:src=>({src:src.endsWith('inline.jpg')?'/images/library/inline.webp':'/images/library/last.webp'})});
 const plain=articleToPlainText(result.descriptionContent);
 assert.ok(plain.includes(long));assert.ok(plain.includes('Original section'));assert.ok(plain.includes('First item'));
 assert.equal(plain.includes('Hình ảnh liên quan'),false);assert.equal(plain.includes('Library label'),false);assert.equal(plain.includes('Old home'),false);
 const before=result.descriptionContent.content.findIndex(node=>articleToPlainText(node)==='Before');
 assert.equal(result.descriptionContent.content[before+1].type,'image');assert.equal(articleToPlainText(result.descriptionContent.content[before+2]),'After');
 assert.equal(result.descriptionContent.content.at(-1).attrs.title,'Original caption');
});
test('linked note grids and editorial product recommendations retain their real source labels and descriptions',()=>{
 const html='<main><h1>Group</h1><div id="list-nhdt"><h2>Original related notes</h2><div class="row"><div class="col"><a href="/note-huong-hoa"><img src="/wp-content/uploads/flower.png"><h4>Hoa</h4><small>Flower</small></a></div></div></div><div id="list-spnhd"><h3>Original examples</h3><div class="row"><div class="col"><img src="/wp-content/uploads/product.png"></div><div class="col"><a href="/perfume">Perfume</a></div><div class="col">All original descriptive details.</div></div></div><p class="tt-bk">Sản phẩm sử dụng note hương Hoa</p><div class="product-small">Dynamic prices and stock</div></main>';
 const result=parseFullLibraryArticle(html,'group',{url,resolveLink:href=>href.endsWith('/note-huong-hoa')?'/knowledge/note/hoa':href});
 const cards=result.descriptionContent.content.filter(node=>node.type==='libraryCards');
 assert.equal(cards.length,2);assert.equal(cards[0].attrs.items[0].href,'/knowledge/note/hoa');assert.equal(cards[0].attrs.items[0].englishName,'Flower');
 assert.equal(cards[1].attrs.items[0].description,'All original descriptive details.');
 assert.equal(articleToPlainText(result.descriptionContent).includes('Dynamic prices and stock'),false);
 assert.equal(result.relatedHeading,'Sản phẩm sử dụng note hương Hoa');
});
test('extended library blocks remain safe and cannot silently bypass ordinary product article limits',()=>{
 const cards={type:'libraryCards',attrs:{columns:4,items:[{name:'Flower',href:'/knowledge/note/hoa',image:'/images/library-source/flower.png'}]}};
 const value={type:'doc',content:[cards]};
 assert.throws(()=>sanitizeArticle(value));assert.deepEqual(getArticleDocument(value,'',LIBRARY_ARTICLE_LIMITS),sanitizeArticle(value,LIBRARY_ARTICLE_LIMITS));
 for(const href of ['javascript:alert(1)','https://user:pass@example.com'])assert.throws(()=>sanitizeArticle({type:'doc',content:[{...cards,attrs:{...cards.attrs,items:[{name:'Unsafe',href}]}}]},LIBRARY_ARTICLE_LIMITS));
 assert.throws(()=>sanitizeArticle({type:'doc',content:[{...cards,attrs:{columns:12,items:cards.attrs.items}}]},LIBRARY_ARTICLE_LIMITS));
 const pictures={type:'doc',content:Array.from({length:40},()=>({type:'image',attrs:{src:'/images/library/source.webp'}}))};
 assert.throws(()=>sanitizeArticle(pictures));assert.equal(sanitizeArticle(pictures,LIBRARY_ARTICLE_LIMITS).content.length,40);
});
