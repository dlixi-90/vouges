import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planLibraryImport} from './library-import-plan.mjs';
import {summarizeNote} from './library-note-summary.mjs';
import {parseLibraryPage,mentionsSourceStore} from './library-parser.mjs';
const current={_id:'one',kind:'note',key:'https://example.com/note',sourceUrl:'https://example.com/note',name:'',description:'',updatedAt:new Date('2026-10-01')};
const description='Hương hoa nhẹ với sắc thái xanh, mang lại cảm giác thoáng và mềm.';
const entry={id:'one',kind:'note',name:'Hoa',key:current.key,expectedUpdatedAt:current.updatedAt.toISOString(),description,descriptionContent:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:description}]}]},evidence:{url:current.sourceUrl,method:'test'}};
test('import preserves authored content and rejects stale/changed identities',()=>{
 for(const changed of [{description:'Tự biên soạn'},{descriptionContent:{type:'doc'}},{updatedAt:new Date()},{key:'changed'},{sourceUrl:'changed'}])assert.throws(()=>planLibraryImport({...current,...changed},entry,'test',new Date()));
 const update=planLibraryImport(current,entry,'test',new Date());assert.equal(update.name,'Hoa');assert.equal(update.contentStatus,'complete');assert.equal(update.image,undefined);assert.equal(update.key,undefined);
 assert.equal(planLibraryImport({...current,description,contentImport:{runId:'test'}},entry,'test',new Date()),null);
});
test('no merchant promotion or malformed rich content can be imported',()=>{
 assert.throws(()=>planLibraryImport(current,{...entry,description:'Apa Niche'},'test',new Date()));
 assert.throws(()=>planLibraryImport(current,{...entry,descriptionContent:{type:'script'}},'test',new Date()));
});
test('note facts avoid partial-word, negation and neutral cooling inventions',()=>{
 const content=text=>({blocks:[{type:'paragraph',text}]});
 assert.equal(summarizeNote(content('Sản phẩm này không có mùi gỗ khô.'),'A').descriptors.includes('khô'),false);
 const neutral=summarizeNote(content('Gần như không mùi, tạo cảm giác trung tính.'),'B');
 assert.equal(neutral.needsReview,false);assert.doesNotMatch(neutral.paragraphs.join(' '),/mát/);
 assert.equal(summarizeNote(content('Vỏ quả có màu xanh và hạt rất khô.'),'C').descriptors.length,0);
});
test('placeholder source content stays missing',()=>{
 assert.equal(parseLibraryPage('<main><h1>Cam Đắng</h1><div class="des-noteh">Đang cập nhật</div></main>','note').blocks.length,0);
});
test('all prepared articles are unique, bounded and promotion-free',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../data/library-content-import-2026-10-31.json',import.meta.url)));
 assert.equal(manifest.entries.length,1203);assert.equal(manifest.missing.length,19);
 assert.equal(new Set(manifest.entries.map(e=>e.id)).size,1203);
 for(const row of manifest.entries){assert.equal(mentionsSourceStore(row.description),false);assert.ok(row.description.split(/\s+/).length<=200);assert.equal(row.evidence.sha256.length,64);}
});
