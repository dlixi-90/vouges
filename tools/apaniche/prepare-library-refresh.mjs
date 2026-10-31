import fs from 'node:fs';
import path from 'node:path';
import {sanitizeArticle,articleToPlainText} from '../../client/src/utils/productArticle.js';
import {librarySlug} from '../../client/src/utils/fragranceLibrary.js';
import {articleIntroduction,boundParagraphs,sourceExcerpt} from './library-refresh-content.mjs';
import {mentionsSourceStore} from './library-parser.mjs';
const dir='.qa-perfume/library-refresh-2026-11-01';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const rows=read(path.join(dir,'parsed.json')),media=read(path.join(dir,'media.json'));
const directories=read(path.join(dir,'directories.json')),scope=read(path.join(dir,'scope.json'));
const base=read('data/library-editorial-summaries-2026-10-31.json');
const brands=read('data/library-detailed-brands-2026-11-01.json'),notes=read('data/library-detailed-notes-2026-11-01.json');
const overview=read('data/library-overview-editorial-2026-11-01.json');
if(rows.length!==scope.length||rows.length!==1228)throw Error('Incomplete collection');
const byUrl=new Map(media.map(row=>[row.sourceUrl,row]));
const assets=[];
const image=(source,name)=>{
 const found=byUrl.get(source.sourceUrl);if(!found)throw Error(`Missing image: ${source.sourceUrl}`);
 for(const src of [found.src,found.thumbnail])if(!fs.existsSync(path.join('client/public',src)))throw Error(`Missing local image: ${src}`);
 assets.push({sourceUrl:source.sourceUrl,src:found.src,sha256:found.sha256});
 return {src:found.src,thumbnail:found.thumbnail,alt:name,width:found.width,height:found.height};
};
const p=text=>({type:'paragraph',content:[{type:'text',text}]}),h=text=>({type:'heading',attrs:{level:2},content:[{type:'text',text}]});
const entries=rows.map(row=>{
 const {kind,name,content}=row;
 const candidates=[...(row.cover?[row.cover]:[]),...content.media];
 const illustrations=[...new Map(candidates.map(source=>{const asset=image(source,name);return[asset.src,asset];})).values()];
 const manual=kind==='brand'?(brands[name]||base.brand[name]):kind==='note'?(notes[name]||base.note[content.title]||base.note[name]):base[kind][name];
 const paragraphs=boundParagraphs(articleIntroduction(row,manual));
 const excerpt=paragraphs.length?sourceExcerpt(content):'';
 const document=paragraphs.length?{type:'doc',content:[h('Giới thiệu'),...paragraphs.map(p),...(excerpt?[
   {type:'blockquote',content:[p(excerpt)]},p('Trích đoạn bài gốc; phần giới thiệu phía trên được biên soạn lại từ thông tin trong bài.')
 ]:[]),...(illustrations.length?[h('Hình ảnh liên quan'),...illustrations.map(asset=>({type:'image',attrs:{src:asset.src,alt:name,title:'',articleWidth:100}}))]:[])]}:null;
 const descriptionContent=document?sanitizeArticle(document):null;
 const description=descriptionContent?articleToPlainText(descriptionContent).trim():'';
 const words=[...paragraphs,excerpt,'Giới thiệu Hình ảnh liên quan Trích đoạn bài gốc; phần giới thiệu phía trên được biên soạn lại từ thông tin trong bài.'].join(' ').trim().split(/\s+/u).length;
 if(description.length>5000||mentionsSourceStore(description)||words>200)throw Error(`Invalid article: ${name} (${words} words)`);
 if(paragraphs.length&&!excerpt)throw Error(`Missing source excerpt: ${name}`);
 if(illustrations.length>30)throw Error(`Too many article images: ${name}`);
 return {id:row.id,kind,name,key:row.key,sourceUrl:row.url,isNew:Boolean(row.isNew),expectedUpdatedAt:row.expectedUpdatedAt||null,
  description,descriptionContent,image:illustrations[0]?.thumbnail||'',contentStatus:paragraphs.length?'complete':'linked',
  evidence:{url:row.url,fetchedAt:row.fetchedAt,sha256:row.sha256,method:'source-facts-with-short-excerpt-and-original-editorial',excerptWords:excerpt?excerpt.split(/\s+/u).length:0,sourceDerivedWords:words,excludedBlocks:content.excluded.length,illustrations}};
});
const publicDirectories=Object.fromEntries(directories.map(directory=>{
 const images=[...new Map(directory.introMedia.map(source=>{const asset=image(source,`Minh họa ${directory.kind==='group'?'phân loại nhóm hương':'kiểu mùi'}`);return[asset.src,asset];})).values()];
 const origins=directory.origins.map(origin=>({id:librarySlug({name:origin.name}),name:origin.name,description:overview.origins[origin.name],image:origin.media[0]?image(origin.media[0],origin.name).thumbnail:'',termIds:rows.filter(row=>row.kind==='note'&&origin.noteUrls.includes(row.url)).map(row=>row.id)}));
 if(origins.some(origin=>!origin.description||!origin.termIds.length))throw Error('Incomplete origin metadata');
 return[directory.kind,{text:overview[directory.kind],referenceUrl:directory.url,images,origins}];
}));
const manifest={runId:'library-refresh-2026-11-01',audited:1222,total:1228,entries,assets:[...new Map(assets.map(asset=>[asset.sourceUrl,asset])).values()]};
fs.writeFileSync('data/library-refresh-2026-11-01.json',JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync('server/data/libraryDirectory.json',JSON.stringify(publicDirectories,null,2)+'\n');
console.log(JSON.stringify({total:entries.length,complete:entries.filter(e=>e.contentStatus==='complete').length,linked:entries.filter(e=>e.contentStatus==='linked').length,images:manifest.assets.length,localFiles:new Set(manifest.assets.map(a=>a.src)).size,origins:publicDirectories.note.origins.length,newTerms:entries.filter(e=>e.isNew).map(e=>e.name)},null,2));
