import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseFullLibraryArticle} from './library-fulltext.mjs';
import {librarySlug} from '../../client/src/utils/fragranceLibrary.js';
import {articleToPlainText} from '../../client/src/utils/productArticle.js';

const directory='data/library-fulltext-2026-11-01';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const scope=read(path.join(directory,'scope.json')),receipts=new Map(read(path.join(directory,'collection.json')).map(row=>[row.id,row]));
const original=read('data/library-refresh-2026-11-01.json'),mapping=read('data/cloudinary-migration-2026-11-01/url-map.json');
const canonical=value=>{const url=new URL(value);return url.origin+url.pathname.replace('/wp-content/webp-express/webp-images/','/wp-content/').replace(/(\.(?:png|jpe?g|gif))\.webp$/iu,'$1').replace(/-\d+x\d+(?=\.[a-z]+$)/iu,'').replace(/\/$/u,'');};
const assets=new Map(original.assets.map(row=>[canonical(row.sourceUrl),row]));
const mappedImages=new Map(Object.entries(mapping).filter(([url])=>url.startsWith('https://apaniche.vn/')).map(([url,mapped])=>[canonical(url),mapped]));
const routes=new Map(scope.flatMap(row=>[[canonical(row.url),`/knowledge/${row.kind}/${librarySlug({key:row.key,name:row.name})}`]]));
for(const [pathname,kind] of [['thu-vien-nhom-huong','group'],['thu-vien-mui-huong','accord'],['nguon-goc-note-huong','note']])routes.set('https://apaniche.vn/'+pathname,'/knowledge/'+kind);
for(const row of read(path.join(directory,'product-links.json')))if(row.url)routes.set(canonical(row.url),`/collection/${row.id}`);
let downloaded={};try{downloaded=read(path.join(directory,'downloaded-images.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
const missing=new Set(),failures=[],entries=[];
const image=(url,{thumbnail})=>{
 if(downloaded[url])return downloaded[url];
 const asset=assets.get(canonical(url));
 if(asset){const local=thumbnail?asset.src.replace('.webp','-thumb.webp'):asset.src;const src=mapping[local]||local;if(src.startsWith('/')&&!fs.existsSync('client/public'+src))throw Error('Missing collected image '+src);return{src};}
 if(mapping[url])return{src:mapping[url]};
 const candidate=mappedImages.get(canonical(url));
 if(candidate)return{src:candidate};
 missing.add(url);return{src:url};
};
for(const row of scope){
 try{
  const receipt=receipts.get(row.id);if(receipt?.status!=='ok')throw Error('Source not collected');
  const html=fs.readFileSync(path.join(directory,'pages',row.id+'.html'),'utf8');
  if(createHash('sha256').update(html).digest('hex')!==receipt.sha256)throw Error('Source page digest mismatch');
  const parsed=parseFullLibraryArticle(html,row.kind,{url:row.url,resolveImage:image,resolveLink:value=>{const route=routes.get(canonical(value));if(!route)return value;const url=new URL(value);return route==='/knowledge/note'&&url.hash?`${route}#origin-${librarySlug({name:decodeURIComponent(url.hash.slice(1))})}`:route;}});
  const text=articleToPlainText(parsed.descriptionContent);
  entries.push({...row,description:parsed.description,descriptionContent:parsed.descriptionContent,contentStatus:'complete',sourceTitle:parsed.title,sourceSha256:receipt.sha256,fetchedAt:receipt.fetchedAt,relatedHeading:parsed.relatedHeading,sourceTextBlocks:parsed.sourceTextBlocks,sourceCharacters:parsed.sourceCharacters,imageCount:parsed.images.length,images:parsed.images,excluded:parsed.excluded,textCharacters:text.length,documentSha256:createHash('sha256').update(JSON.stringify(parsed.descriptionContent)).digest('hex')});
 }catch(error){failures.push({id:row.id,kind:row.kind,name:row.name,url:row.url,error:error.message});}
}
const report={total:scope.length,prepared:entries.length,failures,missingImages:[...missing],textCharacters:entries.reduce((sum,row)=>sum+row.textCharacters,0),imageInstances:entries.reduce((sum,row)=>sum+row.imageCount,0),maxCharacters:Math.max(...entries.map(row=>row.textCharacters)),maxImages:Math.max(...entries.map(row=>row.imageCount))};
fs.writeFileSync(path.join(directory,'plan.json'),JSON.stringify({authorization:'Full republication authorized by user in this conversation',entries},null,2)+'\n');
fs.writeFileSync(path.join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,missingImages:report.missingImages.length,failures:failures.slice(0,12)}));
if(failures.length)process.exitCode=1;
