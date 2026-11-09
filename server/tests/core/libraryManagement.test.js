import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import FragranceTerm from '../../models/FragranceTerm.js';
import Product from '../../models/Product.js';
import {createLibraryTerm,saveLibraryTerm,deleteLibraryTerm,libraryTerms} from '../../controllers/catalogController.js';
import {readLibraryInput,liveLibraryCounts} from '../../services/libraryManagement.js';
import {renamedLibraryFields,activeLibraryProducts,libraryNamePattern} from '../../services/libraryRelations.js';
import {librarySlug} from '../../../client/src/utils/fragranceLibrary.js';
import router from '../../routes/catalogRoute.js';
import authUser,{requireOwner} from '../../middleware/authMiddleware.js';
const id='507f1f77bcf86cd799439011',at=new Date('2026-11-01T00:00:00Z');
const response=()=>({statusCode:200,set(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const current=kind=>({_id:id,kind,key:'https://apaniche.vn/original',sourceUrl:'https://apaniche.vn/original',name:'Old (A+B)',description:'Previous',image:'/images/existing.webp',slug:'original-stable',updatedAt:at});
const chain=value=>({session(){return this;},select(){return this;},sort(){return this;},skip(){return this;},limit(){return this;},lean:async()=>value,then(resolve,reject){return Promise.resolve(value).then(resolve,reject);}});
function setup(t,kind='brand'){
 const state={term:current(kind),saved:[],removed:[],bulk:[],products:[],used:0,duplicate:null},session={};
 t.mock.method(mongoose.connection,'transaction',async callback=>callback(session));
 t.mock.method(FragranceTerm,'findById',()=>chain(state.term));
 t.mock.method(FragranceTerm,'findOne',()=>chain(state.duplicate));
 t.mock.method(FragranceTerm,'findOneAndUpdate',async(filter,update,options)=>{assert.equal(options.session,session);state.saved.push({filter,update,options});return {...state.term,...update.$set};});
 t.mock.method(FragranceTerm,'findOneAndDelete',async(filter,options)=>{assert.equal(options.session,session);state.removed.push(filter);return state.term;});
 t.mock.method(Product,'find',()=>chain(state.products));
 t.mock.method(Product,'countDocuments',()=>chain(state.used));
 t.mock.method(Product,'bulkWrite',async(operations,options)=>{assert.equal(options.session,session);state.bulk.push(operations);return {matchedCount:operations.length};});
 return state;
}
const body=(name='Old (A+B)')=>({name,description:'Nội dung mới',contentStatus:'complete',expectedUpdatedAt:at.toISOString()});

test('all library write routes are behind authenticated owner middleware',()=>{
 assert.equal(router.stack[0].handle,authUser);assert.equal(router.stack[1].handle,requireOwner);
 for(const [method,path] of [['post','/terms'],['patch','/terms/:id'],['delete','/terms/:id']])assert.ok(router.stack.some(layer=>layer.route?.path===path&&layer.route.methods[method]));
 const unique=FragranceTerm.schema.indexes().filter(([,options])=>options.unique&&options.partialFilterExpression);assert.equal(unique.length,2);
});

for(const kind of ['brand','group','accord','note'])test(`create ${kind} normalizes names, sanitizes articles and owns its identity`,async t=>{
 t.mock.method(FragranceTerm,'findOne',()=>chain(null));
 let created;t.mock.method(FragranceTerm,'create',async value=>{created=value;return {...value,createdAt:at,updatedAt:at};});
 const res=response();await createLibraryTerm({method:'POST',body:{kind,name:'  Hương   Mới  ',description:'Giới thiệu',image:'/images/cover.webp',contentStatus:'complete',key:'injected',sourceUrl:'https://evil.example',productCount:999,slug:'injected',_id:id}},res);
 assert.equal(res.statusCode,201);assert.equal(created.name,'Hương Mới');assert.equal(created.nameKey,'hương mới');assert.equal(created.kind,kind);assert.equal(created.sourceUrl,'');assert.equal(created.productCount,0);assert.notEqual(String(created._id),id);
 assert.match(created.key,/^local:/);assert.notEqual(created.slug,'injected');assert.equal(librarySlug({...created,name:'Changed later'}),created.slug);assert.equal(created.image,'/images/cover.webp');
});

test('invalid names, kinds, status, image URLs and unsafe articles never create records',async t=>{
 const write=t.mock.method(FragranceTerm,'create',()=>assert.fail('No writes'));
 for(const change of [{name:''},{name:{$ne:''}},{kind:'other'},{name:'x'.repeat(201)},{contentStatus:{$ne:''}},{image:'javascript:alert(1)'},{image:'https://user:pass@example.com/a.jpg'},{descriptionContent:{type:'script'}}]){
  const res=response();await createLibraryTerm({body:{kind:'brand',name:'Valid',...change}},res);assert.equal(res.statusCode,400);
 }
 assert.equal(write.mock.callCount(),0);
});

test('existing names and concurrent unique-index conflicts receive a clear conflict',async t=>{
 t.mock.method(FragranceTerm,'findOne',()=>chain(current('brand')));
 let res=response();await createLibraryTerm({body:{kind:'brand',name:'Old (A+B)'}},res);assert.equal(res.statusCode,409);
 t.mock.method(FragranceTerm,'findOne',()=>chain(null));t.mock.method(FragranceTerm,'create',async()=>{throw {code:11000};});
 res=response();await createLibraryTerm({body:{kind:'note',name:'New'}},res);assert.equal(res.statusCode,409);
 assert.equal(libraryNamePattern('A+B (C)').test('  A+B   (C) '),true);assert.equal(libraryNamePattern('A+B (C)').test('AAAB C'),false);
});

for(const kind of ['brand','group','accord','note'])test(`${kind} edits preserve source/slug and synchronize related product labels`,async t=>{
 const state=setup(t,kind),term=state.term;
 state.products=[{_id:'product',updatedAt:at,brand:term.name,fragrance:{group:term.name,accords:[{label:term.name,displayedPercent:33,url:'original',color:'#fff'}],notes:{general:[{name:'Alias',url:term.sourceUrl,extra:42}]},components:[{name:'Component',group:term.name,accords:[{label:term.name,displayedPercent:12}],notes:{base:[{name:term.name,url:term.sourceUrl}]}}]}}];
 const res=response();await saveLibraryTerm({method:'PATCH',params:{id},body:{...body('New Name'),kind:'hacked',key:'hacked',slug:'hacked',sourceUrl:'https://evil.example'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.body.updatedProducts,1);assert.equal(state.bulk.length,1);
 assert.equal(res.body.term.sourceUrl,term.sourceUrl);assert.equal(res.body.term.slug,term.slug);assert.equal(res.body.term.key,term.key);assert.equal(res.body.term.kind,kind);
 const operation=state.bulk[0][0].updateOne;assert.equal(operation.filter.updatedAt,at);assert.deepEqual(operation.filter.isDeleted,{$ne:true});
 const fields=operation.update.$set;
 if(kind==='brand')assert.deepEqual(fields,{brand:'New Name'});
 else if(kind==='group'){assert.equal(fields.fragrance.group,'New Name');assert.equal(fields.fragrance.components[0].group,'New Name');}
 else if(kind==='accord'){assert.equal(fields.fragrance.accords[0].label,'New Name');assert.equal(fields.fragrance.accords[0].displayedPercent,33);assert.equal(fields.fragrance.accords[0].color,'#fff');assert.equal(fields.fragrance.components[0].accords[0].label,'New Name');}
 else {assert.equal(fields.fragrance.notes.general[0].name,'New Name');assert.equal(fields.fragrance.notes.general[0].url,term.sourceUrl);assert.equal(fields.fragrance.notes.general[0].extra,42);assert.equal(fields.fragrance.components[0].notes.base[0].name,'New Name');}
 assert.equal(state.products[0].fragrance.group,term.name);
});

test('content-only edits leave product fields alone and preserve omitted cover images',async t=>{
 const state=setup(t);const res=response();await saveLibraryTerm({params:{id},body:body()},res);
 assert.equal(res.statusCode,200);assert.equal(state.bulk.length,0);assert.equal(res.body.term.image,'/images/existing.webp');assert.equal(state.saved[0].update.$set.image,undefined);
 const input=readLibraryInput({...body(),image:''},'brand');assert.equal(input.image,'');
 const rename=readLibraryInput({name:'Renamed'},'brand',{description:'Keep introduction',descriptionContent:null,contentStatus:'complete'});assert.equal(rename.description,'Keep introduction');assert.equal(rename.contentStatus,'complete');
});

test('legacy duplicate translated names stay editable and distinct note URLs never merge',async t=>{
 const state=setup(t,'note');state.duplicate={_id:'legacy-other'};
 let res=response();await saveLibraryTerm({params:{id},body:body()},res);assert.equal(res.statusCode,200);assert.equal(state.saved[0].update.$set.nameKey,undefined);
 const term=state.term,notes={general:[{name:term.name,url:term.sourceUrl},{name:term.name,url:'https://apaniche.vn/another-note'},{name:term.name,url:null}]};
 const renamed=renamedLibraryFields({fragrance:{notes}}, {...term,matchNameWithoutUrl:false},'Unique Name');
 assert.equal(renamed.fragrance.notes.general[0].name,'Unique Name');assert.equal(renamed.fragrance.notes.general[1].name,term.name);assert.equal(renamed.fragrance.notes.general[2].name,term.name);
});

test('stale, missing and duplicate edits fail before product writes',async t=>{
 const state=setup(t);
 for(const value of [undefined,'invalid','2000-01-01']){const res=response();await saveLibraryTerm({params:{id},body:{...body('New'),expectedUpdatedAt:value}},res);assert.equal(res.statusCode,value==='2000-01-01'?409:400);}
 state.duplicate={_id:'other'};let res=response();await saveLibraryTerm({params:{id},body:body('Duplicate')},res);assert.equal(res.statusCode,409);
 state.term=null;res=response();await saveLibraryTerm({params:{id},body:body()},res);assert.equal(res.statusCode,404);
 assert.equal(state.saved.length,0);assert.equal(state.bulk.length,0);
});

test('a product version conflict aborts the rename transaction',async t=>{
 const state=setup(t);state.products=[{_id:'product',updatedAt:at,brand:state.term.name}];
 t.mock.method(Product,'bulkWrite',async()=>({matchedCount:0}));
 const res=response();await saveLibraryTerm({params:{id},body:body('New')},res);assert.equal(res.statusCode,409);
});

for(const kind of ['brand','group','accord','note'])test(`delete ${kind} blocks active/hidden product links and deletes only an unused current record`,async t=>{
 const state=setup(t,kind);state.used=2;
 let res=response();await deleteLibraryTerm({method:'DELETE',params:{id},body:{expectedUpdatedAt:at.toISOString()}},res);
 assert.equal(res.statusCode,409);assert.match(res.body.message,/2 sản phẩm/);assert.equal(state.removed.length,0);
 const filter=activeLibraryProducts(state.term);assert.deepEqual(filter.isDeleted,{$ne:true});assert.equal(filter.isPublished,undefined);
 state.used=0;res=response();await deleteLibraryTerm({method:'DELETE',params:{id},body:{expectedUpdatedAt:at.toISOString()}},res);
 assert.equal(res.body.success,true);assert.equal(state.removed.length,1);assert.equal(state.removed[0].updatedAt,at);
});

test('deletes reject malformed IDs, missing versions and stale snapshots',async t=>{
 const state=setup(t);
 for(const req of [{params:{id:'bad'},body:{}},{params:{id},body:{}},{params:{id},body:{expectedUpdatedAt:'2000-01-01'}}]){
  const res=response();await deleteLibraryTerm(req,res);assert.ok([400,409].includes(res.statusCode));
 }
 assert.equal(state.removed.length,0);
});

test('live usage counts are one bounded aggregate, include components, and omit deleted products',async t=>{
 let pipeline;t.mock.method(Product,'aggregate',async value=>{pipeline=value;return[{term0:[{count:3}],term1:[]}];});
 const terms=[current('brand'),{...current('note'),_id:'other'}],rows=await liveLibraryCounts(terms);
 assert.equal(rows[0].productCount,3);assert.equal(rows[1].productCount,0);assert.deepEqual(pipeline[0].$match.isDeleted,{$ne:true});assert.equal(pipeline[0].$match.isPublished,undefined);assert.equal(Object.keys(pipeline[2].$facet).length,2);
 assert.ok(activeLibraryProducts(terms[1]).$or.some(row=>row['fragrance.components.notes.general.url']));
 assert.equal(renamedLibraryFields({fragrance:{group:'Unrelated'}},current('group'),'New'),null);
});

test('owner library list returns live counts and rejects injected state filters',async t=>{
 t.mock.method(FragranceTerm,'find',()=>chain([current('brand')]));t.mock.method(FragranceTerm,'countDocuments',async()=>1);t.mock.method(Product,'aggregate',async()=>[{_id:'Old (A+B)',count:4}]);
 const res=response();await libraryTerms({query:{kind:'brand'}},res);assert.equal(res.body.terms[0].productCount,4);
 const bad=response();await libraryTerms({query:{kind:'brand',status:{$ne:''}}},bad);assert.equal(bad.statusCode,400);
});

test('dropdown term queries support large pageSize without counts and merge distinct product values',async t=>{
 t.mock.method(FragranceTerm,'find',()=>chain([{...current('brand'),name:'Dior'},{...current('brand'),_id:'2',name:'Chanel'}]));
 t.mock.method(FragranceTerm,'countDocuments',async()=>2);
 t.mock.method(Product,'distinct',async()=>['dior','Amouage','']);
 const res=response();
 await libraryTerms({query:{kind:'brand',pageSize:'2000',includeCounts:'false',includeProductValues:'true'}},res);
 assert.equal(res.statusCode,200);
 assert.deepEqual(res.body.terms.map(item=>item.name),['Amouage','Chanel','Dior']);
 assert.equal(res.body.total,3);
});
