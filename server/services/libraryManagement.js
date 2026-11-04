import Product from '../models/Product.js';
import {sanitizeArticle,articleToPlainText,isArticleUrl,LIBRARY_ARTICLE_LIMITS} from '../../client/src/utils/productArticle.js';
import {normalizeLibraryName,libraryNameKey,libraryNamePattern,activeLibraryProducts,libraryProductRelation,renamedLibraryFields} from './libraryRelations.js';
export const rejectLibrary=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
export const validLibraryKind=kind=>['brand','group','accord','note'].includes(kind);
export function readLibraryInput(body,kind,current){
 const name=normalizeLibraryName(body?.name),limit=['note','accord'].includes(kind)?160:200;
 if(!validLibraryKind(kind)||!name||name.length>limit)rejectLibrary(`Tên mục phải có từ 1 đến ${limit} ký tự.`);
 const description=body.description===undefined?(current?.description||''):body.description,contentStatus=body.contentStatus===undefined?(current?.contentStatus||'linked'):body.contentStatus;
 if(typeof description!=='string'||description.length>5000||!['linked','complete'].includes(contentStatus))rejectLibrary('Nội dung thư viện không hợp lệ.');
 const document=body.descriptionContent===undefined?(body.description===undefined?current?.descriptionContent??null:null):body.descriptionContent;
 const update={name,nameKey:libraryNameKey(name),description:description.trim(),descriptionContent:sanitizeArticle(document,LIBRARY_ARTICLE_LIMITS),contentStatus};
 if(update.descriptionContent)update.description=articleToPlainText(update.descriptionContent).trim().slice(0,5000);
 if(body.image!==undefined){if(typeof body.image!=='string'||body.image&&!isArticleUrl(body.image,true))rejectLibrary('Ảnh đại diện không hợp lệ.');update.image=body.image;}
 return update;
}
export function readLibraryVersion(expected){
 if(typeof expected!=='string'||!Number.isFinite(Date.parse(expected)))rejectLibrary('Vui lòng tải lại mục trước khi lưu hoặc xóa.');
 return expected;
}
export function checkLibraryVersion(current,expected){
 readLibraryVersion(expected);
 if(new Date(current.updatedAt).getTime()!==Date.parse(expected))rejectLibrary('Nội dung đã thay đổi. Vui lòng tải lại trước khi tiếp tục.',409);
}
export async function renameLibraryProducts(term,name,session){
 const products=await Product.find(activeLibraryProducts(term)).select('brand fragrance updatedAt').session(session).lean();
 const operations=products.flatMap(product=>{
  const fields=renamedLibraryFields(product,term,name);return fields?[{updateOne:{filter:{_id:product._id,updatedAt:product.updatedAt,isDeleted:{$ne:true}},update:{$set:fields}}}]:[];
 });
 if(operations.length){const result=await Product.bulkWrite(operations,{session});if(result.matchedCount!==operations.length)rejectLibrary('Có sản phẩm vừa thay đổi. Vui lòng tải lại và thử lại.',409);}
 return operations.length;
}
export async function liveLibraryCounts(terms){
 if(!terms.length)return [];
 const brandsOnly=terms.every(term=>term.kind==='brand');
 if(brandsOnly){
  const brandCounts=await Product.aggregate([
   {$match:{isDeleted:{$ne:true},brand:{$type:'string'}}},
   {$group:{_id:'$brand',count:{$sum:1}}},
  ]);
  return terms.map(term=>{
   const pattern=libraryNamePattern(term.name);
   const productCount=brandCounts.reduce((total,row)=>total+(pattern.test(row._id)?row.count:0),0);
   return {...term,productCount};
  });
 }
 const [result]=await Product.aggregate([
  {$match:{isDeleted:{$ne:true},$or:terms.map(libraryProductRelation)}},
  {$project:{brand:1,fragrance:1}},
  {$facet:Object.fromEntries(terms.map((term,index)=>[`term${index}`,[{$match:libraryProductRelation(term)},{$count:'count'}]]))},
 ]);
 return terms.map((term,index)=>({...term,productCount:result?.[`term${index}`]?.[0]?.count||0}));
}
