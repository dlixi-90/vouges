import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import CatalogSource from "../models/CatalogSource.js";
import CatalogMigration from "../models/CatalogMigration.js";
import {catalogSummary,catalogProducts,catalogProduct,saveCatalogProduct,libraryTerms} from "../controllers/catalogController.js";
import {quoteOrder} from "../controllers/orderController.js";
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},set(){}});
const call=async(handler,req)=>{const res=response();await handler(req,res);assert.equal(res.statusCode,200,res.body?.message);assert.equal(res.body.success,true,res.body?.message);return res.body;};

try {
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
  const db=mongoose.connection.db;
  assert.equal(db.databaseName,"vouges");
  const migration=await CatalogMigration.findOne({key:"apaniche-vnd-v2"}).lean();assert.ok(migration);
  const before=JSON.parse(fs.readFileSync(`${migration.backupPath}/manifest.json`,"utf8"));
  const summary=await call(catalogSummary,{});
  assert.equal(summary.metrics.total,2444);assert.equal(summary.metrics.published,2324);
  assert.equal(summary.orders.count,0);assert.equal(summary.orders.revenue,0);
  assert.equal(await db.collection("reviews").countDocuments(),0);
  assert.equal(await db.collection("voucheruses").countDocuments(),0);
  assert.equal(await db.collection("users").countDocuments(),before.collections.users);
  assert.equal(await db.collection("users").countDocuments({cartData:{$ne:{}}}),0);
  const {EJSON}=mongoose.mongo.BSON;
  const oldVouchers=EJSON.parse(fs.readFileSync(`${migration.backupPath}/vouchers.ejson`,"utf8"));
  for(const old of oldVouchers){const current=await db.collection("vouchers").findOne({_id:old._id});assert.equal(current.usedCount,0);assert.equal(current.value,old.type==="fixed"?old.value*1000:old.value);assert.equal(current.minSubtotal,(old.minSubtotal||0)*1000);assert.equal(current.maxDiscount,typeof old.maxDiscount==="number"?old.maxDiscount*1000:null);}
  const first=await call(catalogProducts,{query:{page:"1",pageSize:"25"}});
  const second=await call(catalogProducts,{query:{page:"2",pageSize:"25"}});
  assert.equal(first.total,2444);assert.equal(first.products.length,25);
  assert.ok(!first.products.some(p=>second.products.some(q=>String(q._id)===String(p._id))));
  const publicProduct=await Product.findOne({isPublished:true,inStock:true,"sizes.1":{$exists:true}}).lean();
  const detail=await call(catalogProduct,{params:{id:String(publicProduct._id)}});assert.equal(detail.source.sourceId,publicProduct.source.id);
  const size=publicProduct.sizes.find(size=>publicProduct.inStockBySize[size]);const amount=publicProduct.price[size];
  const quote=await call(quoteOrder,{user:{_id:"verify-without-order"},body:{items:[{product:String(publicProduct._id),size,quantity:1}],shippingMethod:"standard"}});
  assert.equal(quote.pricing.subtotal,amount);assert.equal(quote.pricing.amount,amount+(amount>=1000000?0:30000));
  for(const kind of ["brand","group","accord","note"]){const library=await call(libraryTerms,{query:{kind,pageSize:"25"}});assert.equal(library.total,migration.totals.terms[kind]);}
  if(process.argv.includes("--check-write")){
    mongoose.set("transactionAsyncLocalStorage",true);
    const sentinel=new Error("ABORT_VERIFICATION");const sourceBefore=JSON.stringify(await CatalogSource.findOne({productId:publicProduct._id}).lean());
    try{await mongoose.connection.transaction(async()=>{
      const saved=await call(saveCatalogProduct,{params:{id:String(publicProduct._id)},body:{expectedUpdatedAt:publicProduct.updatedAt.toISOString(),price:{[size]:1250000},sizeImages:{[size]:"https://example.com/verify-capacity.jpg"}}});
      assert.equal(saved.product.price[size],1250000);assert.equal(saved.product.stockBySize[size],0);assert.equal(saved.product.sizeImages[size],"https://example.com/verify-capacity.jpg");
      const stale=response();await saveCatalogProduct({params:{id:String(publicProduct._id)},body:{expectedUpdatedAt:publicProduct.updatedAt.toISOString(),title:"stale"}},stale);assert.equal(stale.statusCode,409);
      throw sentinel;
    });}catch(error){if(error!==sentinel)throw error;}
    const after=await Product.findById(publicProduct._id).lean();assert.deepEqual(after.price,publicProduct.price);assert.deepEqual(after.sizeImages,publicProduct.sizeImages);assert.equal(after.updatedAt.getTime(),publicProduct.updatedAt.getTime());
    assert.equal(JSON.stringify(await CatalogSource.findOne({productId:publicProduct._id}).lean()),sourceBefore);
  }
  console.log(JSON.stringify({verified:true,database:db.databaseName,metrics:summary.metrics,orders:summary.orders.count,revenue:summary.orders.revenue,terms:migration.totals.terms,usersPreserved:before.collections.users,cartCleared:true,vouchersConverted:true,writeVerificationAborted:process.argv.includes("--check-write"),sampleProduct:String(publicProduct._id)}));
} finally {await mongoose.disconnect();}
