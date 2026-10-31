import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { publicLibraryTerms, publicLibraryTerm, libraryProductFilter } from "../../controllers/libraryController.js";
import { invalidateStorefrontCatalog } from "../../services/storefrontCatalog.js";
import FragranceTerm from "../../models/FragranceTerm.js";
import Product from "../../models/Product.js";
import { librarySlug, libraryPath } from "../../../client/src/utils/fragranceLibrary.js";
import router from "../../routes/libraryRoute.js";
import { createPublicCatalog } from "../../../client/src/utils/publicCatalog.js";
beforeEach(invalidateStorefrontCatalog);
const response = () => ({statusCode:200,set(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
const rows = Array.from({length:30},(_,i)=>({_id:String(i),kind:"note",name:`Note ${i}`,key:`https://apaniche.vn/note-huong-note-${i}`,contentStatus:"complete"}));
test("public directories expose bounded metadata, with search and clamped pagination",async t=>{
 let projection;
 t.mock.method(FragranceTerm,"find",()=>({select(value){projection=value;return{lean:async()=>rows};}}));
 const res=response();await publicLibraryTerms({params:{kind:"note"},query:{}},res);
 assert.equal(res.body.terms.length,24);assert.equal(res.body.total,30);assert.equal(res.body.totalPages,2);
 assert.equal(projection,"kind key name contentStatus");assert.equal(res.body.terms[0].key,undefined);
 const last=response();await publicLibraryTerms({params:{kind:"note"},query:{page:"900"}},last);assert.equal(last.body.page,2);assert.equal(last.body.terms.length,6);
 const search=response();await publicLibraryTerms({params:{kind:"note"},query:{q:"Note 29"}},search);assert.equal(search.body.total,1);
});
test("detail returns edited rich content and 15 related public cards without source metadata",async t=>{
 const term={...rows[1],description:"Giới thiệu riêng",descriptionContent:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Giới thiệu riêng"}]}]},sourceUrl:rows[1].key,contentImport:{secret:true}};
 t.mock.method(FragranceTerm,"find",()=>({select:()=>({lean:async()=>rows})}));
 t.mock.method(FragranceTerm,"findById",()=>({select:()=>({lean:async()=>term})}));
 let filter,limit,skip;
 t.mock.method(Product,"countDocuments",async f=>{filter=f;return 31;});
 t.mock.method(Product,"find",()=>({select:()=>({sort:()=>({skip(n){skip=n;return{limit(n){limit=n;return{lean:async()=>[{_id:"card",title:"Product",source:{secret:true},images:["/images/one.webp"]}]};}};}})})}));
 const res=response();await publicLibraryTerm({params:{kind:"note",slug:"note-1"},query:{page:"2"}},res);
 assert.equal(res.statusCode,200);assert.equal(limit,15);assert.equal(skip,15);assert.equal(res.body.totalPages,3);
 assert.equal(res.body.term.description,"Giới thiệu riêng");assert.equal(res.body.products[0].source,undefined);
 assert.equal(filter.isPublished.$ne,false);assert.equal(filter.isDeleted.$ne,true);
 assert.equal(JSON.stringify(res.body).includes("apaniche"),false);assert.equal(res.body.term.contentImport,undefined);
});
test("invalid kinds, injected parameters and unknown entries fail without broad product reads",async t=>{
 t.mock.method(FragranceTerm,"find",()=>({select:()=>({lean:async()=>rows})}));
 t.mock.method(Product,"find",()=>{throw Error("Unexpected product read");});
 for(const [handler,req,status] of [[publicLibraryTerms,{params:{kind:"__proto__"},query:{}},404],[publicLibraryTerms,{params:{kind:"note"},query:{q:{$ne:""}}},400],[publicLibraryTerms,{params:{kind:"note"},query:{page:"-1"}},400],[publicLibraryTerm,{params:{kind:"note",slug:"missing"},query:{}},404]]){
  const res=response();await handler(req,res);assert.equal(res.statusCode,status);assert.equal(res.body.success,false);
 }
});
test("all relation filters exclude unpublished/deleted products and use literal labels",()=>{
 for(const kind of ["brand","group","accord","note"]){const filter=libraryProductFilter({kind,name:"Rose (A+B)",sourceUrl:"https://example.com/note"});assert.deepEqual(filter.isPublished,{$ne:false});assert.deepEqual(filter.isDeleted,{$ne:true});}
 const filter=libraryProductFilter({kind:"brand",name:"A+B"});assert.equal(filter.brand.test("A+B"),true);assert.equal(filter.brand.test("AAAB"),false);
 assert.ok(libraryProductFilter({kind:"note",name:"Rose"}).$or.some(row=>row["fragrance.components.notes.base.name"]));
});
test("canonical page paths use stable readable slugs and routes remain public",()=>{
 assert.equal(librarySlug({key:"https://apaniche.vn/nuoc-hoa-dior",name:"Dior"}),"dior");
 assert.equal(libraryPath({kind:"note",key:"https://apaniche.vn/note-huong-cam-bergamot"}),"/knowledge/note/cam-bergamot");
 assert.equal(librarySlug({key:"local",name:"Hoa Hồng Đỏ"}),"hoa-hong-do");
 for(const layer of router.stack){assert.equal(layer.route.stack.length,1);assert.equal(layer.route.methods.get,true);}
});
test("library client shares identical reads, isolates pages and clears cached public content",async()=>{
 const calls=[];
 const api=createPublicCatalog({axios:{async get(url,options){calls.push({url,params:options.params});return{data:{success:true,terms:[]}};}}});
 await Promise.all([api.library("note",{page:1,q:"rose"}),api.library("note",{q:"rose",page:1})]);assert.equal(calls.length,1);
 await api.library("note",{page:2,q:"rose"});assert.equal(calls.length,2);
 await api.library("brand",{slug:"dior",page:1});assert.equal(calls[2].url,"/api/library/brand/dior");assert.deepEqual(calls[2].params,{page:1});
 await api.library("brand",{name:"Dior",page:1});assert.equal(calls[3].url,"/api/library/brand/entry");assert.equal(calls[3].params.name,"Dior");
 assert.ok(api.peekLibrary("note",{q:"rose",page:1}));api.clear();assert.equal(api.peekLibrary("note",{q:"rose",page:1}),undefined);
});
