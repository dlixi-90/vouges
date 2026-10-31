import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import crypto from 'node:crypto';
import {buildProductArticle} from './build-product-article.mjs';
const dir='.qa-perfume/product-article-media-2026-11-01';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const products=read(path.join(dir,'products.json')).filter(p=>!p.isDeleted),sources=read(path.join(dir,'parsed.json'));
const media=read(path.join(dir,'media.json')),assets=new Map(media.map(asset=>[asset.sourceUrl,asset]));
const previous=new Map(read('data/product-descriptions-2026-11-01.json').entries.map(row=>[row.id,row]));
const overrides=read('data/product-article-editorial-2026-11-01.json');
const unavailable=read('data/product-article-unavailable-media-2026-11-01.json');
const entries=[],missing=[];
for(const product of products){
 const row=sources.find(row=>row.id===product.source.id);if(!row)throw Error(`Missing source: ${product.title}`);
 if(new URL(row.permalink).pathname.replace(/\/$/u,'')!==new URL(product.source.url).pathname.replace(/\/$/u,''))throw Error(`Source identity changed: ${product.title}`);
 const unavailableImages=[];
 for(const image of row.article.images)if(!assets.has(image.sourceUrl)){
  const recorded=unavailable.find(record=>record.sourceId===row.id&&record.urlSha256===crypto.createHash('sha256').update(image.sourceUrl).digest('hex')&&record.reason==='requires-authentication');
  if(recorded)unavailableImages.push({...recorded,sourceUrl:image.sourceUrl});
  else missing.push({productId:String(product._id),sourceUrl:image.sourceUrl});
 }
 const fallback=previous.get(String(product._id));if(!fallback)throw Error(`Missing researched fallback: ${product.title}`);
 const article=buildProductArticle(product,row.article,assets,fallback,overrides[row.id]);
 const expectedImages=new Set(row.article.images.map(image=>assets.get(image.sourceUrl)?.src).filter(Boolean));
 if(article.imageCount!==expectedImages.size)throw Error(`Illustration omitted: ${product.title}`);
 for(const src of expectedImages)if(!fs.existsSync(path.join('client/public',src)))throw Error(`Missing local image: ${src}`);
 entries.push({id:String(product._id),sourceId:row.id,title:product.title,expectedUpdatedAt:product.updatedAt,...article,
  evidence:{originalUrl:product.source.url,...row.evidence,sourceCharacters:row.article.characters,sourceField:'description',excludedBlocks:row.article.excludedCount,
   supplementaryUrls:row.article.characters<120?fallback.evidence.supplementaryUrls:[],imageUrls:row.article.images.map(image=>image.sourceUrl),unavailableImages,
   method:row.article.characters<120?'researched-supplement-with-source-illustrations':'original-summary-of-lower-page-article-with-inline-illustrations'}});
}
if(missing.length)throw Error(`Images still unavailable: ${JSON.stringify(missing)}`);
const manifest={runId:'product-article-media-2026-11-01',scope:'all-non-deleted-products; replace prior descriptions; original lower-page description only',entries,
 assets:media.map(({sourceUrl,src,sha256,width,height})=>({sourceUrl,src,sha256,width,height})),verification:read(path.join(dir,'verification.json'))};
fs.writeFileSync('data/product-article-media-2026-11-01.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({products:entries.length,updated:entries.filter(row=>!isDeepStrictEqual(row.descriptionContent,products.find(p=>String(p._id)===row.id).descriptionContent)).length,withArticleImages:entries.filter(row=>row.imageCount).length,
 inlineImages:entries.reduce((n,row)=>n+row.imageCount,0),uniqueImages:new Set(media.map(asset=>asset.src)).size,noSourceIllustrations:entries.filter(row=>!row.imageCount).map(row=>({id:row.id,title:row.title,url:row.evidence.originalUrl})),supplemented:entries.filter(row=>row.evidence.supplementaryUrls.length).length,maxWords:Math.max(...entries.map(row=>row.sourceWords)),maxImages:Math.max(...entries.map(row=>row.imageCount))},null,2));
