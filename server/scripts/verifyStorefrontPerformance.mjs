// Read-only regression/measurement harness. Run from server/ with MONGO_URI.
// autoIndex/autoCreate are disabled; fixtures use collectionless $documents.
import 'dotenv/config';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Product from '../models/Product.js';
import { readStorefrontBrowse, readStorefrontRelated, availableSizesExpression } from '../services/storefrontBrowse.js';
import { getStorefrontCatalog, invalidateStorefrontCatalog, parseBrowseQuery, browseCatalog, relatedCatalog } from '../services/storefrontCatalog.js';
import { productFilterValues } from '../services/perfumeFilters.js';
import { isSizeAvailable } from '../utils/productStock.js';
const results={databaseWrites:0};
try {
 await mongoose.connect(process.env.MONGO_URI,{autoIndex:false,autoCreate:false,monitorCommands:true});
 let dbBytes=0,commands=0;
 mongoose.connection.getClient().on('commandSucceeded',event=>{if(['find','getMore','aggregate'].includes(event.commandName)){commands++;dbBytes+=Buffer.byteLength(JSON.stringify(event.reply));}});
 const measure=async(name,read)=>{dbBytes=0;commands=0;const start=performance.now();const value=await read();results[name]={milliseconds:Math.round(performance.now()-start),databaseBytes:dbBytes,commands,jsonBytes:Buffer.byteLength(JSON.stringify(value))};return value;};
 invalidateStorefrontCatalog();
 await measure('coldPagedBrowse',()=>readStorefrontBrowse(parseBrowseQuery({})));
 await measure('warmNextPage',()=>readStorefrontBrowse(parseBrowseQuery({page:2})));
 await measure('cachedPage',()=>readStorefrontBrowse(parseBrowseQuery({})));
 const source=(await Product.find({isPublished:{$ne:false},isDeleted:{$ne:true}}).sort({createdAt:-1,_id:-1}).lean()).map(product=>({...product,_id:String(product._id),images:product.images?.slice(0,1)||[],_filters:productFilterValues(product)}));
 const rawQueries=[{}, {page:2}, {page:99999}, {q:'Dior'}, {q:'[.*'}, {brand:'Chanel'}, {brand:'AbErCrOmBiE & fItCh'}, {availability:'all'}, {categories:JSON.stringify(['Nước hoa nam'])}, {types:JSON.stringify(['not-present'])}, {types:JSON.stringify(['Eau De Parfum (EDP)'])},
  ...['Nam','Nữ','Unisex','missing'].map(gender=>({facets:JSON.stringify({gender:[gender]})})),
  ...[{brands:['Chanel']},{brands:['Dior'],gender:['Nam']},{origins:['Pháp']},{concentrations:['Eau De Parfum (EDP)']},{sizes:['100ml']},{notes:['Hoa Nhài']},{accords:['Gỗ']},{longevity:['Khá 6-8H']},{sillage:['Vừa Phải']},{suitability:['Ngày']},{styles:['Thanh Lịch']}].map(facets=>({facets:JSON.stringify(facets)})),
  {minPrice:350000,maxPrice:2000000,sort:'low'},{sort:'high'},{limit:10},{limit:12,availability:'all'}];
 const normalize=value=>({...value,filters:{...value.filters,categories:[...value.filters.categories].sort()}});
 for(const query of rawQueries){const options=parseBrowseQuery(query);const actual=await readStorefrontBrowse(options);const expected=browseCatalog(source,options);assert.deepEqual(normalize(JSON.parse(JSON.stringify(actual))),normalize(JSON.parse(JSON.stringify(expected))),JSON.stringify(query));}
 results.exactBrowseComparisons=rawQueries.length;
 const profileCatalog=await getStorefrontCatalog(true);
 const sourceMap=new Map(source.map(product=>[product._id,product]));
 for(const product of profileCatalog)assert.deepEqual(product._filters,sourceMap.get(product._id)._filters,product._id);
 results.exactProfileComparisons=profileCatalog.length;
 for(const sample of source.slice(0,3))assert.deepEqual(JSON.parse(JSON.stringify(await readStorefrontRelated(sample._id))),JSON.parse(JSON.stringify(relatedCatalog(source,sample._id))));
 results.exactRelatedComparisons=3;
 invalidateStorefrontCatalog();
 await measure('coldRelated',()=>readStorefrontRelated(source[0]._id));
 const fixtures=[];
 for(const inventoryMode of ['tracked','source'])for(const stock of [0,2,-1,1.5,null,'3','bad'])for(const enabled of [true,false,undefined])fixtures.push({sizes:['50ml'],inventoryMode,inStock:true,stockBySize:{'50ml':stock},inStockBySize:enabled===undefined?{}:{'50ml':enabled},isPublished:true});
 const available=await mongoose.connection.db.aggregate([{$documents:fixtures},{$project:{available:availableSizesExpression}}]).toArray();
 available.forEach((row,index)=>assert.deepEqual(row.available,fixtures[index].sizes.filter(size=>isSizeAvailable(fixtures[index],size))));
 results.exactStockCases=fixtures.length;
 fs.mkdirSync('../.qa-perfume',{recursive:true});fs.writeFileSync('../.qa-perfume/storefront-optimization.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await mongoose.disconnect();}
