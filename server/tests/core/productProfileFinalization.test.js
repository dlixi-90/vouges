import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareProfileFinalization } from '../../services/productProfileFinalization.js';
import { productQualityIssues } from '../../services/productQuality.js';
import { productFilterValues, matchesPerfumeFilters } from '../../services/perfumeFilters.js';
import { getPerfumeProfile } from '../../services/ai/tools/productToolUtils.js';

const sample = () => ({_id:'123456789012345678901234',updatedAt:new Date('2026-10-31T00:00:00Z'),source:{id:32950,profileCompletion:{runId:'previous',fieldSources:{brand:[{url:'https://brand.example'}]}}},brand:'Brand',concentration:'EDP',type:'EDP',images:['https://example.com/photo'],sizes:[],price:{},stockBySize:{},inStockBySize:{},variantMetadata:{},inventoryMode:'tracked',inStock:false,fragrance:{group:'Woody',notes:{general:[{name:'Wood'}]}},qualityIssues:['missing_sizes']});
const record = p => ({id:String(p._id),sourceId:p.source.id,expectedUpdatedAt:p.updatedAt.toISOString(),afterIssues:[],changes:{},variants:[{kind:'add',size:'50ml',price:7200000,evidence:{url:'https://retailer.example/v-2012',condition:'retail'}}]});
test('a verified retail replacement starts empty and preserves previous review evidence',()=>{
 const p=sample(),before=structuredClone(p),r=prepareProfileFinalization(p,record(p),'final',new Date());
 assert.deepEqual(p,before);assert.equal(r.set.stockBySize['50ml'],0);assert.equal(r.set.inStockBySize['50ml'],false);
 assert.equal(r.set.variantMetadata['50ml'].sourceId,null);assert.equal(r.next.inStock,false);
 assert.deepEqual(r.set['source.profileCompletion'].previousRunIds,['previous']);
 assert.deepEqual(r.set['source.profileCompletion'].fieldSources.brand,p.source.profileCompletion.fieldSources.brand);
 assert.deepEqual(productQualityIssues(r.next),[]);
});
test('retail replacements cannot reuse testers, arbitrary fields, stocked products or stale evidence',()=>{
 const p=sample(),r=record(p);
 for(const edit of [{size:'50ml Test'},{sourceId:123},{evidence:{url:'https://retailer.example',condition:'tester'}},{price:0}])assert.throws(()=>prepareProfileFinalization(p,{...r,variants:[{...r.variants[0],...edit}]},'final',new Date()));
 assert.throws(()=>prepareProfileFinalization({...p,sizes:['50ml']},r,'final',new Date()),/empty product/);
 assert.throws(()=>prepareProfileFinalization({...p,updatedAt:new Date()},r,'final',new Date()),/changed since review/);
 assert.throws(()=>prepareProfileFinalization(p,{...r,changes:{description:'overwrite'}},'final',new Date()),/Unsupported/);
});
test('only the two explicitly approved references may receive generated stock and never overwrite inventory',()=>{
 const p=sample(),r=record(p);r.variants[0].generatedQuantity=15;
 assert.throws(()=>prepareProfileFinalization(p,r,'final',new Date()),/not authorized/);
 r.stockAuthorization='user-reference-price-and-random-stock-2026-10-31';
 const result=prepareProfileFinalization(p,r,'final',new Date());
 assert.equal(result.set.stockBySize['50ml'],15);assert.equal(result.set.inStock,true);
 assert.match(result.set.variantMetadata['50ml'].stockGeneration.basis,/not a supplier count/);
 p.source.id=33606;r.sourceId=33606;assert.throws(()=>prepareProfileFinalization(p,r,'final',new Date()),/not authorized/);
});
test('no-box rename changes all variant maps together without leaving the old purchasable label',()=>{
 const p=sample();p.source.id=47416;p.sizes=['100ml'];p.price={'100ml':0};p.stockBySize={'100ml':0};p.inStockBySize={'100ml':false};p.variantMetadata={'100ml':{sourceId:47416}};p.sizeImages={'100ml':'https://example.com/photo'};
 const r={...record(p),stockAuthorization:'user-reference-price-and-random-stock-2026-10-31',variants:[{kind:'rename',oldSize:'100ml',size:'100ml không hộp',price:1300000,generatedQuantity:13,evidence:{url:'https://ebay.com/item',condition:'new_without_box'}}]};
 const result=prepareProfileFinalization(p,r,'final',new Date());
 assert.deepEqual(result.set.sizes,['100ml không hộp']);assert.deepEqual(result.removedSizes,['100ml']);
 for(const field of ['price','stockBySize','inStockBySize','variantMetadata','sizeImages']){assert.equal(result.set[field]['100ml'],undefined);assert.ok(Object.hasOwn(result.set[field],'100ml không hộp'));}
 p.price['100ml']=999999;assert.throws(()=>prepareProfileFinalization(p,r,'final',new Date()),/valid existing price/);
});
test('quality checks require notes for every alternative and AI/filter data keeps the alternatives distinct',()=>{
 const p=sample();p.sizes=['Set A','Set B'];p.price={'Set A':10,'Set B':20};p.fragrance={profileKind:'assortment',group:'Woody; Floral',notes:{general:[{name:'Generic'}]},components:[{variantKey:'Set A',optionName:'Option A',name:'Scent A',concentration:'EDP',notes:{general:[{name:'Rose'}]}}]};
 assert.ok(productQualityIssues(p).includes('missing_scent_notes'));
 p.fragrance.components.push({variantKey:'Set B',optionName:'Option B',name:'Scent B',concentration:'EDT',notes:{base:[{name:'Wood'}]}});
 assert.deepEqual(productQualityIssues(p),[]);
 const values=productFilterValues(p);assert.deepEqual(values.concentrations,['EDP','EDT']);assert.ok(matchesPerfumeFilters(values,{concentrations:['EDT']}));
 const ai=getPerfumeProfile(p);assert.equal(ai.fragrance.profileKind,'assortment');assert.equal(ai.fragrance.components[1].variantKey,'Set B');assert.equal(ai.fragrance.components[1].optionName,'Option B');
 p.fragrance.components[1].notes={};assert.ok(productQualityIssues(p).includes('missing_scent_notes'));
});
test('a reviewed conflict cannot silently clear an unrelated source warning',()=>{
 const p=sample();p.qualityIssues=['other_warning'];
 assert.throws(()=>prepareProfileFinalization(p,record(p),'final',new Date()),/Quality outcome changed/);
 const r=record(p);r.resolvedConflict={code:'source_profile_conflict',reason:'fake',sources:['https://one.example','https://two.example']};
 assert.throws(()=>prepareProfileFinalization(p,r,'final',new Date()),/Unexpected source conflict/);
});
test('the reviewed manifest covers exactly 14 profiles, genuine replacements and source-linked assortment options',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../../data/product-profile-finalization-2026-10-31.json',import.meta.url)));
 assert.equal(manifest.products.length,14);assert.equal(new Set(manifest.products.map(p=>p.id)).size,14);
 assert.deepEqual(manifest.products.filter(p=>p.variants?.some(v=>v.generatedQuantity)).map(p=>p.sourceId).sort(),[32950,47416]);
 for(const r of manifest.products){
  for(const v of r.variants||[]){assert.ok(v.price>0);assert.doesNotMatch(v.size,/test(?:er)?\s*$/i);if(v.evidence.conversion){const c=v.evidence.conversion;assert.equal(v.price,Math.round(c.amount*c.rate/c.roundTo)*c.roundTo);}}
  if(r.changes['fragrance.profileKind']==='assortment')assert.ok(r.changes['fragrance.components'].every(c=>c.variantKey&&c.sourceUrl&&Object.values(c.notes).flat().length));
 }
});
