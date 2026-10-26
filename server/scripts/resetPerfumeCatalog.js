import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import CatalogSource from "../models/CatalogSource.js";
import FragranceTerm from "../models/FragranceTerm.js";
import CatalogMigration from "../models/CatalogMigration.js";
import {buildApanicheCatalog,catalogId} from "../services/apanicheCatalog.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const directory=path.join(root,"data/research/apaniche");
const sourceText=fs.readFileSync(path.join(directory,"products.json"),"utf8");
const variantsText=fs.readFileSync(path.join(directory,"variants.json"),"utf8");
const sources=JSON.parse(sourceText),variants=JSON.parse(variantsText);
if(sources.length!==2444||new Set(sources.map(item=>item.sourceId)).size!==sources.length)throw new Error("Unexpected source catalog; refusing reset");
const catalog=buildApanicheCatalog(sources,variants,"source");
const knownTerms=new Set(catalog.terms.map(term=>`${term.kind}:${term.key}`));
for(const line of fs.readFileSync(path.join(root,"docs/research/apaniche/sitemap-inventory.csv"),"utf8").split(/\r?\n/).slice(1)){
  const cells=[...line.matchAll(/"((?:[^"]|"")*)"/g)].map(match=>match[1].replaceAll('""','"'));
  const kind=cells[0]?.endsWith("/note_huong-sitemap.xml")?"note":cells[0]?.endsWith("/nhom_huong-sitemap.xml")?"group":cells[0]?.endsWith("/thu_vien_mui_huong-sitemap.xml")?"accord":null;
  if(!kind||!cells[1]||knownTerms.has(`${kind}:${cells[1]}`))continue;
  catalog.terms.push({_id:catalogId(`${kind}:${cells[1]}`),kind,key:cells[1],name:"",sourceUrl:cells[1],description:"",image:"",contentStatus:"linked",productCount:0,createdAt:new Date(),updatedAt:new Date()});
  knownTerms.add(`${kind}:${cells[1]}`);
}
for(const row of catalog.products) await new Product(row).validate();
const totals={products:catalog.products.length,published:catalog.products.filter(item=>item.isPublished).length,hiddenOutsidePerfume:catalog.products.filter(item=>!item.isPublished).length,orderable:catalog.products.filter(item=>item.isPublished&&item.inStock).length,variants:catalog.products.reduce((sum,item)=>sum+item.sizes.length,0),sourceVariants:variants.length,categories:catalog.categories.length,terms:Object.fromEntries(["brand","group","accord","note"].map(kind=>[kind,catalog.terms.filter(term=>term.kind===kind).length]))};
fs.writeFileSync(path.join(directory,"import-preview.json"),JSON.stringify({currency:"VND",inventoryMode:"source",totals,sourceCollectedAt:sources[0].apiFetchedAt},null,2));
console.log(JSON.stringify({phase:"preview",currency:"VND",inventoryMode:"source",totals}));

if(process.argv.includes("--apply")){
  const expectedDb=process.argv.find(arg=>arg.startsWith("--database="))?.slice(11);
  if(!expectedDb)throw new Error("Pass --database=THE_VERIFIED_DATABASE before applying");
  try{
    await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
    const db=mongoose.connection.db;if(db.databaseName!==expectedDb)throw new Error("Resolved database differs from the explicit target");
    if(await CatalogMigration.findOne({key:"apaniche-vnd-v2"}))throw new Error("This reset has already been applied; refusing to delete new orders");
    const hello=await db.admin().command({hello:1});if(!hello.setName&&hello.msg!=="isdbgrid")throw new Error("Transactional reset requires a replica set; no data was deleted");
    await Promise.all([Product.init(),Category.init(),CatalogSource.init(),FragranceTerm.init(),CatalogMigration.init()]);
    const stamp=new Date().toISOString().replaceAll(":","-").replaceAll(".","-");
    const backupPath=path.resolve(root,".backups",`perfume-reset-${stamp}`);
    if(!backupPath.startsWith(path.join(root,".backups")+path.sep))throw new Error("Invalid backup target");
    fs.mkdirSync(backupPath,{recursive:true});
    const affected=["products","categories","orders","reviews","voucheruses","users","vouchers","catalogsources","fragranceterms","catalogmigrations"];
    const {EJSON}=mongoose.mongo.BSON;
    const backupCounts={};
    await mongoose.connection.transaction(async(session)=>{
      for(const name of affected){
        const documents=await db.collection(name).find({},{session}).toArray();backupCounts[name]=documents.length;
        fs.writeFileSync(path.join(backupPath,`${name}.ejson`),EJSON.stringify(documents,null,2,{relaxed:false}));
      }
      fs.writeFileSync(path.join(backupPath,"manifest.json"),JSON.stringify({database:expectedDb,createdAt:new Date().toISOString(),collections:backupCounts,reason:"User requested a complete catalog/order/revenue reset to Apaniche and VND"},null,2));
      for(const name of ["products","categories","orders","reviews","voucheruses","catalogsources","fragranceterms"])await db.collection(name).deleteMany({},{session});
      await db.collection("users").updateMany({},{$set:{cartData:{},cartAddedAt:{}}},{session});
      await db.collection("vouchers").updateMany({},[{$set:{
        value:{$cond:[{$eq:["$type","fixed"]},{$multiply:["$value",1000]},"$value"]},
        minSubtotal:{$multiply:[{$ifNull:["$minSubtotal",0]},1000]},
        maxDiscount:{$cond:[{$isNumber:"$maxDiscount"},{$multiply:["$maxDiscount",1000]},null]},usedCount:0,updatedAt:new Date(),
      }}],{session});
      for(const [name,rows] of [["products",catalog.products],["categories",catalog.categories],["catalogsources",catalog.sources],["fragranceterms",catalog.terms]]){
        for(let offset=0;offset<rows.length;offset+=200)await db.collection(name).insertMany(rows.slice(offset,offset+200),{session,ordered:true});
      }
      await db.collection("catalogmigrations").insertOne({key:"apaniche-vnd-v2",currency:"VND",moneyUnitVersion:2,source:"apaniche",sourceCollectedAt:new Date(sources[0].apiFetchedAt),appliedAt:new Date(),totals,backupPath,sourceDigest:crypto.createHash("sha256").update(sourceText).update(variantsText).digest("hex"),createdAt:new Date(),updatedAt:new Date()},{session});
    },{maxCommitTimeMS:60000});
    const actual={products:await Product.countDocuments(),orders:await db.collection("orders").countDocuments(),categories:await Category.countDocuments(),sourceRecords:await CatalogSource.countDocuments(),terms:await FragranceTerm.countDocuments()};
    fs.writeFileSync(path.join(directory,"import-result.json"),JSON.stringify({appliedAt:new Date().toISOString(),database:expectedDb,currency:"VND",inventoryMode:"source",totals,actual,backupPath},null,2));
    console.log(JSON.stringify({phase:"committed",database:expectedDb,actual,backupPath}));
  }finally{await mongoose.disconnect();}
}
