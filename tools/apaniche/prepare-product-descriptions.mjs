import fs from 'node:fs';
import {parseProductDescription,productDescriptionFacts} from './product-description-parser.mjs';
import {buildProductDescription} from './build-product-description.mjs';
const dir='.qa-perfume/product-descriptions-2026-11-01';
const products=JSON.parse(fs.readFileSync(`${dir}/products.json`)).filter(p=>!p.isDeleted);
const rows=JSON.parse(fs.readFileSync(`${dir}/source-descriptions.json`));
const supplements=JSON.parse(fs.readFileSync('data/product-description-supplements-2026-11-01.json'));
const previousResult=fs.existsSync('data/product-descriptions-2026-11-01-result.json')?JSON.parse(fs.readFileSync('data/product-descriptions-2026-11-01-result.json')):null;
const entries=[];
for(const product of products){
 const source=rows.find(r=>r.id===product.source.id);if(!source)throw Error(`Missing source: ${product.title}`);
 if(new URL(source.permalink).pathname.replace(/\/$/,'')!==new URL(product.source.url).pathname.replace(/\/$/,''))throw Error(`Product URL changed: ${product.title}`);
 const parsed=parseProductDescription(source.description+'\n'+source.short_description),facts=productDescriptionFacts(parsed),supplement=supplements[source.id];
 if(parsed.characters<120&&!supplement)throw Error(`Needs supplementary research: ${product.title}`);
 const content=buildProductDescription(product,source,parsed,facts,supplement);
 entries.push({id:String(product._id),sourceId:source.id,title:product.title,expectedUpdatedAt:previousResult?.appliedAt||product.updatedAt,...content,
  evidence:{originalUrl:product.source.url,...source.evidence,sourceCharacters:parsed.characters,excludedBlocks:parsed.excludedCount,
   method:supplement?'original-summary-with-supplementary-sources':'original-structured-factual-summary',supplementaryUrls:supplement?.urls||[]}});
}
const manifest={runId:'product-descriptions-2026-11-01',scope:'all-non-deleted-products; replace all prior descriptions including owner edits',entries};
fs.writeFileSync('data/product-descriptions-2026-11-01.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({total:entries.length,supplemented:entries.filter(e=>e.evidence.supplementaryUrls.length).length,minCharacters:Math.min(...entries.map(e=>e.description.length)),maxWords:Math.max(...entries.map(e=>e.description.split(/\s+/).length)),over200:entries.filter(e=>e.description.split(/\s+/).length>200).map(e=>({id:e.id,title:e.title,words:e.description.split(/\s+/).length}))},null,2));
