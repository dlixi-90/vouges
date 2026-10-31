import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseLibraryArticle,parseLibraryDirectory,imageInfo} from './library-source-media.mjs';
import {parseTree} from './product-parser.mjs';
import {mentionsSourceStore} from './library-parser.mjs';
import {validateRefreshEntry} from './library-refresh-plan.mjs';
import {noteIntroduction,sourceExcerpt} from './library-refresh-content.mjs';
import {sanitizeArticle} from '../../client/src/utils/productArticle.js';
const load=name=>JSON.parse(fs.readFileSync(new URL(`../../data/${name}`,import.meta.url),'utf8'));
const manifest=load('library-refresh-2026-11-01.json');

test('editorial photos never pull recommended product grids from a note parent',()=>{
 const html='<main><h1>Hoa</h1><div><div class="note-huong-banner"><img data-lazy-src="/wp-content/uploads/hero.png" alt="Apa Niche" /></div><div class="des-noteh"><p>Hương hoa sáng.</p></div><div class="products"><img src="/wp-content/uploads/product.jpg" /></div></div></main>';
 const row=parseLibraryArticle(html,'note','https://apaniche.vn/note-huong-hoa');
 assert.equal(row.media.length,1);assert.equal(row.media[0].sourceUrl,'https://apaniche.vn/wp-content/uploads/hero.png');assert.equal(row.media[0].alt,'');
});

test('directory covers use lazy images, while unsafe or unrelated image hosts are excluded',()=>{
 const html='<main><a href="/nhom-huong-go"><img src="/placeholder.gif" data-lazy-src="/wp-content/uploads/woody.jpg"/>Gỗ</a></main>';
 const row=parseLibraryDirectory(html,'group','https://apaniche.vn/thu-vien-nhom-huong');
 assert.equal(row.cards.length,1);assert.equal(row.cards[0].media[0].sourceUrl,'https://apaniche.vn/wp-content/uploads/woody.jpg');
 for(const src of ['javascript:alert(1)','https://other.example/uploads/a.jpg','http://apaniche.vn/uploads/a.jpg','https://apaniche.vn/uploads/a.svg']){
  const tree=parseTree(`<img src="${src}"/>`);assert.equal(imageInfo(tree.children[0],'https://apaniche.vn'),null);
 }
});

test('source facts retain geography without turning arbitrary English pairs into botanical names',()=>{
 const content={englishName:'Musk',group:'Xạ Hương',blocks:[{type:'paragraph',text:'Musk hay còn gọi là xạ hương mang mùi ấm và sạch. Vật liệu này được tái tạo bằng chất hương tổng hợp.'}]};
 assert.doesNotMatch(noteIntroduction(content,'Xạ Hương').join(' '),/Tên thực vật/);
 assert.ok(sourceExcerpt(content).split(/\s+/u).length<=20);
 const bergamot={blocks:[{type:'paragraph',text:'Cam Citrus bergamia được trồng ở Calabria. Vỏ có mùi cam chanh và được ép lạnh.'}]};
 assert.match(noteIntroduction(bergamot,'Cam').join(' '),/Citrus bergamia/);
 assert.match(noteIntroduction(bergamot,'Cam').join(' '),/Calabria/);
});

test('refresh refuses concurrent edits, changed identities, collisions and untrusted content',()=>{
 const entry=manifest.entries.find(row=>!row.isNew),current={...entry,updatedAt:new Date(entry.expectedUpdatedAt)};
 assert.doesNotThrow(()=>validateRefreshEntry(current,entry));
 for(const mutation of [{name:'Changed'},{sourceUrl:'https://example.com'},{key:'other'},{kind:'other'},{updatedAt:new Date('2000-01-01')}])assert.throws(()=>validateRefreshEntry({...current,...mutation},entry));
 assert.throws(()=>validateRefreshEntry(null,entry));
 const added=manifest.entries.find(row=>row.isNew);assert.doesNotThrow(()=>validateRefreshEntry(null,added));assert.throws(()=>validateRefreshEntry(current,added));
 assert.throws(()=>validateRefreshEntry(current,{...entry,description:'Apa Niche'}));
 assert.throws(()=>validateRefreshEntry(current,{...entry,image:'https://example.com/uncollected.jpg'}));
});

test('all 1228 reconciled terms have bounded source-backed text, with empty sources recorded honestly',()=>{
 assert.equal(manifest.entries.length,1228);assert.equal(new Set(manifest.entries.map(row=>row.id)).size,1228);
 assert.equal(new Set(manifest.entries.map(row=>`${row.kind}:${row.key}`)).size,1228);
 assert.equal(manifest.entries.filter(row=>row.contentStatus==='complete').length,1203);
 assert.equal(manifest.entries.filter(row=>row.contentStatus==='linked').length,25);
 assert.equal(manifest.entries.filter(row=>row.isNew).length,6);
 for(const row of manifest.entries){
  assert.equal(mentionsSourceStore(row.description),false,row.name);assert.equal(row.evidence.sha256.length,64);
  assert.ok(row.evidence.sourceDerivedWords<=200,row.name);assert.ok(row.evidence.excerptWords<=20,row.name);
  if(row.contentStatus==='complete'){
   assert.deepEqual(sanitizeArticle(row.descriptionContent),row.descriptionContent);
   assert.equal(row.descriptionContent.content.find(n=>n.type==='blockquote').content[0].content[0].text.split(/\s+/u).length,row.evidence.excerptWords);
  }else{assert.equal(row.descriptionContent,null);assert.equal(row.description,'');}
 }
});

test('all collected illustrations have local full frames and thumbnails, and all origins have valid memberships',()=>{
 assert.equal(manifest.assets.length,2854);
 const ids=new Set(manifest.entries.filter(row=>row.kind==='note').map(row=>row.id));
 for(const asset of manifest.assets){
  assert.ok(asset.sourceUrl.startsWith('https://apaniche.vn/'));assert.equal(asset.sha256.length,64);
  for(const src of [asset.src,asset.src.replace('.webp','-thumb.webp')])assert.ok(fs.statSync(new URL(`../../client/public${src}`,import.meta.url)).size>0,src);
 }
 const directories=JSON.parse(fs.readFileSync(new URL('../../server/data/libraryDirectory.json',import.meta.url),'utf8'));assert.equal(directories.note.origins.length,16);
 for(const origin of directories.note.origins){assert.ok(origin.description);assert.ok(origin.image.startsWith('/images/library/'));assert.ok(origin.termIds.length);for(const id of origin.termIds)assert.ok(ids.has(id));}
});
