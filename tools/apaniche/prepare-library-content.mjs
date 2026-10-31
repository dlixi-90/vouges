import fs from 'node:fs';
import path from 'node:path';
import {parseLibraryPage,mentionsSourceStore} from './library-parser.mjs';
import {summarizeNote} from './library-note-summary.mjs';
import {sanitizeArticle,articleToPlainText} from '../../client/src/utils/productArticle.js';

const dir='.qa-perfume/library-content-2026-10-31';
const audit=JSON.parse(fs.readFileSync(path.join(dir,'audit.json'))).terms;
const collected=JSON.parse(fs.readFileSync(path.join(dir,'collected.json')));
const summaries=JSON.parse(fs.readFileSync('data/library-editorial-summaries-2026-10-31.json'));
const paragraph=text=>({type:'paragraph',content:[{type:'text',text}]});
const entries=[],missing=[],review=[];
for(const row of audit){
 const evidence=collected.find(r=>r.id===row.id);
 if(evidence?.httpStatus!==200)throw Error(`Source unavailable: ${row.id}`);
 const content=parseLibraryPage(fs.readFileSync(path.join(dir,'pages',`${row.id}.html`),'utf8'),row.kind);
 const name=row.name.trim()||content.title.trim();
 if(!name||mentionsSourceStore(name))throw Error(`Invalid name: ${row.id}`);
 if(!content.blocks.length){missing.push({id:row.id,kind:row.kind,name,url:row.url,reason:content.reason});continue;}
 let paragraphs,method='original-editorial-summary';
 const manual=summaries[row.kind]?.[row.kind==='note'?content.title:row.name];
 if(manual)paragraphs=manual.split(/\n\n+/);
 else if(row.kind==='note'){
  const result=summarizeNote(content,name);paragraphs=result.paragraphs;method='structured-source-facts';
  if(result.needsReview)review.push({id:row.id,name,title:content.title});
 }else throw Error(`Missing editorial summary: ${row.kind} ${name}`);
 const document=sanitizeArticle({type:'doc',content:paragraphs.map(paragraph)});
 const description=articleToPlainText(document).trim();
 if(mentionsSourceStore(description)||description.split(/\s+/u).length>200||description.length<50)throw Error(`Invalid public content: ${name}`);
 // No long verbatim source passages. These are factual summaries, not article copies.
 const tokens=value=>value.normalize('NFC').toLocaleLowerCase('vi-VN').split(/\s+/u);
 const source=tokens(content.blocks.map(b=>b.text).join(' ')).join(' '),words=tokens(description);
 for(let i=0;i<=words.length-18;i++)if(source.includes(words.slice(i,i+18).join(' ')))throw Error(`Long verbatim passage: ${name}`);
 entries.push({id:row.id,kind:row.kind,name,key:row.key,expectedUpdatedAt:row.updatedAt,description,descriptionContent:document,
  evidence:{url:row.url,fetchedAt:evidence.fetchedAt,sha256:evidence.sha256,excludedBlocks:content.excluded.length,method}});
}
if(review.length){console.log(JSON.stringify({review},null,2));process.exitCode=1;}
else{
 const result={runId:'library-content-2026-10-31',audited: audit.length,entries,missing};
 fs.writeFileSync('data/library-content-import-2026-10-31.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({audited:audit.length,prepared:entries.length,filledNames:entries.filter(e=>!audit.find(a=>a.id===e.id).name).length,missing},null,2));
}
