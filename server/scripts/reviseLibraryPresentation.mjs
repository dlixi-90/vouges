// Preview is read-only. Apply edits public library copy with a durable backup and CAS.
import "dotenv/config";
import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import FragranceTerm from "../models/FragranceTerm.js";
import Product from "../models/Product.js";
import {reviseLibraryPresentation,reviseProductPresentation} from "../../tools/apaniche/library-presentation.mjs";
import {articleToPlainText} from "../../client/src/utils/productArticle.js";

const apply=process.argv.includes("--apply"),database=process.argv.find(arg=>arg.startsWith("--database="))?.slice(11);
if(database!=="vouges")throw Error("Pass --database=vouges explicitly");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const digest=value=>createHash("sha256").update(mongoose.mongo.BSON.EJSON.stringify(value)).digest("hex");
const facts=row=>{const result={...row};delete result.description;delete result.descriptionContent;delete result.updatedAt;if(result.contentImport){result.contentImport={...result.contentImport};delete result.contentImport.presentation;delete result.contentImport.relatedHeading;}return result;};
const images=node=>[...(node?.type==="image"?[node.attrs.src]:[]),...(node?.attrs?.items||[]).map(item=>item.image).filter(Boolean),...(node?.content||[]).flatMap(images)].sort();
const hasBrand=row=>/apa[\s\u200b-]*niche/iu.test([row.description,articleToPlainText(row.descriptionContent),row.contentImport?.relatedHeading].join("\n"));
const productFacts=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!["title","brand","description","ingredients","updatedAt"].includes(key)));
try{
  await mongoose.connect(process.env.MONGO_URI,{dbName:database,autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:15000});
  if(mongoose.connection.db.databaseName!==database)throw Error("Unexpected database");
  const collection=FragranceTerm.collection,rows=await collection.find({kind:{$in:["group","accord","note"]}}).toArray(),changes=[];
  const products=await Product.collection.find({}).toArray(),productChanges=products.map(row=>({row,fields:reviseProductPresentation(row)})).filter(change=>Object.keys(change.fields).length);
  for(const row of rows){
    const result=reviseLibraryPresentation(row);if(!result.changed)continue;
    if(digest(images(row.descriptionContent))!==digest(images(result.descriptionContent)))throw Error("Image references changed: "+row.name);
    const next={...row,...result,contentImport:{...row.contentImport,...(result.relatedHeading!==undefined?{relatedHeading:result.relatedHeading}:{})}};if(hasBrand(next))throw Error("Visible source branding remains: "+row.name);
    if(reviseLibraryPresentation(next).changed)throw Error("Presentation edit is not idempotent: "+row.name);
    changes.push({row,result});
  }
  const report={at:new Date().toISOString(),mode:apply?"apply":"preview",database,scanned:rows.length,changed:changes.length,productsScanned:products.length,productsChanged:productChanges.length,retailSections:changes.reduce((n,c)=>n+c.result.sections,0),categoryLinks:changes.reduce((n,c)=>n+c.result.categoryLinks,0),imagesPreserved:true,sourceMetadataPreserved:true,commercePreserved:true,entries:changes.map(({row,result})=>({id:String(row._id),kind:row.kind,name:row.name,sections:result.sections,beforeSha256:digest(row.descriptionContent),afterSha256:digest(result.descriptionContent)})),productEntries:productChanges.map(({row,fields})=>({id:String(row._id),before:{title:row.title,brand:row.brand},after:{title:fields.title??row.title,brand:fields.brand??row.brand}}))};
  if(apply&&(changes.length||productChanges.length)){
    const at=new Date(),backup=path.join(root,".backups","library-presentation-"+at.toISOString().replace(/[:.]/g,"-"));await fs.mkdir(backup,{recursive:true});
    const handle=await fs.open(path.join(backup,"terms.ejson"),"wx");try{await handle.writeFile(mongoose.mongo.BSON.EJSON.stringify(changes.map(c=>c.row),null,2,{relaxed:false})+"\n");await handle.sync();}finally{await handle.close();}
    const productBackup=await fs.open(path.join(backup,"products.ejson"),"wx");try{await productBackup.writeFile(mongoose.mongo.BSON.EJSON.stringify(productChanges.map(c=>c.row),null,2,{relaxed:false})+"\n");await productBackup.sync();}finally{await productBackup.close();}
    const session=await mongoose.startSession();
    try{await session.withTransaction(async()=>{
      const writes=changes.map(({row,result})=>({updateOne:{filter:{_id:row._id,updatedAt:row.updatedAt},update:{$set:{
        description:result.description,descriptionContent:result.descriptionContent,updatedAt:at,
        contentImport:{...row.contentImport,...(result.relatedHeading!==undefined?{relatedHeading:result.relatedHeading}:{}),presentation:{version:1,at,reason:"Remove source-store branding; replace imported inventory totals with Velours category navigation.",retailSections:result.sections,documentSha256:digest(result.descriptionContent)}},
      }}}}));
      if(writes.length){const updated=await collection.bulkWrite(writes,{session,ordered:true});if(updated.matchedCount!==changes.length)throw Error("An article changed during preparation; no edits committed");}
      if(productChanges.length){const updated=await Product.collection.bulkWrite(productChanges.map(({row,fields})=>({updateOne:{filter:{_id:row._id,updatedAt:row.updatedAt},update:{$set:{...fields,updatedAt:at}}}})),{session,ordered:true});if(updated.matchedCount!==productChanges.length)throw Error("A product changed during preparation; no edits committed");}
    });}finally{await session.endSession();}
    const after=await collection.find({kind:{$in:["group","accord","note"]}}).toArray(),byId=new Map(rows.map(row=>[String(row._id),row]));
    if(after.length!==rows.length||after.some(row=>digest(facts(row))!==digest(facts(byId.get(String(row._id))))))throw Error("Unexpected non-editorial field change");
    report.remainingBrandedArticles=after.filter(hasBrand).length;if(report.remainingBrandedArticles)throw Error("Brand cleanup is incomplete");
    const productsAfter=await Product.collection.find({}).toArray(),productsBefore=new Map(products.map(row=>[String(row._id),row]));
    if(productsAfter.length!==products.length||productsAfter.some(row=>digest(productFacts(row))!==digest(productFacts(productsBefore.get(String(row._id))))))throw Error("Product commerce or source evidence changed");
    report.remainingBrandedProducts=productsAfter.filter(row=>Object.keys(reviseProductPresentation(row)).length).length;if(report.remainingBrandedProducts)throw Error("Product brand cleanup is incomplete");
    report.backup=path.relative(root,backup).replaceAll("\\","/");report.completed=true;
    const output=path.join(root,"data","library-presentation-2026-11-02");await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,"completion.json"),JSON.stringify(report,null,2)+"\n","utf8");
  }
  console.log(JSON.stringify({...report,entries:report.entries.map(({name,kind,sections})=>({name,kind,sections}))},null,2));
}finally{await mongoose.disconnect();}
