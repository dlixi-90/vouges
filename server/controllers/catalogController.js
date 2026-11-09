import mongoose, { isValidObjectId } from "mongoose";
import Product from "../models/Product.js";
import FragranceTerm from "../models/FragranceTerm.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { getSizeRenames, buildCartSizeRename } from "../utils/productVariants.js";
import { sanitizeFragranceRows } from "../services/fragranceEditing.js";
import { sanitizeArticle, articleToPlainText } from "../../client/src/utils/productArticle.js";
import { v2 as cloudinary } from "cloudinary";
import { unlink } from "node:fs/promises";
import { catalogSnapshot, invalidateStorefrontCatalog } from "../services/storefrontCatalog.js";
import { getDashboardData } from "../services/dashboardService.js";
import { getPopularProducts } from "../services/popularProducts.js";
import { placedOrderFilter } from "../utils/orderReporting.js";
import { productQualityIssues } from "../services/productQuality.js";
import { scentPhases } from "../../client/src/utils/scentNotes.js";
import {librarySlug} from "../../client/src/utils/fragranceLibrary.js";
import {readLibraryInput,readLibraryVersion,checkLibraryVersion,renameLibraryProducts,liveLibraryCounts} from "../services/libraryManagement.js";
import {libraryNamePattern,libraryNameKey,activeLibraryProducts,splitLibraryGroups} from "../services/libraryRelations.js";

const termCollator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const pagination = (query) => {
  const page = Number(query.page || 1), pageSize = Number(query.pageSize || 25);
  const allowed = query.includeCounts === "false" ? [12, 25, 50, 100, 500, 1000, 2000] : [12, 25, 50, 100];
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !allowed.includes(pageSize)) fail("Phân trang không hợp lệ");
  return { page, pageSize };
};
const pattern = (value) => {
  if (typeof value !== "string" || value.length > 160) fail("Từ khóa không hợp lệ");
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
};
const address = (value) => typeof value === "string" && value.length <= 2000 && (/^https?:\/\//i.test(value) || /^\/images\//.test(value));
export const catalogAction = (handler) => async (req,res) => {
  try { await handler(req,res); if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) invalidateStorefrontCatalog(); } catch(error) {
    if (!error.statusCode) console.error(error);
    res.status(error.statusCode || 500).json({success:false,message:error.statusCode ? error.message : "Không thể xử lý dữ liệu catalog"});
  }
};

const readCatalogSummary = async ({ includeOrders = true } = {}) => {
  const [metrics, libraries, orders] = await Promise.all([
    Product.aggregate([{ $match:{isDeleted:{$ne:true}} },{$facet:{
      total:[{$count:"count"}], published:[{$match:{isPublished:true}},{$count:"count"}], available:[{$match:{inStock:true,isPublished:true}},{$count:"count"}],
      issues:[{$match:{"qualityIssues.0":{$exists:true}}},{$count:"count"}], hidden:[{$match:{isPublished:false}},{$count:"count"}],
      sources:[{$match:{inventoryMode:"source"}},{$count:"count"}],
    }}]),
    FragranceTerm.aggregate([{$group:{_id:"$kind",count:{$sum:1},incomplete:{$sum:{$cond:[{$eq:["$contentStatus","linked"]},1,0]}}}}]),
    includeOrders
      ? Order.aggregate([{$match:placedOrderFilter()},{$group:{_id:null,count:{$sum:1},revenue:{$sum:{$cond:["$isPaid","$amount",0]}}}}])
      : Promise.resolve([]),
  ]);
  return {success:true,metrics:Object.fromEntries(Object.entries(metrics[0]||{}).map(([key,value])=>[key,value[0]?.count||0])),libraries,orders:orders[0]||{count:0,revenue:0},currency:"VND"};
};

export const catalogSummary = catalogAction(async (_req,res) => {
  res.set("Cache-Control","private, no-store");
  res.json(await readCatalogSummary());
});

export const catalogOverview = catalogAction(async (req,res) => {
  const timezone=req.query.timezone??"UTC";
  if(typeof timezone!=="string"||timezone.length>100)fail("Múi giờ không hợp lệ");
  try{new Intl.DateTimeFormat("en-US",{timeZone:timezone});}catch{fail("Múi giờ không hợp lệ");}
  const overview = await catalogSnapshot(`owner-overview:${timezone}`, 30000, async () => {
    const fields="title brand category images price sizes inStock qualityIssues";
    const [summary,recentProducts,attentionProducts,sales,popularProducts]=await Promise.all([
      readCatalogSummary({includeOrders:false}),
      Product.find({isDeleted:{$ne:true}}).select(fields).sort({createdAt:-1,_id:-1}).limit(5).lean(),
      Product.find({isDeleted:{$ne:true},"qualityIssues.0":{$exists:true}}).select(fields).sort({title:1,_id:1}).limit(4).lean(),
      getDashboardData({timezone,includeOrders:false}), catalogSnapshot("popular-products",120000,getPopularProducts),
    ]);
    summary.orders={count:sales.totalOrders,revenue:sales.totalRevenue};
    const cards=products=>products.map(product=>({...product,images:product.images?.slice(0,1)||[]}));
    return {...summary,recentProducts:cards(recentProducts),attentionProducts:cards(attentionProducts),popularProducts:cards(popularProducts).slice(0,5),sales:{monthlyData:sales.monthlyData}};
  });
  res.set("Cache-Control","private, no-store");
  res.json(overview);
});

export const catalogProducts = catalogAction(async (req,res) => {
  const {page,pageSize}=pagination(req.query); const filter={isDeleted:{$ne:true}};
  if(req.query.q){const q=pattern(req.query.q);filter.$or=[{title:q},{brand:q}];}
  for(const field of ["brand","concentration","category","catalogScope"])if(req.query[field]){if(typeof req.query[field]!=="string"||req.query[field].length>160)fail("Bộ lọc không hợp lệ");filter[field]=req.query[field];}
  if(req.query.published!==undefined&&req.query.published!=="")filter.isPublished=req.query.published==="true";
  if(req.query.stock!==undefined&&req.query.stock!=="")filter.inStock=req.query.stock==="true";
  if(req.query.quality==="issues")filter["qualityIssues.0"]={$exists:true};
  const sort={ [({price:"title",brand:"brand",newest:"createdAt"})[req.query.sort]||"title"]:req.query.sort==="newest"?-1:1,_id:1};
  const projection={...Object.fromEntries("title brand category concentration gender origin price sizes inStockBySize stockBySize inventoryMode isPublished inStock catalogScope qualityIssues updatedAt".split(" ").map(field=>[field,1])),images:{$slice:1}};
  const [products,total,[brands,concentrations,categories]]=await Promise.all([
    Product.find(filter).select(projection).sort(sort).skip((page-1)*pageSize).limit(pageSize).lean(),
    Product.countDocuments(filter), catalogSnapshot("owner-filter-options",300000,()=>Promise.all([Product.distinct("brand",{isDeleted:{$ne:true}}),Product.distinct("concentration",{isDeleted:{$ne:true}}),Product.distinct("category",{isDeleted:{$ne:true}})])),
  ]);
  res.set("Cache-Control","private, no-store");res.json({success:true,products,total,page,pageSize,totalPages:Math.max(1,Math.ceil(total/pageSize)),filters:{brands:brands.filter(Boolean).sort(),concentrations:concentrations.filter(Boolean).sort(),categories:categories.filter(Boolean).sort()}});
});

export const catalogProduct = catalogAction(async(req,res)=>{
  if(!isValidObjectId(req.params.id))fail("Mã sản phẩm không hợp lệ");
  const product=await Product.findOne({_id:req.params.id,isDeleted:{$ne:true}}).lean();if(!product)fail("Không tìm thấy sản phẩm",404);
  res.set("Cache-Control","private, no-store");res.json({success:true,product});
});

export const saveCatalogProduct = catalogAction(async(req,res)=>{
  if(!isValidObjectId(req.params.id))fail("Mã sản phẩm không hợp lệ");
  const current=await Product.findOne({_id:req.params.id,isDeleted:{$ne:true}});if(!current)fail("Không tìm thấy sản phẩm",404);
  const body=req.body;if(!body.expectedUpdatedAt || new Date(body.expectedUpdatedAt).getTime()!==new Date(current.updatedAt).getTime())fail("Dữ liệu đã thay đổi. Tải lại sản phẩm trước khi lưu.",409);
  const update={};
  for(const field of ["title","brand","origin","concentration","gender","description"]){
    if(body[field]!==undefined){if(typeof body[field]!=="string"||body[field].length>(field==="description"?5000:200))fail("Thông tin sản phẩm không hợp lệ");update[field]=body[field].trim();}
  }
  if(update.title==="")fail("Tên sản phẩm không được trống");
  if(body.descriptionContent!==undefined){
    update.descriptionContent=sanitizeArticle(body.descriptionContent);
    if(update.descriptionContent)update.description=articleToPlainText(update.descriptionContent).trim().slice(0,5000)||(update.title||current.title);
  }else if(update.description!==undefined&&update.description!==current.description){
    update.descriptionContent=null;
  }
  if(update.concentration!==undefined)update.type=update.concentration||"Chưa xác định nồng độ";
  if(body.isPublished===true&&current.catalogScope==="other")fail("Sản phẩm ngoài danh mục nước hoa chỉ được giữ để đối chiếu, không mở bán trên Velours.");
  const sizes=body.sizes??current.sizes;
  if(!Array.isArray(sizes)||sizes.length<1||sizes.length>50||sizes.some(size=>typeof size!=="string"||!size.trim()||size!==size.trim()||size.length>50||size.includes(".")||size.startsWith("$")||["__proto__","constructor","prototype"].includes(size))||new Set(sizes.map(size=>size.toLowerCase())).size!==sizes.length)fail("Dung tích phải khác nhau, tối đa 50 ký tự, không chứa dấu chấm hoặc bắt đầu bằng $.");
  update.sizes=sizes;
  const renames=getSizeRenames(body,current,sizes);
  const originalSize=new Map(renames.map(({from,to})=>[to,from]));
  update.variantMetadata=Object.fromEntries(sizes.filter(size=>current.variantMetadata?.[originalSize.get(size)||size]).map(size=>[size,current.variantMetadata[originalSize.get(size)||size]]));
  const removedSizes=current.sizes.filter(size=>!sizes.includes(size));
  const modeChanged=body.inventoryMode&&body.inventoryMode!==current.inventoryMode;
  const changedSizes=[...new Set([...removedSizes,...renames.flatMap(({from,to})=>[from,...(current.sizes.includes(to)?[to]:[])])])];
  const reservationFilter={paymentMethod:"QR",isPaid:false,status:"Awaiting Payment",items:{$elemMatch:{product:String(current._id),...(!modeChanged&&changedSizes.length?{size:{$in:changedSizes}}:{})}}};
  if(!renames.length&&(changedSizes.length||modeChanged)&&await Order.exists(reservationFilter))fail("Dung tích đang được giữ cho đơn QR. Hoàn tất hoặc hủy giao dịch trước khi thay đổi dung tích hay chế độ kho.",409);
  if(body.inventoryMode!==undefined){if(!["tracked","source"].includes(body.inventoryMode))fail("Chế độ tồn kho không hợp lệ");update.inventoryMode=body.inventoryMode;}
  const mode=update.inventoryMode||current.inventoryMode; const price={},stock={},enabled={},images={};
  for(const size of sizes){
    const previous=originalSize.get(size)||size;
    const amount=body.price?.[size]??current.price?.[previous]; const quantity=body.stockBySize?.[size]??current.stockBySize?.[previous]??0;
    if(!Number.isSafeInteger(amount)||amount<0)fail(`Giá phải là số VND nguyên không âm: ${size}`);
    if(!Number.isSafeInteger(quantity)||quantity<0)fail(`Tồn kho không hợp lệ: ${size}`);
    const status=body.inStockBySize?.[size]??current.inStockBySize?.[previous]??false;if(typeof status!=="boolean")fail("Trạng thái dung tích không hợp lệ");
    const image=body.sizeImages&&Object.hasOwn(body.sizeImages,size)?body.sizeImages[size]:current.sizeImages?.[previous];if(image&&!address(image))fail("Đường dẫn ảnh không hợp lệ");
    price[size]=amount;stock[size]=quantity;enabled[size]=status&&amount>0&&(mode==="source"||quantity>0);if(image)images[size]=image;
  }
  Object.assign(update,{price,stockBySize:stock,inStockBySize:enabled,sizeImages:images,inStock:Object.values(enabled).some(Boolean)});
  if(body.images!==undefined){if(!Array.isArray(body.images)||body.images.length>30||body.images.some((value)=>!address(value)))fail("Bộ ảnh không hợp lệ");update.images=body.images;}
  for(const field of ["isPublished"]){if(body[field]!==undefined){if(typeof body[field]!=="boolean")fail("Trạng thái xuất bản không hợp lệ");update[field]=body[field];}}
  // Visibility is permanent; tolerate the obsolete flag from older dashboard clients.
  update.fragrance={...(current.fragrance||{}),assessmentsVisible:true};
  for(const field of ["accords","longevity","sillage","suitability"]){
    if(body[field]!==undefined)update.fragrance[field]=sanitizeFragranceRows(field,body[field],current.fragrance?.[field]||[]);
  }
  if(body.notes!==undefined){
    if(!body.notes||typeof body.notes!=="object"||Array.isArray(body.notes))fail("Tầng hương không hợp lệ");
    const notes={};for(const [phase] of scentPhases){const list=body.notes[phase]||[];if(!Array.isArray(list)||list.length>60||list.some(item=>!item||typeof item.name!=="string"||!item.name.trim()||item.name.length>160||item.url&& !address(item.url)))fail("Note hương không hợp lệ");notes[phase]=list.map(item=>({name:item.name.trim(),url:item.url||null}));}
    update.fragrance={...(update.fragrance||current.fragrance||{}),notes};
  }
  for(const field of ["group","style"]){
    if(body[field]!==undefined){if(typeof body[field]!=="string"||body[field].length>500)fail("Hồ sơ mùi hương không hợp lệ");const val=field==="group"?[...new Set(splitLibraryGroups(body[field]))].join(", "):body[field].trim();update.fragrance={...(update.fragrance||current.fragrance||{}),[field]:val};}
  }
  update.qualityIssues=productQualityIssues({...((current.toObject?.())||current),...update});
  const persist=async(session)=>{
    if(renames.length&&await Order.exists(reservationFilter).session(session))fail("Dung tích đang được giữ cho đơn QR. Hoàn tất hoặc hủy giao dịch trước khi đổi tên.",409);
    const saved=await Product.findOneAndUpdate({_id:current._id,updatedAt:current.updatedAt},{$set:update},{new:true,runValidators:true,...(session?{session}:{})});
    if(!saved)fail("Dữ liệu đã thay đổi. Vui lòng tải lại.",409);
    if(renames.length){const {filter,pipeline}=buildCartSizeRename(String(current._id),renames);await User.updateMany(filter,pipeline,{session,updatePipeline:true});}
    return saved;
  };
  const product=renames.length?await mongoose.connection.transaction(persist):await persist();
  res.json({success:true,product,message:"Đã lưu sản phẩm"});
});

export const libraryTerms = catalogAction(async(req,res)=>{
  const {page,pageSize}=pagination(req.query);const kind=req.query.kind||"note";if(!["brand","group","accord","note"].includes(kind))fail("Thư viện không hợp lệ");
  if(req.query.status&&!['linked','complete'].includes(req.query.status))fail("Tình trạng nội dung không hợp lệ");
  const filter={kind};if(req.query.q){const q=pattern(req.query.q);filter.$or=[{name:q},{key:q}];}if(req.query.status)filter.contentStatus=req.query.status;
  const termQuery=FragranceTerm.find(filter);
  if(req.query.includeCounts==="false")termQuery.select("kind name image contentStatus sourceUrl updatedAt");else if(kind==="brand")termQuery.select("kind name image updatedAt");
  const [terms,total]=await Promise.all([
    termQuery.sort({name:1,_id:1}).skip((page-1)*pageSize).limit(pageSize).lean(),
    FragranceTerm.countDocuments(filter),
  ]);
  let listedTerms=req.query.includeCounts==="false"?terms.map(term=>({...term,productCount:null})):await catalogSnapshot(`library-counts:${terms.map(term=>term._id).join(":")}`,300000,()=>liveLibraryCounts(terms));
  if(req.query.includeCounts==="false"&&pageSize>=500){
    listedTerms=listedTerms.toSorted((a,b)=>termCollator.compare(a.name||"",b.name||""));
  }
  res.set("Cache-Control","private, no-store");
  res.json({success:true,terms:listedTerms,total,page,pageSize,totalPages:Math.max(1,Math.ceil(total/pageSize))});
});

export const libraryTermCounts = catalogAction(async(req,res)=>{
  const ids=typeof req.query.ids==="string"?[...new Set(req.query.ids.split(",").filter(Boolean))]:[];
  if(ids.length>25||ids.some(id=>!isValidObjectId(id)))fail("Danh sách mục thư viện không hợp lệ");
  if(!ids.length)return res.json({success:true,counts:[]});
  const terms=await FragranceTerm.find({_id:{$in:ids}}).select("kind name sourceUrl").lean();
  const cached=await catalogSnapshot(`library-counts:${[...ids].sort().join(":")}`,300000,()=>liveLibraryCounts(terms));
  res.set("Cache-Control","private, no-store");
  res.json({success:true,counts:cached.map(term=>({_id:String(term._id),productCount:term.productCount}))});
});

export const libraryTerm = catalogAction(async(req,res)=>{
  if(!isValidObjectId(req.params.id))fail("Mã thư viện không hợp lệ");
  // The editor never reads import evidence; omitting it keeps large intros light.
  const term=await catalogSnapshot(`owner-term:${req.params.id}`,60000,()=>FragranceTerm.findById(req.params.id).select("kind name description descriptionContent image contentStatus sourceUrl updatedAt").lean());
  if(!term)fail("Không tìm thấy mục thư viện",404);
  res.set("Cache-Control","private, no-store");res.json({success:true,term});
});

const libraryMutation=handler=>catalogAction(async(req,res)=>{
  try{await handler(req,res);}catch(error){if(error.code===11000)fail("Tên mục đã tồn tại trong thư viện này.",409);throw error;}
});
const duplicateLibraryName=async(kind,name,id,session)=>{
  const query=FragranceTerm.findOne({kind,name:libraryNamePattern(name),...(id?{_id:{$ne:id}}:{})});
  return await (session?query.session(session):query);
};
export const createLibraryTerm=libraryMutation(async(req,res)=>{
  const kind=req.body?.kind,update=readLibraryInput(req.body,kind);
  if(await duplicateLibraryName(kind,update.name))fail("Tên mục đã tồn tại trong thư viện này.",409);
  const id=new mongoose.Types.ObjectId(),slug=`${librarySlug({name:update.name}).slice(0,120)||kind}-${id}`;
  const term=await FragranceTerm.create({_id:id,kind,key:`local:${id}`,slug,...update,sourceUrl:"",productCount:0});
  invalidateStorefrontCatalog();
  res.status(201).json({success:true,term,message:"Đã thêm mục mới"});
});

export const saveLibraryTerm = libraryMutation(async(req,res)=>{
  if(!isValidObjectId(req.params.id))fail("Mã thư viện không hợp lệ");
  readLibraryInput(req.body,"brand");readLibraryVersion(req.body.expectedUpdatedAt);
  const result=await mongoose.connection.transaction(async session=>{
    const current=await FragranceTerm.findById(req.params.id).session(session).lean();if(!current)fail("Không tìm thấy mục thư viện",404);
    const update=readLibraryInput(req.body,current.kind,current);checkLibraryVersion(current,req.body.expectedUpdatedAt);
    const duplicate=await duplicateLibraryName(current.kind,update.name,current._id,session);
    if(duplicate&&libraryNameKey(current.name)!==update.nameKey)fail("Tên mục đã tồn tại trong thư viện này.",409);
    // Some imported notes legitimately share a translated name but have distinct
    // source identities. They remain editable without indexing a duplicate key.
    if(duplicate)delete update.nameKey;
    const term=await FragranceTerm.findOneAndUpdate({_id:current._id,updatedAt:current.updatedAt},{$set:update},{new:true,runValidators:true,session});
    if(!term)fail("Nội dung đã thay đổi. Vui lòng tải lại.",409);
    const ambiguous=current.kind==='note'&&current.name!==update.name&&await duplicateLibraryName(current.kind,current.name,current._id,session);
    const updatedProducts=current.name!==update.name?await renameLibraryProducts({...current,...(ambiguous?{matchNameWithoutUrl:false}:{})},update.name,session):0;
    return {term,updatedProducts};
  });
  invalidateStorefrontCatalog();
  res.json({success:true,...result,message:"Đã lưu nội dung thư viện"});
});

export const deleteLibraryTerm=libraryMutation(async(req,res)=>{
  if(!isValidObjectId(req.params.id))fail("Mã thư viện không hợp lệ");
  readLibraryVersion(req.body?.expectedUpdatedAt);
  await mongoose.connection.transaction(async session=>{
    const current=await FragranceTerm.findById(req.params.id).session(session).lean();if(!current)fail("Không tìm thấy mục thư viện",404);
    checkLibraryVersion(current,req.body?.expectedUpdatedAt);
    const used=await Product.countDocuments(activeLibraryProducts(current)).session(session);
    if(used)fail(`Có ${used.toLocaleString("vi-VN")} sản phẩm đang sử dụng mục này. Hãy đổi thông tin tương ứng trên các sản phẩm đó trước khi xóa.`,409);
    const removed=await FragranceTerm.findOneAndDelete({_id:current._id,updatedAt:current.updatedAt},{session});
    if(!removed)fail("Nội dung đã thay đổi. Vui lòng tải lại.",409);
  });
  invalidateStorefrontCatalog();res.json({success:true,id:req.params.id,message:"Đã xóa mục thư viện"});
});

export const catalogMedia = catalogAction(async(req,res)=>{
  const files=req.files||[];
  try{
    if(!files.length)fail("Chọn ảnh để tải lên");
    const results=await Promise.allSettled(files.map(async(file)=>{const result=await cloudinary.uploader.upload(file.path,{resource_type:"image"});return result.secure_url;}));
    const error=results.find(item=>item.status==="rejected");if(error)throw error.reason;
    res.json({success:true,images:results.map(item=>item.value)});
  }finally{await Promise.allSettled(files.map(file=>unlink(file.path)));}
});
