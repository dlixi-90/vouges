import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { publicLibraryTerms, publicLibraryTerm, libraryProductFilter } from "../../controllers/libraryController.js";
import { invalidateStorefrontCatalog } from "../../services/storefrontCatalog.js";
import FragranceTerm from "../../models/FragranceTerm.js";
import Product from "../../models/Product.js";
import { librarySlug, libraryPath } from "../../../client/src/utils/fragranceLibrary.js";
import router from "../../routes/libraryRoute.js";
import { createPublicCatalog } from "../../../client/src/utils/publicCatalog.js";
import {libraryDirectory} from "../../services/libraryDirectory.js";
import {filterLibraryTerms,groupLibraryTerms,libraryDisplayName} from "../../../client/src/utils/libraryDirectory.js";
beforeEach(invalidateStorefrontCatalog);
const response = () => ({statusCode:200,set(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
const rows = Array.from({length:30},(_,i)=>({_id:String(i),kind:"note",name:`Note ${i}`,key:`https://apaniche.vn/note-huong-note-${i}`,contentStatus:"complete",image:i===0?"javascript:alert(1)":"/images/library/example-thumb.webp"}));
test("public directories expose bounded metadata, with search and clamped pagination",async t=>{
 let projection;
 t.mock.method(FragranceTerm,"find",()=>({select(value){projection=value;return{lean:async()=>rows};}}));
 const res=response();await publicLibraryTerms({params:{kind:"note"},query:{}},res);
 assert.equal(res.body.terms.length,24);assert.equal(res.body.total,30);assert.equal(res.body.totalPages,2);
 assert.equal(projection,"kind key name slug contentStatus image");assert.equal(res.body.terms[0].key,undefined);
 assert.equal(res.body.terms.find(row=>row.id==="0").image,"");
 assert.ok(res.body.terms.find(row=>row.id==="1").image.startsWith("/images/library/"));
 assert.equal(res.body.overview.origins.length,16);assert.equal(res.body.overview.origins[0].termIds,undefined);
 const last=response();await publicLibraryTerms({params:{kind:"note"},query:{page:"900"}},last);assert.equal(last.body.page,2);assert.equal(last.body.terms.length,6);
 const search=response();await publicLibraryTerms({params:{kind:"note"},query:{q:"Note 29"}},search);assert.equal(search.body.total,1);
});
test("detail returns rich content, a deliberate reading reference and 15 related cards without import metadata",async t=>{
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
 assert.equal(res.body.term.referenceUrl,term.sourceUrl);assert.equal(res.body.term.sourceUrl,undefined);assert.equal(res.body.term.key,undefined);assert.equal(res.body.term.contentImport,undefined);
});

test("origin filters intersect search and never expose the membership index",async t=>{
 const origin=libraryDirectory("note").origins[0];
 const matching={...rows[0],_id:origin.termIds[0],name:"Cam Test"};
 t.mock.method(FragranceTerm,"find",()=>({select:()=>({lean:async()=>[matching,...rows]})}));
 const res=response();await publicLibraryTerms({params:{kind:"note"},query:{origin:origin.id,q:"Cam"}},res);
 assert.equal(res.body.total,1);assert.equal(res.body.terms[0].id,matching._id);assert.equal(JSON.stringify(res.body.overview).includes('termIds'),false);
 const invalid=response();await publicLibraryTerms({params:{kind:"note"},query:{origin:"unknown"}},invalid);assert.equal(invalid.statusCode,404);
 const injected=response();await publicLibraryTerms({params:{kind:"note"},query:{origin:{$ne:""}}},injected);assert.equal(injected.statusCode,400);
});
test("complete directory view returns searchable labels and public origin memberships without article bodies",async t=>{
 const origin=libraryDirectory("note").origins[0];
 const bergamot={...rows[0],_id:origin.termIds[0],name:"Cam Bergamot",key:"https://apaniche.vn/note-huong-cam-bergamot",description:"Private body",contentImport:{secret:true}};
 t.mock.method(FragranceTerm,"find",()=>({select:()=>({lean:async()=>[bergamot,...rows.slice(1)]})}));
 const res=response();await publicLibraryTerms({params:{kind:"note"},query:{view:"directory"}},res);
 assert.equal(res.body.terms.length,30);assert.equal(res.body.totalPages,1);
 const term=res.body.terms.find(row=>row.id===origin.termIds[0]);
 assert.equal(term.englishName,"Bergamot");assert.ok(term.originIds.includes(origin.id));
 assert.equal(term.description,undefined);assert.equal(term.contentImport,undefined);assert.equal(term.key,undefined);
 assert.ok(res.body.overview.origins[0].banner.startsWith("/images/library/"));
 assert.equal(res.body.overview.origins[0].termIds,undefined);
});
test("complete directories reject unsupported modes and remain bounded",async t=>{
 const read=t.mock.method(FragranceTerm,"find",()=>({select:()=>({lean:async()=>Array.from({length:2001},(_,i)=>({...rows[0],_id:String(i),name:`Note ${i}`}))})}));
 for(const view of ["unknown",{$ne:""}]){const res=response();await publicLibraryTerms({params:{kind:"note"},query:{view}},res);assert.equal(res.statusCode,400);}
 assert.equal(read.mock.callCount(),0);
 const res=response();await publicLibraryTerms({params:{kind:"note"},query:{view:"directory"}},res);assert.equal(res.statusCode,413);
});
test("directory search accepts unaccented Vietnamese and English while respecting origin filters",()=>{
 const terms=[{id:"rose",name:"Hoa Hồng",englishName:"Rose",originIds:["flowers"]},{id:"woody",name:"Gỗ",englishName:"Woody",originIds:["woods"]}];
 assert.deepEqual(filterLibraryTerms(terms,"hoa hong").map(row=>row.id),["rose"]);
 assert.deepEqual(filterLibraryTerms(terms," ROSE ").map(row=>row.id),["rose"]);
 assert.deepEqual(filterLibraryTerms(terms,"go","woods").map(row=>row.id),["woody"]);
 assert.deepEqual(filterLibraryTerms(terms,"rose","woods"),[]);
 assert.equal(libraryDisplayName({name:"Hoa (Floral)",englishName:"Floral"}),"Hoa");
 assert.equal(libraryDisplayName({name:"Hoa (tươi)",englishName:"Floral"}),"Hoa (tươi)");
});
test("note sections keep shared memberships and retain owner-created notes without a source category",()=>{
 const origins=[{id:"one",name:"One"},{id:"two",name:"Two"},{id:"empty",name:"Empty"}];
 const shared={id:"shared",originIds:["one","one","two"]},local={id:"local",originIds:[]},unknown={id:"unknown",originIds:["missing"]};
 const grouped=groupLibraryTerms([shared,local,unknown],origins);
 assert.deepEqual(grouped.map(group=>[group.id,group.terms.map(term=>term.id)]),[["one",["shared"]],["two",["shared"]],["other-notes",["local","unknown"]]]);
 assert.equal(origins[0].terms,undefined);
});
test("invalid kinds, injected parameters and unknown entries fail without broad product reads",async t=>{
 t.mock.method(FragranceTerm,"find",()=>({select:()=>({lean:async()=>rows})}));
 t.mock.method(Product,"find",()=>{throw Error("Unexpected product read");});
 for(const [handler,req,status] of [[publicLibraryTerms,{params:{kind:"__proto__"},query:{}},404],[publicLibraryTerms,{params:{kind:"note"},query:{q:{$ne:""}}},400],[publicLibraryTerms,{params:{kind:"note"},query:{page:"-1"}},400],[publicLibraryTerm,{params:{kind:"note",slug:"missing"},query:{}},404]]){
  const res=response();await handler(req,res);assert.equal(res.statusCode,status);assert.equal(res.body.success,false);
 }
});
test("removed brand introductions return 404 before reading brand content",async t=>{
 t.mock.method(FragranceTerm,"find",()=>{throw Error("Unexpected brand content read");});
 t.mock.method(FragranceTerm,"findById",()=>{throw Error("Unexpected brand content read");});
 for(const [handler,params,query] of [[publicLibraryTerms,{kind:"brand"},{}],[publicLibraryTerm,{kind:"brand",slug:"dior"},{}],[publicLibraryTerm,{kind:"brand"},{name:"Dior"}]]){
  const res=response();await handler({params,query},res);
  assert.equal(res.statusCode,404);assert.equal(res.body.success,false);
 }
});
test("all relation filters exclude unpublished/deleted products and use literal labels",()=>{
 for(const kind of ["brand","group","accord","note"]){const filter=libraryProductFilter({kind,name:"Rose (A+B)",sourceUrl:"https://example.com/note"});assert.deepEqual(filter.isPublished,{$ne:false});assert.deepEqual(filter.isDeleted,{$ne:true});}
 const filter=libraryProductFilter({kind:"brand",name:"A+B"});assert.equal(filter.brand.test("A+B"),true);assert.equal(filter.brand.test("AAAB"),false);
 assert.ok(libraryProductFilter({kind:"note",name:"Rose"}).$or.some(row=>row["fragrance.components.notes.base.name"]));
});
test("canonical page paths use stable readable slugs and routes remain public",()=>{
 assert.equal(librarySlug({name:"Renamed",slug:"original-local-123"}),"original-local-123");
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
 await api.library("group",{slug:"woody",page:1});assert.equal(calls[2].url,"/api/library/group/woody");assert.deepEqual(calls[2].params,{page:1});
 await api.library("group",{name:"Woody",page:1});assert.equal(calls[3].url,"/api/library/group/entry");assert.equal(calls[3].params.name,"Woody");
 assert.ok(api.peekLibrary("note",{q:"rose",page:1}));api.clear();assert.equal(api.peekLibrary("note",{q:"rose",page:1}),undefined);
});
