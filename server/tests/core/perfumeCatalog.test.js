import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildApanicheCatalog, safeSizeKey} from "../../services/apanicheCatalog.js";
import {isSizeAvailable,getPurchaseLimit,getSizeQuantity} from "../../utils/productStock.js";
import * as clientStock from "../../../client/src/utils/productStock.js";
import {formatVnd} from "../../../client/src/utils/money.js";
import Product from "../../models/Product.js";
import CatalogSource from "../../models/CatalogSource.js";
import catalogRouter from "../../routes/catalogRoute.js";
import authUser,{requireOwner} from "../../middleware/authMiddleware.js";
import {saveCatalogProduct,catalogProducts} from "../../controllers/catalogController.js";
import {singleProduct} from "../../controllers/productController.js";
import {cancelQrOrder} from "../../controllers/orderController.js";
import Order from "../../models/Order.js";
import mongoose from "mongoose";

const sources=JSON.parse(fs.readFileSync(new URL("../../../data/research/apaniche/products.json",import.meta.url),"utf8"));
const variants=JSON.parse(fs.readFileSync(new URL("../../../data/research/apaniche/variants.json",import.meta.url),"utf8"));
const catalog=buildApanicheCatalog(sources,variants);
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},set(){}});

test("the complete local source imports without losing records, source prices or variant images",()=>{
  assert.equal(catalog.products.length,2444);
  assert.equal(catalog.sources.length,2444);
  assert.equal(new Set(catalog.products.map(p=>String(p._id))).size,2444);
  assert.equal(catalog.products.filter(p=>p.isPublished).length,2324);
  assert.equal(catalog.products.filter(p=>p.catalogScope==="other").length,120);
  assert.equal(catalog.products.reduce((sum,p)=>sum+p.sizes.length,0),5464);
  const bySource=new Map(catalog.products.map(p=>[p.source.id,p]));
  for(const variant of variants){
    const product=bySource.get(variant.productId);
    const size=product.sizes.find(size=>product.variantMetadata[size].sourceId===variant.sourceId);
    assert.ok(size,`Missing variant ${variant.sourceId}`);
    assert.equal(product.price[size],variant.price??0);
    if(variant.imageUrl)assert.equal(product.sizeImages[size],variant.imageUrl);
  }
  for(const product of catalog.products){
    assert.equal(product.inventoryMode,"source");
    assert.ok(Object.values(product.stockBySize).every(q=>q===0));
    assert.ok(Object.values(product.price).every(price=>Number.isSafeInteger(price)&&price>=0));
    assert.equal(new Set(product.sizes.map(size=>size.toLowerCase())).size,product.sizes.length);
    assert.ok(product.sizes.every(size=>!size.includes(".")&&!size.startsWith("$")));
    if(product.catalogScope==="other")assert.equal(product.isPublished,false);
  }
});

test("raw source records and assessments remain intact, without turning source anomalies into fabricated metrics",()=>{
  for(let i=0;i<sources.length;i++){
    assert.equal(catalog.sources[i].data,sources[i]);
    assert.deepEqual(catalog.products[i].fragrance.longevity,sources[i].detail?.data?.longevity||[]);
    assert.deepEqual(catalog.products[i].fragrance.suitability,sources[i].detail?.data?.suitability||[]);
    assert.equal(catalog.products[i].fragrance.assessmentsVisible,false);
  }
  assert.ok(catalog.products.some(p=>p.qualityIssues.includes("source_assessment_anomaly")));
});

test("Mongo-safe size labels keep decimal capacities distinct and reject prototype property names",()=>{
  const used=new Set();
  assert.equal(safeSizeKey(" 1.5ml ",1,used),"1,5ml");
  assert.equal(safeSizeKey("1.5ML",2,used),"1,5ML · 2");
  assert.equal(safeSizeKey("__proto__",3,used),"SKU 3");
});

test("availability follows each source flag while physical stock remains zero, identically on client and server",()=>{
  const product={sizes:["30ml","50ml"],inventoryMode:"source",inStock:true,isPublished:true,stockBySize:{"30ml":0,"50ml":0},inStockBySize:{"30ml":true,"50ml":false}};
  assert.equal(getSizeQuantity(product,"30ml"),0);
  assert.equal(getPurchaseLimit(product,"30ml"),100);
  assert.equal(isSizeAvailable(product,"30ml"),true);
  assert.equal(isSizeAvailable(product,"50ml"),false);
  assert.equal(isSizeAvailable(product,"not-a-size"),false);
  for(const size of product.sizes){assert.equal(clientStock.isSizeAvailable(product,size),isSizeAvailable(product,size));assert.equal(clientStock.getPurchaseLimit(product,size),getPurchaseLimit(product,size));}
  assert.equal(isSizeAvailable({...product,isPublished:false},"30ml"),false);
  assert.equal(isSizeAvailable({...product,inventoryMode:"tracked"},"30ml"),false);
  assert.equal(formatVnd(1250000),"1.250.000 ₫");
});

test("every catalog endpoint requires an authenticated owner",()=>{
  const middleware=catalogRouter.stack.filter(layer=>!layer.route).map(layer=>layer.handle);
  assert.deepEqual(middleware.slice(0,2),[authUser,requireOwner]);
  const res=response();requireOwner({user:{role:"user"}},res,()=>assert.fail("No customer access"));assert.equal(res.statusCode,403);
});

test("invalid pagination and injected search filters cannot issue database reads",async(t)=>{
  const read=t.mock.method(Product,"find",()=>assert.fail("No invalid database read"));
  for(const query of [{page:"-1"},{pageSize:"10000"},{q:{$ne:null}},{brand:{$ne:null}}]){
    const res=response();await catalogProducts({query},res);assert.equal(res.statusCode,400);
  }
  assert.equal(read.mock.callCount(),0);
});

test("public product detail excludes unpublished imports",async(t)=>{
  t.mock.method(Product,"findOne",async(filter)=>{assert.deepEqual(filter.isPublished,{$ne:false});return null;});
  const res=response();await singleProduct({query:{productId:String(catalog.products[0]._id)}},res);assert.equal(res.statusCode,404);
});

const current=()=>{const original=catalog.products.find(p=>p.sizes.length===1&&p.catalogScope==="perfume");return {...structuredClone(original),_id:original._id,updatedAt:new Date("2026-10-27T00:00:00Z")};};
test("catalog edits reject stale versions, fractional prices, invalid size paths and out-of-scope publication",async(t)=>{
  const product=current();t.mock.method(Product,"findOne",async()=>product);
  const write=t.mock.method(Product,"findOneAndUpdate",()=>assert.fail("No invalid write"));
  for(const patch of [{expectedUpdatedAt:"2020-01-01"},{price:{[product.sizes[0]]:1250.5}},{sizes:["a.b"]},{sizes:["constructor"]},{sizes:[product.sizes[0],product.sizes[0].toUpperCase()]}]){
    const res=response();await saveCatalogProduct({params:{id:String(product._id)},body:{expectedUpdatedAt:product.updatedAt.toISOString(),...patch}},res);assert.ok([400,409].includes(res.statusCode));
  }
  product.catalogScope="other";const res=response();await saveCatalogProduct({params:{id:String(product._id)},body:{expectedUpdatedAt:product.updatedAt.toISOString(),isPublished:true}},res);assert.equal(res.statusCode,400);assert.equal(write.mock.callCount(),0);
});

test("catalog saves use a second version predicate and never rewrite the original source",async(t)=>{
  const product=current(),size=product.sizes[0];product.stockBySize={[size]:0};product.inStockBySize={[size]:true};
  t.mock.method(Product,"findOne",async()=>product);
  t.mock.method(CatalogSource,"updateOne",()=>assert.fail("Original source must stay intact"));
  t.mock.method(Product,"findOneAndUpdate",async(filter,update,options)=>{
    assert.deepEqual(filter,{_id:product._id,updatedAt:product.updatedAt});
    assert.equal(update.$set.price[size],1250000);assert.equal(update.$set.inStock,true);assert.equal(update.$set.stockBySize[size],0);
    assert.equal(update.$set.price["10ml"],250000);assert.equal(update.$set.sizeImages["10ml"],"https://example.com/10ml.jpg");
    assert.equal(update.$set.source,undefined);assert.equal(options.runValidators,true);return {...product,...update.$set};
  });
  const res=response();await saveCatalogProduct({params:{id:String(product._id)},body:{expectedUpdatedAt:product.updatedAt.toISOString(),sizes:[size,"10ml"],price:{[size]:1250000,"10ml":250000},inStockBySize:{"10ml":true},sizeImages:{"10ml":"https://example.com/10ml.jpg"}}},res);
  assert.equal(res.body.success,true);
});

test("removing a capacity or switching inventory mode cannot break a pending QR reservation",async(t)=>{
  const product=current();product.sizes=["30ml","50ml"];
  t.mock.method(Product,"findOne",async()=>product);
  const hold=t.mock.method(Order,"exists",async()=>({_id:"qr-hold"}));
  const write=t.mock.method(Product,"findOneAndUpdate",()=>assert.fail("No edit during QR reservation"));
  for(const patch of [{sizes:["30ml"]},{inventoryMode:"tracked"}]){
    const res=response();await saveCatalogProduct({params:{id:String(product._id)},body:{expectedUpdatedAt:product.updatedAt.toISOString(),...patch}},res);assert.equal(res.statusCode,409);
  }
  assert.equal(hold.mock.callCount(),2);assert.equal(write.mock.callCount(),0);
});

for(const changedMode of ["source","tracked"])test(`cancelling a source order cannot fabricate stock after current mode changes to ${changedMode}`,async(t)=>{
  const product=current(),size=product.sizes[0];product.inventoryMode=changedMode;product.stockBySize={[size]:0};product.save=async()=>assert.fail("No inventory write for a source order");
  const order={_id:"507f1f77bcf86cd799439011",items:[{product:String(product._id),size,quantity:2,inventoryMode:"source"}],paymentMethod:"QR",isPaid:false,status:"Awaiting Payment",save:async()=>{}};
  t.mock.method(Order,"findOne",()=>({session:async()=>order}));
  t.mock.method(Product,"find",()=>({session:async()=>[product]}));
  t.mock.method(mongoose,"startSession",async()=>({withTransaction:async(callback)=>callback(),endSession:async()=>{}}));
  const res=response();await cancelQrOrder({auth:()=>({userId:"owner-test"}),params:{orderId:String(order._id)}},res);
  assert.equal(res.body.success,true);assert.equal(order.status,"Payment Cancelled");assert.equal(product.stockBySize[size],0);
});
