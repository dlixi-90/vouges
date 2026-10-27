import test from "node:test";
import assert from "node:assert/strict";
import {buildProductMediaUpdate,mediaImageUrl} from "../../services/productMediaService.js";

const manifest=new Map([["original.jpg",{cutoutUrl:"transparent.webp",cleanUrl:"cleaned.webp"}],["gallery.jpg",{cleanUrl:"gallery-cleaned.webp"}]]);
test("the avatar uses transparency while the gallery and size photos retain their scene",()=>{
  const product={images:["original.jpg","original.jpg","gallery.jpg","unchanged.jpg"],sizeImages:{"30ml":"original.jpg","50ml":"unmatched.jpg"},price:{"30ml":1250000},stockBySize:{"30ml":0},inventoryMode:"source"};
  const before=structuredClone(product);const update=buildProductMediaUpdate(product,manifest);
  assert.deepEqual(update,{images:["transparent.webp","cleaned.webp","gallery-cleaned.webp","unchanged.jpg"],sizeImages:{"30ml":"cleaned.webp","50ml":"unmatched.jpg"}});
  assert.deepEqual(product,before);assert.deepEqual(Object.keys(update).sort(),["images","sizeImages"]);
});
test("a cutout never replaces a gallery background when no watermark was found",()=>{
  const onlyCutout=new Map([["original.jpg",{cutoutUrl:"transparent.webp"}]]);
  assert.equal(mediaImageUrl("original.jpg",onlyCutout,false),"original.jpg");
  assert.equal(mediaImageUrl("original.jpg",onlyCutout,true),"transparent.webp");
});
test("missing or failed source images remain traceable and produce no unrelated database changes",()=>{
  assert.equal(buildProductMediaUpdate({images:["broken-source.jpg"],sizeImages:{}},manifest),null);
  assert.equal(buildProductMediaUpdate({images:[],sizeImages:{}},manifest),null);
});
test("a verified supplemental photo fills an empty avatar without replacing a user image",()=>{
  const missing={images:[],sizeImages:{},price:{Standard:0},inStock:false};
  assert.deepEqual(buildProductMediaUpdate(missing,manifest,{supplementalImageUrl:"original.jpg"}),{images:["transparent.webp"],sizeImages:{}});
  assert.deepEqual(missing.images,[]);
  assert.equal(buildProductMediaUpdate({images:["custom.jpg"],sizeImages:{}},manifest,{supplementalImageUrl:"original.jpg"}),null);
});
