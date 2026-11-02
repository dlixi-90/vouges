// Local browser harness: real database reads, mocked Clerk identity, and no writes.
// The production server and its authentication middleware are never modified.
// --pagination adds temporary review/inbox fixtures in the browser only.
// --popular-products checks the homepage fallback and temporary sales/error responses.
// --editor-fields exercises edits and uploads in memory; MongoDB remains read-only.
// --operations-ui covers order/voucher/support actions using isolated in-memory fixtures.
// --product-tabs checks detail tabs and unsaved drafts; review eligibility is mocked only here.
import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawn} from "node:child_process";
import mongoose from "mongoose";
import {catalogSummary,catalogOverview,catalogProducts,catalogProduct,libraryTerms} from "../controllers/catalogController.js";
import {listProduct,singleProduct,listPopularProducts} from "../controllers/productController.js";
import {listBrands} from "../controllers/brandController.js";
import {publicLibraryTerms,publicLibraryTerm} from "../controllers/libraryController.js";
import {browseProducts,batchProducts,relatedProducts,productFilters} from "../controllers/storefrontController.js";
import {listCategories} from "../controllers/categoryController.js";
import {dashboard} from "../controllers/dashboardController.js";
import {listVouchers} from "../controllers/voucherController.js";
import {getSupportInbox} from "../controllers/supportController.js";
import Product from "../models/Product.js";
import FragranceTerm from "../models/FragranceTerm.js";
import {getProductImageUrl} from "../../client/src/utils/productImage.js";
import {sanitizeFragranceRows} from "../services/fragranceEditing.js";
import {createOperationsFixtures} from "./qa/operationsFixtures.mjs";
import {createLibraryFixtures} from "./qa/libraryFixtures.mjs";
import {createLoyaltyFixtures} from "./qa/loyaltyFixtures.mjs";
import accordPalette from "../../client/src/data/accordColors.json" with { type: "json" };
import {getAccordColors} from "../../client/src/utils/accordColors.js";
import {sanitizeArticle,articleToPlainText,LIBRARY_ARTICLE_LIMITS} from "../../client/src/utils/productArticle.js";
import {libraryPath} from "../../client/src/utils/fragranceLibrary.js";
import {reviseLibraryPresentation,reviseProductPresentation} from "../../tools/apaniche/library-presentation.mjs";
import {knowledgePresentation} from "../../client/src/utils/knowledgePresentation.js";
import {libraryEnglishName} from "../services/libraryDirectory.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const artifacts=path.join(root,".qa-perfume");fs.mkdirSync(artifacts,{recursive:true});
const libraryRun=process.argv.includes("--library-management"),frontendPort=libraryRun?5190:5188,debugPort=libraryRun?9290:9288;
const profile=path.join(artifacts,libraryRun?`chrome-profile-library-${Date.now()}`:"chrome-profile");
const frontend=`http://localhost:${frontendPort}`;
const paginationQA=process.argv.includes("--pagination");
const typographyQA=process.argv.includes("--typography");
const dashboardQA=process.argv.includes("--dashboard-design");
const popularQA=process.argv.includes("--popular-products");
const editorQA=process.argv.includes("--editor-fields");
const operationsQA=process.argv.includes("--operations-ui");
const operationsOnly=operationsQA&&process.argv.includes("--operations-only");
const brandsQA=process.argv.includes("--brand-menu");
const productTabsQA=process.argv.includes("--product-tabs");
const accordsQA=process.argv.includes("--accord-colors");
const experienceQA=process.argv.includes("--experience-design");
const knowledgeQA=process.argv.includes("--knowledge");
const knowledgeWidthQA=process.argv.includes("--knowledge-width");
const knowledgeIconsQA=process.argv.includes("--knowledge-icons");
const knowledgeGroupCardsQA=process.argv.includes("--knowledge-group-cards");
const knowledgeProductCardsQA=process.argv.includes("--knowledge-product-cards");
const knowledgeOpeningQA=process.argv.includes("--knowledge-opening");
const accordOpeningQA=process.argv.includes("--accord-opening");
const noteCoverQA=process.argv.includes("--note-cover");
const knowledgeRelatedCardsQA=process.argv.includes("--knowledge-related-cards");
const libraryPresentationQA=process.argv.includes("--library-presentation");
const presentationPreview=libraryPresentationQA&&!process.argv.includes("--live-presentation-data");
const descriptionsQA=process.argv.includes("--product-descriptions");
const fullLibraryQA=process.argv.includes("--library-fulltext");
const libraryQA=process.argv.includes("--library-management");
const membershipDesignQA=process.argv.includes("--membership-design");
const policiesDesignQA=process.argv.includes("--policies-design");
const collectionFilterScrollQA=process.argv.includes("--collection-filter-scroll");
const builtCollectionQA=collectionFilterScrollQA&&process.argv.includes("--built");
const builtMembershipQA=membershipDesignQA&&process.argv.includes("--built");
const builtKnowledgeQA=(accordOpeningQA||knowledgeOpeningQA||noteCoverQA)&&process.argv.includes("--built");
const builtPoliciesQA=policiesDesignQA&&process.argv.includes("--built");
const builtArtifactQA=builtCollectionQA||builtMembershipQA||builtKnowledgeQA||builtPoliciesQA;
const loyaltyQA=process.argv.includes("--loyalty"),loyaltyFixtures=loyaltyQA||knowledgeWidthQA||membershipDesignQA?createLoyaltyFixtures():null;
const libraryCover=libraryQA?`/images/library/${fs.readdirSync(path.join(root,'client/public/images/library')).find(file=>file.endsWith('.webp'))}`:'';
let libraryFixtures;
let operationsActive=false,operationsFixtures;
let editorProduct=null,editorUploadImages=[];
const editorPatches=[];
let popularResponse=null;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chrome,vite,ws,id=0;const pending=new Map(),errors=[],checks=[],writes=[];
const inFlightReads=new Set();
const fakeClerk=`import React from '/node_modules/.vite/deps/react.js';
const user={id:'qa-owner',firstName:'Quản trị',lastName:'Velours',fullName:'Quản trị Velours',imageUrl:''};
const getToken=async()=> 'qa-browser-only';const openSignIn=()=>{};
export const useAuth=()=>({userId:user.id,isLoaded:true,isSignedIn:true,getToken});
export const useUser=()=>({user,isLoaded:true,isSignedIn:true});
export const useClerk=()=>({openSignIn,openUserProfile:()=>{window.__profileOpened=true}});
export const ClerkProvider=({children})=>children;
export const UserButton=()=>React.createElement('span',null,'QA');
UserButton.MenuItems=({children})=>children;UserButton.Action=()=>null;UserButton.Link=()=>null;`;
let builtClerkMock;
if(builtMembershipQA){
  const assets=path.join(root,'client/dist/assets'),files=fs.readdirSync(assets);
  const clerk=files.find(file=>/^clerk-.*\.js$/u.test(file)),react=files.find(file=>/^react-runtime-.*\.js$/u.test(file));
  const source=fs.readFileSync(path.join(assets,clerk),'utf8');
  // Fail explicitly if a Clerk dependency update changes the compiled export contract.
  assert.ok(source.includes('export{un as a,Jr as i,ia as n,fn as o,Pr as r,la as t}'),'Update the browser-only Clerk mock aliases for the new build');
  builtClerkMock={name:clerk,body:fakeClerk.replace("import React from '/node_modules/.vite/deps/react.js';",`import {i as createReact} from '/assets/${react}';const React=createReact();`)+"\nconst viVN={};export{useClerk as a,useAuth as i,ClerkProvider as n,useUser as o,UserButton as r,viVN as t};"};
}

const call=async(handler,req)=>{
  const res={statusCode:200,status(code){this.statusCode=code;return this;},set(){},json(body){this.body=body;return this;}};
  await handler({...req,user:{_id:"qa-owner",role:"owner"},auth:()=>({userId:"qa-owner"})},res);
  if(presentationPreview&&res.body){
    if(Array.isArray(res.body.products))res.body.products=res.body.products.map(product=>({...product,...reviseProductPresentation(product)}));
    if(res.body.product)res.body.product={...res.body.product,...reviseProductPresentation(res.body.product)};
    if(Array.isArray(res.body.brands))res.body.brands=res.body.brands.filter(brand=>!/apa\s*niche/iu.test(brand.name));
    for(const options of [res.body.options,res.body.filters?.options])if(Array.isArray(options?.brands))options.brands=options.brands.filter(brand=>!/apa\s*niche/iu.test(brand));
  }
  return res;
};
const api=async request=>{
  const url=new URL(request.url),pathname=url.pathname;const req={query:Object.fromEntries(url.searchParams),params:{}};
  if(request.method==="OPTIONS")return {statusCode:204,body:null};
  if(knowledgeWidthQA&&url.pathname==="/api/orders/mine")return {statusCode:200,body:{success:true,orders:[],total:0,page:1,totalPages:1}};
  if(loyaltyFixtures){const fixture=loyaltyFixtures.respond(request);if(fixture)return fixture;}
  if(operationsActive){const fixture=operationsFixtures.respond(request);if(fixture)return fixture;}
  if(libraryFixtures){const fixture=libraryFixtures.respond(request);if(fixture)return fixture;}
  // These edits live only in the browser harness; never pass writes to MongoDB.
  if(editorQA&&editorProduct&&request.method==="PATCH"&&pathname===`/api/catalog/products/${editorProduct._id}`){
    const body=JSON.parse(request.postData);editorPatches.push(body);
    assert.equal(body.expectedUpdatedAt,editorProduct.updatedAt);
    const fragrance={...editorProduct.fragrance,group:body.group,style:body.style,notes:body.notes,assessmentsVisible:true};
    for(const field of ['accords','longevity','sillage','suitability'])fragrance[field]=sanitizeFragranceRows(field,body[field],editorProduct.fragrance[field]);
    const inStockBySize=Object.fromEntries(body.sizes.map(size=>[size,Boolean(body.inStockBySize[size]&&body.price[size]>0&&(body.inventoryMode==='source'||body.stockBySize[size]>0))]));
    const sizeImages=Object.fromEntries(body.sizes.filter(size=>body.sizeImages[size]).map(size=>[size,body.sizeImages[size]]));
    const descriptionContent=body.descriptionContent===undefined?editorProduct.descriptionContent:sanitizeArticle(body.descriptionContent);
    const description=descriptionContent?articleToPlainText(descriptionContent).trim().slice(0,5000)||editorProduct.title:body.description??editorProduct.description;
    editorProduct={...editorProduct,descriptionContent,description,fragrance,images:body.images,sizes:body.sizes,inventoryMode:body.inventoryMode,stockBySize:body.stockBySize,price:body.price,inStockBySize,sizeImages,inStock:Object.values(inStockBySize).some(Boolean),updatedAt:new Date().toISOString()};
    return {statusCode:200,body:{success:true,product:editorProduct}};
  }
  if(editorQA&&request.method==="POST"&&pathname==="/api/catalog/media")return {statusCode:200,body:{success:true,images:editorUploadImages}};
  if(request.method!=="GET"){writes.push({method:request.method,path:pathname,body:request.postData});return {statusCode:405,body:{success:false,message:"Browser QA is read-only"}};}
  if(pathname==="/api/users")return {statusCode:200,body:{success:true,role:"owner",cartData:{},cartAddedAt:{}}};
  if(pathname==="/api/catalog/summary")return call(catalogSummary,req);
  if(pathname==="/api/catalog/overview")return call(catalogOverview,req);
  if(pathname==="/api/catalog/products")return call(catalogProducts,req);
  if(pathname.startsWith("/api/catalog/products/")){req.params.id=pathname.split("/").pop();const result=await call(catalogProduct,req);if(editorQA&&req.params.id===editorProduct?._id)result.body.product=editorProduct;return result;}
  if(pathname==="/api/catalog/terms")return call(libraryTerms,req);
  if(pathname.startsWith('/api/library/')){const parts=pathname.split('/').filter(Boolean);req.params.kind=parts[2];if(parts[3]&&parts[3]!=='entry')req.params.slug=decodeURIComponent(parts[3]);const result=await call(parts[3]?publicLibraryTerm:publicLibraryTerms,req);
    if(presentationPreview&&result.body?.term){const revised=reviseLibraryPresentation({...result.body.term,contentImport:{relatedHeading:result.body.term.relatedHeading}});if(revised.changed)result.body.term={...result.body.term,description:revised.description,descriptionContent:revised.descriptionContent,relatedHeading:revised.relatedHeading};}
    return result;}
  if(pathname==="/api/products")return call(listProduct,req);
  if(pathname==="/api/products/browse")return call(browseProducts,req);
  if(pathname==="/api/products/filters")return call(productFilters,req);
  if(pathname==="/api/products/batch")return call(batchProducts,req);
  if(pathname==="/api/products/related")return call(relatedProducts,req);
  if(pathname==="/api/products/brands")return call(listBrands,req);
  if(pathname==="/api/products/single"){const result=await call(singleProduct,req);if(editorQA&&req.query.productId===editorProduct?._id)result.body.product=editorProduct;return result;}
  if(pathname==="/api/products/popular")return popularQA&&popularResponse ? popularResponse : call(listPopularProducts,req);
  if(pathname==="/api/categories")return call(listCategories,req);
  if(pathname==="/api/orders/dashboard")return call(dashboard,req);
  if(pathname==="/api/vouchers")return call(listVouchers,req);
  if(pathname==="/api/vouchers/")return call(listVouchers,req);
  if(pathname==="/api/support/inbox")return call(getSupportInbox,req);
  if(pathname.endsWith("/reviews/mine"))return {statusCode:200,body:{success:true,review:null,eligible:productTabsQA,canReview:false}};
  if(paginationQA&&pathname.endsWith("/reviews")){
    const page=Number(req.query.page||1);
    return {statusCode:200,body:{success:true,count:2860,average:5,reviews:Array.from({length:10},(_,i)=>({_id:`qa-review-${page}-${i}`,authorName:`Khách kiểm thử ${(page-1)*10+i+1}`,rating:5,comment:"Nội dung kiểm tra phân trang trên trình duyệt.",createdAt:"2026-01-01T00:00:00Z"}))}};
  }
  if(paginationQA&&pathname==="/api/support/inbox/events"){
    const page=Number(req.query.page||1);
    const snapshot={total:8500,unread:0,conversations:Array.from({length:30},(_,i)=>({_id:`qa-conversation-${page}-${i}`,customerName:`Khách kiểm thử ${(page-1)*30+i+1}`,lastMessage:"Nội dung kiểm tra phân trang hộp thư.",lastMessageAt:"2026-01-01T00:00:00Z",status:"waiting",unreadStaff:0}))};
    return {statusCode:200,mime:"text/event-stream",body:`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`};
  }
  if(pathname.endsWith("/reviews"))return {statusCode:200,body:{success:true,reviews:[],count:0,average:0}};
  if(pathname==="/api/orders/pending-qr")return {statusCode:200,body:{success:true,order:null}};
  return {statusCode:404,body:{success:false,message:`Unhandled QA read: ${pathname}`}};
};
const send=(method,params={})=>new Promise((resolve,reject)=>{
  const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error(`CDP timeout: ${method}${method==='Page.navigate'?` ${params.url}`:''}`));},method==='Page.navigate'?45000:15000);
  pending.set(requestId,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id:requestId,method,params}));
});
const evaluate=async(expression)=>{
  const result=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
};
const wait=async(expression)=>{const started=Date.now();while(Date.now()-started<25000){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await pause(150);}throw new Error(`UI timeout ${expression}: ${await evaluate('document.body.innerText.slice(0,800)')}`);};
const goto=async(url,condition)=>{
  await evaluate('window.__oldQaDocument=true');
  try{await send("Page.navigate",{url:frontend+url});}
  catch(error){throw new Error(`${error.message}; state=${JSON.stringify(await evaluate("({url:location.href,ready:document.readyState,text:document.body?.innerText.slice(0,500)})"))}`);}
  await wait(`!window.__oldQaDocument&&(${condition})`);
};
const screenshot=async(name)=>{const result=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});fs.writeFileSync(path.join(artifacts,`${name}.png`),Buffer.from(result.data,"base64"));};
const clickText=async(text)=>evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!button)throw new Error('Missing button');button.click();return true;})()`);
const input=async(selector,value)=>evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw new Error('Missing input');Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
const noOverflow=async()=>assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),true,"Document overflows horizontally");
const assertKnowledgeProductCards=async()=>{
  const layout=await evaluate("(()=>{const grid=document.querySelector('.knowledge-product-grid');if(!grid)return null;const box=grid.getBoundingClientRect(),style=getComputedStyle(grid);return {left:box.left,right:box.right,columns:style.gridTemplateColumns.split(' ').length,gap:parseFloat(style.columnGap),cards:[...grid.querySelectorAll('.net-product-card')].map(card=>{const r=card.getBoundingClientRect(),media=card.querySelector('.net-product-media'),m=media.getBoundingClientRect(),p=card.querySelector('.net-product-price').getBoundingClientRect();return {href:card.getAttribute('href'),left:r.left,right:r.right,top:r.top,width:r.width,height:r.height,mediaWidth:m.width,mediaHeight:m.height,priceTop:p.top,color:getComputedStyle(media).backgroundColor}})}})()");
  if(!layout)return [];
  for(const card of layout.cards){assert.ok(card.width<=260.5&&card.height<430&&Math.abs(card.mediaWidth-card.mediaHeight)<1,JSON.stringify(card));const id=card.href.split('/').pop();assert.equal(card.color,['rgb(242, 242, 242)','rgb(246, 249, 246)','rgb(246, 248, 254)'][parseInt(id.slice(-4),16)%3]);}
  for(const row of Map.groupBy(layout.cards,card=>Math.round(card.top)).values()){
    assert.ok(row.length<=layout.columns&&layout.columns<=5);assert.ok(Math.abs(row[0].left-layout.left)<1,'Every row starts at the left edge, including incomplete rows');
    for(let i=0;i<row.length;i++)assert.ok(Math.abs(row[i].left-layout.cards[i].left)<1&&Math.abs(row[i].width-(layout.right-layout.left-layout.gap*(layout.columns-1))/layout.columns)<1,'Products occupy equal-width aligned columns');
    if(row.length===layout.columns)assert.ok(Math.abs(row.at(-1).right-layout.right)<1,'Full rows fill the available page width');
    assert.ok(Math.max(...row.map(card=>card.height))-Math.min(...row.map(card=>card.height))<1,'Related-product card heights align');
    assert.ok(Math.max(...row.map(card=>card.priceTop))-Math.min(...row.map(card=>card.priceTop))<1,'Related-product prices align');
  }
  return layout.cards;
};
const checkSerif=async(selector)=>{
  await evaluate("document.fonts.ready");
  await evaluate("document.fonts.load('500 32px Lora','ĐÁNH THỨC VẺ ĐẸP CỦA BẠN ƯU ĐÃI')");
  assert.equal(await evaluate(`(()=>{const style=getComputedStyle(document.querySelector(${JSON.stringify(selector)}));return style.fontFamily.includes('Lora')&&Number(style.fontWeight)>=500})()`),true,'Serif text uses Lora Medium or heavier');
  const {root:documentRoot}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:documentRoot.nodeId,selector});
  const {fonts}=await send('CSS.getPlatformFontsForNode',{nodeId});
  assert.ok(fonts.length&&fonts.every(font=>font.familyName.includes('Lora')),JSON.stringify(fonts));
};
const compactPager=async(selector)=>{
  assert.equal(await evaluate(`(()=>{const nav=document.querySelector(${JSON.stringify(selector)});const buttons=[...nav.querySelectorAll('button')];return buttons.length<=9&&new Set(buttons.map(button=>Math.round(button.getBoundingClientRect().top))).size===1})()`),true,"Pager should fit in one compact row");
};
const selectPage=async(nav,target,page,scrollContainer)=>{
  await evaluate(`document.querySelector(${JSON.stringify(nav)}).scrollIntoView({block:'start',behavior:'instant'})`);
  await evaluate(`document.querySelector(${JSON.stringify(nav+` [aria-label="Trang ${page}"]`)}).click()`);
  try{await wait(`(()=>{const list=document.querySelector(${JSON.stringify(target)});const selected=document.querySelector(${JSON.stringify(nav+' [aria-current="page"]')});const container=${scrollContainer?`document.querySelector(${JSON.stringify(scrollContainer)})`:"null"};const top=list?.getBoundingClientRect().top;return selected?.textContent.trim()===${JSON.stringify(String(page))}&&document.activeElement===list&&(container?Math.abs(top-container.getBoundingClientRect().top)<30:top>=-2&&top<innerHeight*.3)})()`);}
  catch(error){await screenshot('pagination-failure');console.log(JSON.stringify(await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(target)});return {page:${page},selected:document.querySelector(${JSON.stringify(nav+' [aria-current="page"]')})?.textContent,focused:document.activeElement?.className,top:el?.getBoundingClientRect().top,y:scrollY,documentHeight:document.documentElement.scrollHeight,height:innerHeight}})()`)));throw error;}
};

try{
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000,autoIndex:false,autoCreate:false});
  const sample=await Product.findOne({isPublished:true,inStock:true,"sizes.1":{$exists:true},"fragrance.notes.top.0":{$exists:true},...(editorQA?{"images.2":{$exists:true}}:{})}).lean();
  assert.ok(sample);
  if(operationsQA)operationsFixtures=createOperationsFixtures(sample);
  if(libraryQA)libraryFixtures=createLibraryFixtures(libraryCover);
  if(editorQA)editorProduct={...JSON.parse(JSON.stringify(sample)),fragrance:{...sample.fragrance,accords:[],assessmentsVisible:false}};
  vite=spawn(process.execPath,[path.join(root,"client/node_modules/vite/bin/vite.js"),...(builtArtifactQA?['preview','--outDir',path.join(root,'.deploy-media-frontend/.vercel/output/static')]:[]),"--host","127.0.0.1","--port",String(frontendPort),"--strictPort"],{cwd:path.join(root,"client"),windowsHide:true,stdio:"ignore"});
  for(let i=0;i<100;i++){try{if((await fetch(frontend)).ok)break;}catch{}await pause(150);}
  if(!builtArtifactQA&&(accordOpeningQA||noteCoverQA||knowledgeOpeningQA||membershipDesignQA||collectionFilterScrollQA)){
    console.log(JSON.stringify({phase:'knowledge-module-warmup'}));
    // Finish Vite's initial transforms before starting the browser/CDP deadline.
    await Promise.all(['/src/main.jsx','/src/index.css','/src/App.jsx',...(collectionFilterScrollQA?['/src/pages/Collection.jsx','/src/components/CollectionFilterDrawer.jsx']:membershipDesignQA?['/src/pages/Membership.jsx','/src/components/LoyaltyMemberPanel.jsx']:['/src/pages/Knowledge.jsx','/src/components/ProductArticle.jsx'])].map(async route=>{
      const response=await fetch(frontend+route,{signal:AbortSignal.timeout(60000)});assert.ok(response.ok,route);await response.text();
    }));
  }
  chrome=spawn("C:/Program Files/Google/Chrome/Application/chrome.exe",["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-allow-origins=*",`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,"about:blank"],{windowsHide:true,stdio:"ignore"});
  let target;for(let i=0;i<100;i++){try{target=(await(await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(t=>t.type==="page");if(target)break;}catch{}await pause(150);}assert.ok(target);
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=async event=>{
    const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);if(item){pending.delete(data.id);data.error?item.reject(new Error(JSON.stringify(data.error))):item.resolve(data.result);}return;}
    if(data.method==="Runtime.exceptionThrown")errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
    if(data.method==="Fetch.requestPaused"){
      const {requestId,request}=data.params;
      try{
        let result,mime;
        if(builtClerkMock&&request.url.endsWith('/'+builtClerkMock.name)){result={statusCode:200,body:builtClerkMock.body};mime="text/javascript";}
        else if(request.url.includes("@clerk_react")){result={statusCode:200,body:fakeClerk};mime="text/javascript";}
        else{
          const operation=api(request);inFlightReads.add(operation);
          try{result=await operation;}finally{inFlightReads.delete(operation);}
          mime=result.mime||"application/json";
        }
        if(ws.readyState!==1)return;
        await send("Fetch.fulfillRequest",{requestId,responseCode:result.statusCode,responseHeaders:[{name:"Content-Type",value:mime},{name:"Access-Control-Allow-Origin",value:frontend},{name:"Access-Control-Allow-Headers",value:"Authorization,Content-Type"},{name:"Access-Control-Allow-Methods",value:"GET,PATCH,POST,PUT,DELETE,OPTIONS"}],body:Buffer.from(typeof result.body==="string"?result.body:JSON.stringify(result.body)).toString("base64")});
      }catch(error){
        // Navigation can cancel a paused request before its database read finishes.
        if(error.message==='{"code":-32602,"message":"Invalid InterceptionId."}')return;
        errors.push(error.message);try{await send("Fetch.failRequest",{requestId,errorReason:"Failed"});}catch{}
      }
    }
  };
  await send("Page.enable");await send("Runtime.enable");
  if(typographyQA||editorQA||libraryQA)await send('DOM.enable');
  if(typographyQA)await send('CSS.enable');
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send("Fetch.enable",{patterns:[{urlPattern:"*localhost:3000/*"},{urlPattern:"*@clerk_react*"},...(builtArtifactQA?[{urlPattern:'*vouges-backend.vercel.app/*'}]:[]),...(builtClerkMock?[{urlPattern:'*/'+builtClerkMock.name}]:[])]});
  if(policiesDesignQA){
    const ids=['don-hang','ho-tro','thong-tin'];
    const assertAnchor=async id=>{
      await wait(`location.hash==='#${id}'&&document.activeElement.id==='${id}'`);
      await wait(`(()=>{const section=document.getElementById('${id}'),margin=parseFloat(getComputedStyle(section).scrollMarginTop),target=scrollY+section.getBoundingClientRect().top-margin,max=document.documentElement.scrollHeight-innerHeight;return Math.abs(scrollY-Math.max(0,Math.min(target,max)))<3})()`);
      await noOverflow();
    };
    for(const width of [1440,1024,768,390,320]){
      console.log(JSON.stringify({phase:'policies-design',width}));
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      await goto('/policies',"document.querySelectorAll('.policies-section').length===3");
      await wait("document.title==='Chính sách | Velours'&&scrollY<1");await noOverflow();
      assert.equal(await evaluate("document.querySelectorAll('h1').length"),1);
      assert.deepEqual(await evaluate("[...document.querySelectorAll('.policies-section')].map(section=>section.id)"),ids,'Original footer anchor IDs remain valid');
      assert.equal(await evaluate("document.querySelectorAll('.policies-section-copy p').length"),4,'All four existing policy paragraphs remain');
      assert.deepEqual(await evaluate("[...document.querySelectorAll('.policies-section-copy a')].map(link=>link.getAttribute('href'))"),['/my-orders','/contact']);
      assert.equal(await evaluate("[...document.querySelectorAll('.policies-section')].every(section=>!!document.getElementById(section.getAttribute('aria-labelledby')))"),true);
      assert.equal(await evaluate("document.querySelectorAll('.policies-contact,.policies-intro,.policies-sidebar,.policies-layout,.policies-page .store-page-heading-actions').length"),0,'All three red-marked areas and the sidebar layout are removed');
      assert.equal(await evaluate("(()=>{const page=document.querySelector('.policies-page'),box=page.getBoundingClientRect(),style=getComputedStyle(page),left=box.left+parseFloat(style.paddingLeft),right=box.right-parseFloat(style.paddingRight);return [...document.querySelectorAll('.policies-content,.policies-section')].every(section=>{const r=section.getBoundingClientRect();return Math.abs(r.left-left)<1&&Math.abs(r.right-right)<1})})()"),true,'Policy sections occupy the entire page content width');
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.policies-page')).maxWidth"),'1500px');
      await screenshot('policies-overview-'+width);
      await evaluate("document.querySelector('footer a[href=\"/policies#ho-tro\"]').focus({preventScroll:true})");
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await assertAnchor('ho-tro');
      await evaluate('window.__oldQaDocument=true');await send('Page.navigate',{url:frontend+'/policies#ho-tro'});await send('Page.reload',{ignoreCache:true});await wait("!window.__oldQaDocument&&document.querySelector('#ho-tro')");await assertAnchor('ho-tro');
      await evaluate("document.querySelector('footer a[href=\"/policies#thong-tin\"]').click()");await assertAnchor('thong-tin');
      await evaluate('history.back()');await assertAnchor('ho-tro');
      await screenshot('policies-support-'+width);
    }
    checks.push('Policies at 1440/1024/768/390/320px: red-marked contact button, introduction strip and contents sidebar removed; policy cards fill the full shared page width without an empty sidebar column; no horizontal overflow; all three sections/four original paragraphs and order/contact links preserved; footer keyboard Enter, direct support URL, privacy link and browser Back still reach the correct section with focus; zero database writes');
  }else if(collectionFilterScrollQA){
    const ready="document.querySelector('.inessa-collection-grid')?.getAttribute('aria-busy')==='false'";
    const settled=async()=>{await wait(ready);await pause(250);};
    const scrollDown=async()=>{await evaluate('window.scrollTo({top:1200,left:0,behavior:"instant"})');await pause(80);assert.ok(await evaluate('window.scrollY>600'),'Start below the top of the page');return evaluate('window.scrollY');};
    const top=async()=>{await settled();await wait("(()=>{const grid=document.querySelector('.inessa-collection-grid'),margin=parseFloat(getComputedStyle(grid).scrollMarginTop),target=window.scrollY+grid.getBoundingClientRect().top-margin,max=document.documentElement.scrollHeight-innerHeight;return window.scrollY>0&&Math.abs(window.scrollY-Math.max(0,Math.min(target,max)))<3})()");assert.equal(await evaluate("document.querySelector('.inessa-collection-pagination [aria-current=page]')?.textContent||'1'"),'1','Filters reset pagination');await noOverflow();};
    const choose=async(field,index=0)=>evaluate(`(()=>{const group=document.querySelectorAll('.inessa-filter-facet')[${field}],box=group.querySelectorAll('input[type=checkbox]')[${index}];if(!box)throw Error('Missing filter choice');group.open=true;box.focus({preventScroll:true});box.click();return box.checked;})()`);
    for(const width of [1440,1024,768,390,320]){
      console.log(JSON.stringify({phase:'collection-filter-scroll',width}));
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      await goto('/collection',"document.querySelectorAll('.net-product-card').length>0&&"+ready);await settled();
      if(width>=1024){
        await wait("document.querySelector('#collection-filter-sidebar input[type=checkbox]')");
        const original=await evaluate("[...document.querySelectorAll('.inessa-collection-grid .net-product-card')].map(a=>a.getAttribute('href'))");
        await scrollDown();assert.equal(await choose(0),true);await top();
        await scrollDown();assert.equal(await choose(0),false);await top();
        assert.deepEqual(await evaluate("[...document.querySelectorAll('.inessa-collection-grid .net-product-card')].map(a=>a.getAttribute('href'))"),original,'Deselect restores the unfiltered list');
        if(width===1440){
          for(let field=1;field<11;field++){
            await scrollDown();assert.equal(await choose(field),true);await top();
            await evaluate("document.querySelector('.inessa-filter-reset').click()");await top();
          }
          for(const label of ['Giá tối thiểu (VNĐ)','Giá tối đa (VNĐ)','Mức giá tối thiểu','Mức giá tối đa']){
            await scrollDown();const selector=`input[aria-label="${label}"]`,value=label.includes('tối thiểu')?'100000':'5000000';await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus({preventScroll:true})`);await input(selector,value);await top();assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`),true,'Price controls retain focus');
            await evaluate("document.querySelector('.inessa-filter-reset').click()");await top();
          }
          const before=await scrollDown();await input('input[aria-label="Tìm thương hiệu"]','Dior');await pause(350);assert.ok(Math.abs(await evaluate('window.scrollY')-before)<1,'Searching filter options does not reset page scroll');await input('input[aria-label="Tìm thương hiệu"]','');
          await evaluate("document.querySelector('button[aria-label=\"Cập nhật bộ lọc\"]').click()");await pause(500);assert.ok(Math.abs(await evaluate('window.scrollY')-before)<1,'Refreshing available options does not reset page scroll');
          await scrollDown();await choose(0,0);await choose(0,1);await top();assert.equal(await evaluate("document.querySelectorAll('.inessa-filter-facet:first-child input:checked').length"),2,'Rapid selections retain both choices');
          await scrollDown();await evaluate("document.querySelector('.inessa-filter-reset').click()");await top();
          await evaluate("document.querySelector('.inessa-collection-page-arrows [aria-label=\"Trang sau\"]').click()");await wait(ready+"&&document.querySelector('.inessa-collection-pagination [aria-current=page]')?.textContent==='2'");await wait("Math.abs(document.querySelector('.inessa-collection-grid').getBoundingClientRect().top-100)<3");
          await scrollDown();await choose(0);await top();await evaluate("document.querySelector('.inessa-filter-reset').click()");await top();
          await evaluate("document.querySelector('.inessa-collection-search-toggle').click()");await scrollDown();await input('input[aria-label="Tìm kiếm sản phẩm"]','zzzz-no-such-perfume-qa');await top();assert.equal(await evaluate("document.activeElement===document.querySelector('input[aria-label=\"Tìm kiếm sản phẩm\"]')"),true,'Search retains focus');assert.ok(await evaluate("Boolean(document.querySelector('.inessa-collection-empty'))"),'Empty results still scroll to list');await evaluate("document.querySelector('.inessa-collection-reset').click()");await top();
          await scrollDown();await evaluate("(()=>{const select=document.querySelector('select[aria-label=\"Sắp xếp sản phẩm\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'low');select.dispatchEvent(new Event('change',{bubbles:true}));})()");await top();
        }
        await screenshot('collection-filter-scroll-'+width);
      }else{
        await scrollDown();await evaluate("document.querySelector('.inessa-collection-filter-trigger').click()");await wait("document.querySelector('#collection-filter-drawer[open] input[type=checkbox]')");
        await choose(0,0);await settled();await choose(0,2);await settled();
        assert.equal(await evaluate("document.querySelectorAll('.inessa-filter-facet:first-child input:checked').length"),2);
        // Native scroll anchoring can move the obscured results as cards change.
        // The visible drawer must stay open, retain both choices and keep focus.
        assert.equal(await evaluate("document.querySelector('#collection-filter-drawer[open]').contains(document.activeElement)"),true,'Mobile multi-select keeps focus inside the open filter drawer');
        await screenshot('collection-filter-open-'+width);
        await evaluate("document.querySelector('.inessa-filter-view-results').click()");await wait("!document.querySelector('#collection-filter-drawer')");await top();
        await scrollDown();await evaluate("document.querySelector('.inessa-collection-filter-trigger').click()");await wait("document.querySelector('#collection-filter-drawer[open]')");
        await input('input[aria-label="Giá tối thiểu (VNĐ)"]','100000');await settled();await evaluate("document.querySelector('button[aria-label=\"Đóng bộ lọc\"]').click()");await top();
        await scrollDown();await evaluate("document.querySelector('.inessa-collection-filter-trigger').click()");await wait("document.querySelector('#collection-filter-drawer[open]')");await evaluate("document.querySelector('.inessa-filter-reset').click()");await settled();
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await top();
        await screenshot('collection-filter-scroll-'+width);
        const unchanged=await scrollDown();await evaluate("document.querySelector('.inessa-collection-filter-trigger').click()");await wait("document.querySelector('#collection-filter-drawer[open]')");await evaluate("document.querySelector('button[aria-label=\"Đóng bộ lọc\"]').click()");await pause(350);assert.ok(Math.abs(await evaluate('window.scrollY')-unchanged)<1,'Closing unchanged mobile filters keeps the reading position');
      }
    }
    checks.push('Filter scroll regression at 1440/1024/768/390/320px: all 11 checkbox facets, selecting/deselecting, price inputs/ranges, clear filters, rapid choices, empty search and sorting use the same CSS list scroll offset as pagination after results settle; preserve input focus for continued editing; window stays below the page banner; works from page 1 and page 2; pager retains its list focus and scroll; mobile multi-select remains open and scrolls only on view results/close/Escape; unchanged drawer and option search/refresh preserve reading position; real catalog reads and zero database writes');
  }else if(libraryPresentationQA){
    const terms=await FragranceTerm.find({kind:{$in:["group","accord","note"]}}).select("kind key name slug description descriptionContent contentImport").lean();
    const entries=terms.filter(term=>reviseLibraryPresentation(term).sections||term.descriptionContent?.content?.some(node=>node.type==="libraryCards"&&node.attrs.items.every(item=>item.href.startsWith("/collection?category="))));
    assert.equal(entries.length,31);
    for(const term of terms){const revised=reviseLibraryPresentation(term);if(!presentationPreview)assert.equal(revised.changed,false,"Stored article needs no further cleanup");assert.equal(/apa\s*niche/iu.test(articleToPlainText(revised.descriptionContent||term.descriptionContent)),false);}
    const examples=[...entries,terms.find(term=>term.kind==='accord'&&term.name==='Mật Ong'),terms.find(term=>term.kind==='note'&&term.name==='Hoa Mẫu Đơn')];assert.ok(examples.every(Boolean));
    for(const term of terms){
      const view=knowledgePresentation(term),input=sanitizeArticle(term.descriptionContent,LIBRARY_ARTICLE_LIMITS);
      const hidden=new Set(view.removedNavigation.map(node=>JSON.stringify(node))),visible=input.content.filter(node=>!hidden.has(JSON.stringify(node)));
      assert.deepEqual([view.hero,...(view.mergedHeading?[visible[1]]:[]),...view.openingSource,...view.body.content].filter(Boolean),visible,'Only the requested navigation blocks and merged lead title are omitted');
      assert.equal(view.body.content.some(node=>node.type==='libraryCards'&&node.attrs.items.every(item=>item.href.startsWith('/collection?category='))),false);
    }
    for(const width of [1440,390,320]){
      await send("Emulation.setDeviceMetricsOverride",{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      for(const entry of width===1440?examples:examples.filter(row=>row.kind!=='group'||row.name==="Cam Chanh (Citrus)")){
        await goto(libraryPath(entry),"document.querySelector('.knowledge-article .product-article')&&document.querySelector('.knowledge-related-heading')");
        const leaked=await evaluate("document.body.innerText.match(/.{0,80}apa\\s*niche.{0,80}/giu)||[]");
        assert.deepEqual(leaked,[],JSON.stringify({entry:entry.name,leaked}));
        assert.equal(await evaluate("document.querySelectorAll('.article-library-category,.article-library-cards--categories,.knowledge-reference').length"),0,'Removed navigation cards and source link are absent');
        assert.equal(await evaluate("document.querySelector('.knowledge-article').innerText.includes('Khám phá nước hoa theo giới tính')"),false);
        await assertKnowledgeProductCards();
        await noOverflow();assert.equal(await evaluate("getComputedStyle(document.querySelector('.knowledge-detail-page')).maxWidth"),"1500px");
        if(entry.name==="Cam Chanh (Citrus)"){
          await evaluate("document.querySelector('.knowledge-related-heading').scrollIntoView({block:'center',behavior:'instant'})");await pause(250);await screenshot("library-without-category-navigation-"+width);
        }
      }
    }
    const honey=terms.find(row=>row.kind==="accord"&&row.name==="Mật Ong");await goto(libraryPath(honey),"document.querySelector('.knowledge-article .product-article')");
    assert.equal(await evaluate("/apa\\s*niche/iu.test(document.querySelector('.knowledge-article').innerText)"),false);
    assert.equal(await evaluate("document.querySelector('.knowledge-article').innerText.includes('Jean Paul Gaultier Scandal')"),true);
    checks.push(`Gender-navigation headings and cards removed from all 31 affected articles; source-reference link absent on group/accord/note pages; ${terms.length} stored articles audited to preserve all remaining content, hero images and product recommendations; 39 browser views at 1440/390/320px preserve wide page bounds and 5/2-column product grids without overflow; stored articles and provenance unchanged, zero database writes`);
  }else if(knowledgeRelatedCardsQA){
    const examples=[];
    for(const [kind,name] of [['group','Cam Chanh (Citrus)'],['accord','Trầm Hương'],['note','Hoa Mẫu Đơn']]){
      const term=await FragranceTerm.findOne({kind,name}).select('kind key slug name').lean();assert.ok(term,kind+': '+name);
      const response=await call(publicLibraryTerm,{params:{kind,slug:libraryPath(term).split('/').pop()},query:{page:'1'}});assert.equal(response.body.success,true);assert.ok(response.body.total>15);
      examples.push({term,data:response.body});
    }
    let checked=0;
    for(const width of [1920,1440,1024,768,390,320]){
      console.log(JSON.stringify({phase:'knowledge-related-cards',width}));
      await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<500});
      for(const {term,data} of examples){
        await goto(libraryPath(term),"document.querySelectorAll('.knowledge-product-grid .net-product-card').length===15");
        await evaluate("document.querySelector('.knowledge-related-heading').scrollIntoView({block:'start',behavior:'instant'})");
        const cards=await assertKnowledgeProductCards();checked+=cards.length;
        assert.deepEqual(cards.map(card=>card.href),data.products.map(product=>'/collection/'+product._id),'Product links and order are unchanged');
        const rows=Map.groupBy(cards,card=>Math.round(card.top));assert.equal([...rows.values()][0].length,width>=1440?5:width===1024?4:width===768?3:2);
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.knowledge-detail-page')).maxWidth"),'1500px');await noOverflow();
        await wait(`[...document.querySelectorAll('.knowledge-product-grid img')].slice(0,${[...rows.values()][0].length}).every(image=>image.complete&&image.naturalWidth>0)`);
        await screenshot('knowledge-related-'+term.kind+'-'+width);
        if(width===1440){
          await selectPage('[aria-label="Phân trang sản phẩm liên quan"]','.knowledge-related-heading',2);
          await wait(`document.querySelector('.knowledge-product-grid .net-product-card')?.getAttribute('href')!==${JSON.stringify(cards[0].href)}`);checked+=(await assertKnowledgeProductCards()).length;await noOverflow();
        }
      }
    }
    checks.push(`Related products on group/accord/note detail pages: ${checked} card placements at 1920/1440/1024/768/390/320px; 5/4/3/2 equal-width columns filling the page, incomplete rows left-aligned to the same columns, compact cards with equal heights and aligned prices; original product links, order, ID-based colors, 15-item pagination and wide page container preserved; zero database writes`);
  }else if(noteCoverQA){
    const notes=await FragranceTerm.find({kind:'note'}).select('kind key name descriptionContent').lean();
    const banners=notes.filter(term=>knowledgePresentation(term).layout==='banner');assert.ok(banners.length);
    const examples=[...new Set([banners.find(term=>term.name==='Bưởi'),banners.find(term=>term.name==='Hoa Mẫu Đơn'),[...banners].sort((a,b)=>b.name.length-a.name.length)[0]])];assert.ok(examples.every(Boolean));
    let views=0;
    for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[390,844],[320,740]]){
      console.log(JSON.stringify({phase:'note-cover',width,height}));
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
      for(const term of examples){
        const view=knowledgePresentation({...term,englishName:libraryEnglishName(term)});
        await goto(libraryPath(term),"document.querySelector('.knowledge-detail-page--note .knowledge-hero-image')&&document.querySelector('.knowledge-article > .product-article')");
        await wait("document.querySelector('.knowledge-hero img').complete&&document.querySelector('.knowledge-hero img').naturalWidth>0");await evaluate('scrollTo({top:0,behavior:"instant"})');
        const layout=await evaluate("(()=>{const image=document.querySelector('.knowledge-hero-image').getBoundingClientRect(),article=document.querySelector('.knowledge-article').getBoundingClientRect(),body=document.querySelector('.knowledge-article > .product-article'),paragraphs=[...body.querySelectorAll('p')];return {image:{top:image.top,bottom:image.bottom,height:image.height,width:image.width},articleWidth:article.width,bodyTop:body.getBoundingClientRect().top,introBottom:paragraphs.at(-1).getBoundingClientRect().bottom,href:document.querySelector('.knowledge-hero-image').getAttribute('href'),fit:getComputedStyle(document.querySelector('.knowledge-hero img')).objectFit}})()");
        const expected=width<=700?Math.min(170,Math.max(130,height*.19)):Math.min(300,Math.max(200,height*.3));
        assert.ok(Math.abs(layout.image.height-expected)<1&&Math.abs(layout.image.width-layout.articleWidth)<1,'Note banner stays wide with viewport-aware compact height');
        assert.equal(layout.href,view.hero.attrs.src);assert.equal(layout.fit,'cover');assert.ok(layout.bodyTop-layout.image.bottom<=21,'Intro follows the cover without the old large gap');
        if(term.name==='Bưởi'&&width>=1024)assert.ok(layout.introBottom<=height-16,JSON.stringify({width,height,layout}));
        await noOverflow();await assertKnowledgeProductCards();
        if(term.name==='Bưởi')await screenshot('note-grapefruit-compact-'+width+'-'+height);
        views++;
      }
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    for(const [kind,name] of [['group','Cam Chanh (Citrus)'],['accord','Biển']]){
      const term=await FragranceTerm.findOne({kind,name}).select('kind key name').lean();assert.ok(term);await goto(libraryPath(term),"document.querySelector('.knowledge-hero-image')");
      const box=await evaluate("(()=>{const r=document.querySelector('.knowledge-hero-image').getBoundingClientRect();return {width:r.width,height:r.height}})()");
      assert.ok(kind==='group'?Math.abs(box.width/box.height-3.4)<.02:box.width>400&&box.width<470&&Math.abs(box.width-box.height)<1,'Group banner and balanced accord cover retain their layouts');
    }
    checks.push(`Balanced covers across ${banners.length} note banners: ${views} browser views at 1920x1080/1440x900/1366x768/1024x768/390x844/320x740; 200-300px desktop and 130-170px mobile height, full article width, original full-image links and text retained; Grapefruit introduction fits entirely in the first desktop viewport; group/accord layouts and product grids preserved, no overflow, zero database writes`);
  }else if(accordOpeningQA){
    const terms=await FragranceTerm.find({kind:'accord'}).select('kind key name description descriptionContent').lean();assert.equal(terms.length,68);
    const normalize=value=>value.replace(/\s+/gu,' ').trim();
    let fields=0;
    for(const term of terms){
      const original=JSON.stringify(term),view=knowledgePresentation({...term,englishName:libraryEnglishName(term)});
      assert.equal(view.layout,'accord');assert.equal(view.facts.length,1,term.name);
      const before=articleToPlainText({type:'doc',content:view.openingSource});
      const after=[articleToPlainText(view.intro),...view.facts.flatMap(section=>[section.title,...section.fields.flatMap(field=>[field.label,articleToPlainText(field.content)])])].join(' ');
      assert.equal(normalize(after),normalize(before),'Every word from the original intro and facts remains');assert.equal(JSON.stringify(term),original,'Stored source is unchanged');
      fields+=view.facts[0].fields.length;
    }
    const examples=['Biển','Rượu Whisky','Động Vật','Vani'].map(name=>terms.find(term=>term.name===name));assert.ok(examples.every(Boolean));
    let views=0;
    for(const width of [1920,1440,1024,900,768,390,320]){
      console.log(JSON.stringify({phase:'accord-opening',width,articles:width===1440?terms.length:examples.length}));
      await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<500});
      for(const term of width===1440?terms:examples){
        const view=knowledgePresentation({...term,englishName:libraryEnglishName(term)});
        await goto(libraryPath(term),"document.querySelector('.knowledge-opening--accord')&&document.querySelector('.knowledge-accord-facts')&&document.querySelector('.knowledge-product-grid')");
        assert.equal(normalize(await evaluate("document.querySelector('.knowledge-opening-copy > .product-article').innerText")),normalize(articleToPlainText(view.intro)));
        assert.equal(await evaluate("document.querySelector('.knowledge-opening-copy > .product-article').innerText.includes('Dữ liệu mùi hương')"),false,'Introductory paragraphs stay separate from the fact list');
        const actual=await evaluate("[...document.querySelectorAll('.knowledge-accord-facts > ul > li')].map(row=>row.innerText)");
        assert.deepEqual(actual.map(normalize),view.facts[0].fields.map(field=>normalize(field.label+' '+articleToPlainText(field.content))));
        assert.equal(await evaluate("(()=>{const section=document.querySelector('.knowledge-accord-facts'),list=section.querySelector('ul'),items=[...list.children];return document.querySelector('.knowledge-opening-copy').contains(section)&&getComputedStyle(list).listStyleType==='disc'&&getComputedStyle(section).borderTopWidth==='0px'&&items.every((item,index)=>!index||item.getBoundingClientRect().top>items[index-1].getBoundingClientRect().bottom)})()"),true,'Facts form individual bullet points directly under the intro, without a separate framed panel');
        const boxes=await evaluate("(()=>{const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {image:box('.knowledge-hero-image'),copy:box('.knowledge-opening-copy'),opening:box('.knowledge-opening--accord'),facts:box('.knowledge-accord-facts'),page:box('.knowledge-article'),related:getComputedStyle(document.querySelector('.knowledge-product-grid')).gridTemplateColumns.split(' ').length}})()");
        assert.ok(Math.abs(boxes.image.width-boxes.image.height)<1,'Square covers retain their full proportions');
        if(width>900){
          assert.ok(boxes.image.width>=280&&boxes.image.width<=470&&boxes.image.width/boxes.opening.width>.31&&boxes.image.width/boxes.opening.width<.35,'Desktop cover fills about one third of the opening');
          assert.ok(boxes.copy.left>boxes.image.right&&Math.abs((boxes.copy.top+boxes.copy.bottom-boxes.image.top-boxes.image.bottom)/2)<1,'Desktop image and copy are vertically balanced');
        }else{
          assert.ok(Math.abs(boxes.image.width-Math.min(width<=700?300:360,boxes.opening.width))<1,'Larger tablet/mobile covers fit the screen');
          assert.ok(boxes.copy.top>boxes.image.bottom&&Math.abs((boxes.image.left+boxes.image.right-boxes.opening.left-boxes.opening.right)/2)<1,'Small screens stack the centered cover above full-width text');
        }
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.knowledge-hero img')).objectFit"),'contain','Show every part of the source image');
        assert.equal(await evaluate("document.querySelector('.knowledge-hero-image').getAttribute('href')"),view.hero.attrs.src,'Full-image link is preserved');
        assert.ok(Math.abs(boxes.facts.left-boxes.copy.left)<1&&Math.abs(boxes.facts.right-boxes.copy.right)<1,'The bullet list aligns with the introductory text column');
        assert.equal(boxes.related,width>=1440?5:width>=1024?4:width>=768?3:2);await assertKnowledgeProductCards();await noOverflow();
        assert.equal(await evaluate("document.querySelectorAll('.article-library-category,.knowledge-reference').length"),0);
        if(term.name==='Biển'){
          await wait("document.querySelector('.knowledge-hero img').complete&&document.querySelector('.knowledge-hero img').naturalWidth>0");
          await evaluate('scrollTo({top:0,behavior:"instant"})');await screenshot('accord-opening-marine-'+width);
          await evaluate("document.querySelector('.knowledge-accord-facts').scrollIntoView({block:'center',behavior:'instant'})");await screenshot('accord-facts-marine-'+width);
        }
        views++;
      }
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    for(const [kind,name] of [['group','Cam Chanh (Citrus)'],['note','Bưởi']]){
      const term=await FragranceTerm.findOne({kind,name}).select('kind key name').lean();assert.ok(term);await goto(libraryPath(term),"document.querySelector('.knowledge-opening--banner .knowledge-hero-image')");
      assert.equal(await evaluate("(()=>{const image=document.querySelector('.knowledge-hero-image').getBoundingClientRect(),article=document.querySelector('.knowledge-article').getBoundingClientRect();return Math.abs(image.width-article.width)<1})()"),true,'Group/note banners keep their full article width');await noOverflow();
    }
    checks.push(`All ${terms.length} accord articles retain ${fields} original bullet fields; ${views} views at 1920/1440/1024/900/768/390/320px show proportional, vertically centered desktop covers and larger centered tablet/mobile images without cropping; source text and full-image links, product grids, and group/note banner layouts preserved; zero database writes`);
  }else if(knowledgeOpeningQA){
    const terms=await FragranceTerm.find({kind:{$in:['group','accord','note']}}).select('kind key slug name description descriptionContent').lean();
    let merged=0;
    for(const term of terms){
      const input=sanitizeArticle(term.descriptionContent,LIBRARY_ARTICLE_LIMITS),before=JSON.stringify(term),view=knowledgePresentation({...term,englishName:libraryEnglishName(term)});
      const hidden=new Set(view.removedNavigation.map(node=>JSON.stringify(node))),visible=input.content.filter(node=>!hidden.has(JSON.stringify(node)));
      assert.deepEqual([view.hero,...(view.mergedHeading?[visible[1]]:[]),...view.openingSource,...view.body.content].filter(Boolean),visible,term.name);
      assert.equal(JSON.stringify(term),before);assert.equal(view.mergedHeading,true,term.name);merged++;
    }
    const examples=[terms.find(term=>term.kind==='group'&&term.name==='Cam Chanh Ngọt Ngào (Citrus Gourmand)'),terms.find(term=>term.kind==='accord'&&term.name==='Mật Ong'),terms.find(term=>term.kind==='note'&&term.name==='Hoa Mẫu Đơn'),terms.find(term=>term.kind==='accord'&&term.name==='Coca Cola'),terms.find(term=>term.kind==='note'&&term.name==='Đinh hương'),terms.find(term=>term.kind==='note'&&term.name==='Bưởi'),terms.find(term=>term.kind==='accord'&&term.name==='Biển'),terms.filter(term=>term.kind==='note').sort((a,b)=>b.name.length-a.name.length)[0]];
    assert.ok(examples.every(Boolean));let pagesChecked=0;
    console.log(JSON.stringify({phase:'knowledge-opening',articles:terms.length,merged,examples:examples.length}));
    for(const width of [1440,1024,768,390,320]){
      console.log(JSON.stringify({phase:'knowledge-opening-viewport',width}));
      await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<500});
      for(const term of examples){
        const view=knowledgePresentation({...term,englishName:libraryEnglishName(term)});
        await goto(libraryPath(term),"document.querySelector('.knowledge-hero img')&&document.querySelector('.knowledge-heading h1')");
        assert.equal(await evaluate("document.querySelectorAll('h1').length"),1);
        assert.equal(await evaluate("document.querySelector('.knowledge-heading h1').textContent"),view.label);
        assert.equal(await evaluate("document.querySelector('.knowledge-heading h1 [lang=en]')?.textContent||''"),view.secondaryTitle?`(${view.secondaryTitle})`:'');
        if(term.name==='Bưởi'||term.name==='Biển')assert.equal(await evaluate("(()=>{const h=document.querySelector('.knowledge-heading h1');return h.getBoundingClientRect().height<=parseFloat(getComputedStyle(h).lineHeight)+1})()"),true,'Short bilingual titles fit on one line');
        assert.equal(await evaluate("document.querySelector('.store-page-breadcrumb [aria-current=page]').textContent"),view.label);
        assert.deepEqual(await evaluate("[...document.querySelectorAll('.store-page-breadcrumb a')].map(link=>link.getAttribute('href'))"),['/',`/knowledge/${term.kind}`]);
        assert.equal(await evaluate("document.querySelector('.knowledge-hero-image').getAttribute('href')"),view.hero.attrs.src);
        assert.equal(await evaluate("document.querySelector('.knowledge-hero-image').target"),'_blank');
        assert.equal(await evaluate(`[...document.querySelectorAll('.knowledge-article :is(h2,h3)')].some(heading=>${JSON.stringify([view.title,view.secondaryTitle].filter(Boolean))}.includes(heading.textContent.trim()))`),false,'A translated leading heading is not repeated below the hero');
        const boxes=await evaluate("(()=>{const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {hero:box('.knowledge-hero-image'),article:box('.knowledge-article'),copy:document.querySelector('.knowledge-opening-copy')?box('.knowledge-opening-copy'):null,titleSize:parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),bodySize:parseFloat(getComputedStyle(document.querySelector('.knowledge-article .product-article')).fontSize)}})()");
        assert.ok(boxes.titleSize>boxes.bodySize*1.6,'Main title has a distinct hierarchy');
        if(view.layout==='banner'){
          assert.ok(Math.abs(boxes.hero.width-boxes.article.width)<1);
          if(term.kind==='note')assert.ok(Math.abs(boxes.hero.height-(width<=700?170:300))<1);
          else assert.ok(Math.abs(boxes.hero.width/boxes.hero.height-(width<=700?2.3:3.4))<.02);
        }else if(view.layout==='accord'){
          assert.ok(Math.abs(boxes.hero.width-boxes.hero.height)<1);
          assert.ok(width>900?boxes.hero.width/boxes.article.width>.31&&boxes.hero.width/boxes.article.width<.35:Math.abs(boxes.hero.width-Math.min(width<=700?300:360,boxes.article.width))<1);
          assert.ok(width>900?boxes.copy.left>boxes.hero.right:boxes.copy.top>=boxes.hero.bottom);
        }else{
          assert.ok(Math.abs(boxes.hero.width-boxes.hero.height)<1);
          assert.ok(width>900?boxes.hero.width/boxes.article.width>.31&&boxes.hero.width/boxes.article.width<.35:Math.abs(boxes.hero.width-Math.min(width<=700?300:360,boxes.article.width))<1);
          assert.ok(width>900?boxes.copy.left>boxes.hero.right:boxes.copy.top>=boxes.hero.bottom);
          const normalize=value=>value.replace(/\s+/gu,' ').trim();
          assert.equal(normalize(await evaluate("document.querySelector('.knowledge-opening-copy .product-article').innerText")),normalize(articleToPlainText(view.intro)));
        }
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.knowledge-detail-page')).maxWidth"),'1500px');
        await assertKnowledgeProductCards();
        assert.equal(await evaluate("[...document.querySelectorAll('.article-library-product .net-product-card')].every(card=>card.getBoundingClientRect().width<=260.5)"),true,'Compact editorial product cards are preserved');
        await noOverflow();await wait("document.querySelector('.knowledge-hero img').complete&&document.querySelector('.knowledge-hero img').naturalWidth>0");
        await evaluate('scrollTo({top:0,behavior:"instant"})');await screenshot('knowledge-opening-'+libraryPath(term).split('/').pop()+'-'+width);pagesChecked++;
      }
    }
    checks.push(`Compact combined bilingual headings across all ${terms.length} articles: one H1 in Vietnamese (English) format without forced line breaks or duplicate aliases; ${pagesChecked} browser views at 1440/1024/768/390/320px cover all three kinds, Grapefruit, Marine, identical aliases, missing English metadata and natural long-title wrapping; every remaining source node/image, breadcrumbs, current hero sizes and product grids preserved; zero database writes`);
  }else if(knowledgeProductCardsQA){
    const hasProducts=node=>node.type==='libraryCards'&&node.attrs.items.length&&node.attrs.items.every(item=>/^\/collection\/[a-f0-9]{24}$/u.test(item.href));
    const terms=await FragranceTerm.find({kind:{$in:['group','accord','note']},'descriptionContent.content.attrs.items.href':/^\/collection\/[a-f0-9]{24}$/u}).select('kind key slug name descriptionContent').lean();
    const entries=terms.filter(term=>term.descriptionContent?.content?.some(hasProducts)).sort((a,b)=>Number(b.name==='Cam Chanh Ngọt Ngào (Citrus Gourmand)')-Number(a.name==='Cam Chanh Ngọt Ngào (Citrus Gourmand)'));assert.ok(entries.length);
    const examples=[...new Set([2,3,4,5].map(count=>entries.find(entry=>entry.descriptionContent.content.some(node=>hasProducts(node)&&node.attrs.items.length===count))).filter(Boolean))];
    let cardsChecked=0;
    console.log(JSON.stringify({phase:'article-product-cards',articles:entries.length}));
    for(const width of [1440,1024,768,390,320]){
      console.log(JSON.stringify({phase:'article-product-viewport',width}));
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      for(const entry of width===1440?entries:examples){
        await goto(libraryPath(entry),"document.querySelector('.article-library-cards--products')");
        await evaluate("document.querySelector('.article-library-cards--products').scrollIntoView({block:'center',behavior:'instant'})");
        await wait("![...document.querySelectorAll('.article-library-product .net-product-price')].some(price=>price.getAttribute('aria-busy')==='true')");
        const expected=entry.descriptionContent.content.filter(hasProducts).flatMap(node=>node.attrs.items);
        const grids=await evaluate("[...document.querySelectorAll('.article-library-cards--products')].map(grid=>{const g=grid.getBoundingClientRect(),style=getComputedStyle(grid);return {left:g.left,right:g.right,columns:style.gridTemplateColumns.split(' ').length,gap:parseFloat(style.columnGap),cards:[...grid.querySelectorAll('.article-library-product')].map(item=>{const card=item.querySelector('.net-product-card'),media=card.querySelector('.net-product-media'),price=card.querySelector('.net-product-price'),r=card.getBoundingClientRect(),m=media.getBoundingClientRect(),p=price.getBoundingClientRect();return {href:card.getAttribute('href'),left:r.left,right:r.right,top:r.top,width:r.width,height:r.height,mediaWidth:m.width,mediaHeight:m.height,priceTop:p.top,priceHeight:p.height,color:getComputedStyle(media).backgroundColor,description:item.querySelector(':scope > p')?.textContent||''}})}})");
        const cards=grids.flatMap(grid=>grid.cards);assert.equal(cards.length,expected.length);
        for(let index=0;index<cards.length;index++){
          const card=cards[index],source=expected[index],id=source.href.split('/').pop();
          assert.equal(card.href,source.href);assert.equal(card.description,source.description||'');
          assert.ok(card.width<=260.5&&card.height<430&&Math.abs(card.mediaWidth-card.mediaHeight)<1,JSON.stringify({width,entry:entry.name,card}));
          assert.equal(card.color,['rgb(242, 242, 242)','rgb(246, 249, 246)','rgb(246, 248, 254)'][parseInt(id.slice(-4),16)%3],'Product ID still controls frame color');cardsChecked++;
        }
        for(const grid of grids){
          const rows=Map.groupBy(grid.cards,card=>Math.round(card.top));
          for(const row of rows.values()){
            assert.ok(Math.abs(row[0].left-grid.left)<1,'Every embedded product row starts at the left edge');
            for(let i=0;i<row.length;i++)assert.ok(Math.abs(row[i].left-grid.cards[i].left)<1&&Math.abs(row[i].width-(grid.right-grid.left-grid.gap*(grid.columns-1))/grid.columns)<1,'Embedded products share equal aligned columns');
            if(row.length===grid.columns)assert.ok(Math.abs(row.at(-1).right-grid.right)<1,'Full embedded rows fill the available width');
            assert.ok(Math.max(...row.map(card=>card.priceTop))-Math.min(...row.map(card=>card.priceTop))<1,'Prices align within a row');
            assert.ok(Math.max(...row.map(card=>card.height))-Math.min(...row.map(card=>card.height))<1,'Cards have equal height');
          }
          if(width===1440&&grid.cards.length===5)assert.deepEqual([...rows.values()].map(row=>row.length),[5]);
          assert.equal(grid.columns,width>=1440?5:width===1024?4:width===768?3:2);
          if(width<500)assert.ok([...rows.values()].every(row=>row.length<=2));
        }
        await noOverflow();assert.equal(await evaluate("getComputedStyle(document.querySelector('.knowledge-detail-page')).maxWidth"),'1500px');
        await assertKnowledgeProductCards();
        if(entry.name==='Cam Chanh Ngọt Ngào (Citrus Gourmand)'){
          await wait("[...document.querySelectorAll('.article-library-product img')].every(image=>image.complete&&image.naturalWidth>0)");
          await screenshot('knowledge-product-cards-'+width);
        }
      }
    }
    checks.push(`Embedded product cards across ${entries.length} articles (${cardsChecked} placements at 1440/1024/768/390/320px): 5/4/3/2 equal-width columns, five products on one desktop row, incomplete rows left-aligned, equal card heights and aligned prices; original product links, descriptions, ID-based colors, shared wide layout and bottom product columns preserved; zero database writes`);
  }else if(knowledgeGroupCardsQA){
    const hasGroupCards=node=>node.type==="libraryCards"&&node.attrs.items.length&&node.attrs.items.every(item=>item.href.startsWith("/knowledge/group/"));
    const terms=await FragranceTerm.find({kind:{$in:["group","accord","note"]},"descriptionContent.content.attrs.items.href":/^\/knowledge\/group\//}).select("kind key slug name descriptionContent").lean();
    const entries=terms.filter(term=>term.descriptionContent?.content?.some(hasGroupCards)&&(!process.argv.includes('--group-cards-screenshots-only')||term.name==="Cam Chanh Ngọt Ngào (Citrus Gourmand)"));
    assert.ok(entries.length);
    console.log(JSON.stringify({phase:'group-card-checks',articles:entries.length}));
    const examples=[entries.find(entry=>entry.name==="Cam Chanh Ngọt Ngào (Citrus Gourmand)"),...['accord','note'].map(kind=>entries.find(entry=>entry.kind===kind))].filter(Boolean);
    assert.ok(examples.length);
    let cardsChecked=0;
    for(const width of [1440,768,390,320]){
      console.log(JSON.stringify({phase:'group-card-viewport',width}));
      await send("Emulation.setDeviceMetricsOverride",{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      for(const entry of width===1440?entries:examples){
        await goto(libraryPath(entry),"document.querySelector('.article-library-cards--groups')");
        const expected=entry.descriptionContent.content.filter(hasGroupCards).flatMap(node=>node.attrs.items);
        const cards=await evaluate("[...document.querySelectorAll('.article-library-cards--groups .knowledge-card')].map(card=>{const frame=card.querySelector('.knowledge-card-image').getBoundingClientRect(),box=card.getBoundingClientRect(),name=card.querySelector('strong'),english=card.querySelector('small');return {href:card.getAttribute('href'),name:name.textContent,english:english?.textContent||'',imageWidth:frame.width,imageHeight:frame.height,cardWidth:box.width,fontSize:getComputedStyle(name).fontSize,englishFont:english?getComputedStyle(english).fontSize:null,radius:getComputedStyle(card).borderRadius}})");
        assert.equal(cards.length,expected.length);
        for(let index=0;index<cards.length;index++){
          const card=cards[index],source=expected[index];
          assert.equal(card.href,source.href);assert.equal(card.name,source.name);assert.equal(card.english,source.englishName||'');
          assert.ok(card.imageWidth>230&&Math.abs(card.imageWidth/card.imageHeight-3.88)<.02&&Math.abs(card.cardWidth-card.imageWidth-26)<1,JSON.stringify({width,entry:entry.name,card}));
          assert.equal(card.fontSize,'16px');if(card.englishFont)assert.equal(card.englishFont,'13px');assert.equal(card.radius,'14px');cardsChecked++;
        }
        const columns=await evaluate("[...document.querySelectorAll('.article-library-cards--groups')].map(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length)");
        assert.ok(columns.every(count=>count===(width===1440?3:width===768?2:1)));
        await noOverflow();assert.equal(await evaluate("getComputedStyle(document.querySelector('.knowledge-detail-page')).maxWidth"),'1500px');
        await assertKnowledgeProductCards();
        assert.equal(await evaluate("[...document.querySelectorAll('.article-library-cards--terms:not(.article-library-cards--groups) .knowledge-card-image')].every(image=>image.getBoundingClientRect().width<=(innerWidth>600?112:96)+1)"),true,'Note and accord thumbnail sizes are preserved');
        if(examples.includes(entry)){
          await evaluate("document.querySelector('.article-library-cards--groups').scrollIntoView({block:'center',behavior:'instant'})");await pause(300);
          await wait("[...document.querySelectorAll('.article-library-cards--groups img')].every(image=>image.complete&&image.naturalWidth>0)");
          await screenshot('knowledge-group-cards-'+entry.kind+'-'+width);
        }
      }
    }
    checks.push(`Larger full-width landscape group banners and 16px/13px labels across ${entries.length} articles (${cardsChecked} cards checked); responsive 3/2/1 columns at 1440/768/390/320px, original internal links and labels, rounded frames and hover zoom; note thumbnails, wide article layout and related-product columns preserved; zero database writes`);
  }else if(knowledgeIconsQA){
    const labels=["Xuân","Hạ","Hè","Thu","Đông"];
    const entries=await FragranceTerm.find({kind:{$in:["group","accord","note"]},"descriptionContent.content.attrs.alt":{$in:labels},...(process.argv.includes("--icons-screenshots-only")?{name:"Cam Chanh (Citrus)"}:{})}).select("kind key slug name descriptionContent").lean();
    assert.ok(entries.length);
    let iconsChecked=0;
    for(const width of [1440,390,320]){
      await send("Emulation.setDeviceMetricsOverride",{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      for(const entry of entries){
        const expected=entry.descriptionContent.content.filter(node=>node.type==="image"&&labels.includes(node.attrs.alt)).length;
        await goto(libraryPath(entry),"document.querySelector('.knowledge-article .product-article')");
        const icons=await evaluate("[...document.querySelectorAll('.article-season-item')].map(item=>{const img=item.querySelector('img'),label=item.querySelector('.article-season-label'),box=img.getBoundingClientRect(),text=label.getBoundingClientRect(),card=item.getBoundingClientRect();return {label:label.innerText.trim(),width:box.width,height:box.height,top:card.top,left:card.left,cardHeight:card.height,aligned:Math.abs((box.top+box.height/2)-(text.top+text.height/2))<1,imageBeforeText:box.right<=text.left}})");
        assert.equal(icons.length,expected);
        assert.deepEqual(icons.map(icon=>icon.label),entry.descriptionContent.content.filter(node=>node.type==="image"&&labels.includes(node.attrs.alt)).map(node=>`Mùa ${node.attrs.alt==="Hạ"?"Hè":node.attrs.alt}`));
        for(const icon of icons){const limit=width>600?40:32;assert.ok(Math.abs(icon.width-limit)<1&&Math.abs(icon.height-limit)<1&&icon.cardHeight<=80&&icon.aligned&&icon.imageBeforeText,JSON.stringify({entry:entry.name,width,icon}));iconsChecked++;}
        assert.equal(new Set(icons.map(icon=>Math.round(icon.top))).size,width>600?1:Math.ceil(expected/2),"Seasons share one desktop row and at most two mobile columns");
        const seasonRows=await evaluate("[...document.querySelectorAll('.article-season-row')].map(row=>{const box=row.getBoundingClientRect();return {left:box.left,right:box.right,items:[...row.children].map(item=>{const r=item.getBoundingClientRect();return {top:r.top,left:r.left,right:r.right}})}})");
        for(const row of seasonRows)for(const items of Map.groupBy(row.items,item=>Math.round(item.top)).values())assert.ok(Math.abs((items[0].left+items.at(-1).right-row.left-row.right)/2)<1,'Every season row, including a single season or a wrapped last row, is centered');
        assert.equal(await evaluate(`[...document.querySelectorAll('.knowledge-article .product-article figure > img')].filter(img=>${JSON.stringify(labels)}.includes(img.alt)).length`),0,"Season icons no longer render as detached full-width figures");
        await noOverflow();
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.knowledge-detail-page')).maxWidth"),"1500px","The shared wide page container is preserved");
        assert.equal(await evaluate(`[...document.querySelectorAll('.knowledge-article .product-article figure > img')].filter(img=>!${JSON.stringify(labels)}.includes(img.alt)).every(img=>getComputedStyle(img).maxHeight===${JSON.stringify(width>600?"240px":"180px")})`),true,"Illustration size limits are preserved");
        await assertKnowledgeProductCards();
        if(["Cam Chanh Ngọt Ngào (Citrus Gourmand)","Gỗ Thơm Và Thảo Mộc (Woody Aromatic)","Cam Chanh (Citrus)"].includes(entry.name)){
          await evaluate("document.querySelector('.article-season-row').scrollIntoView({block:'center',behavior:'instant'})");
          await pause(300);
          await screenshot("knowledge-season-row-"+libraryPath(entry).split("/").pop()+"-"+width);
        }
      }
    }
    checks.push(`All ${entries.length} articles display centered season rows, including single items and wrapped last rows: one desktop row, two mobile columns, 40px/32px icons (${iconsChecked} placements at 1440/390/320px); shared 1500px page container, illustration limits and related-product columns preserved; no overflow; zero database writes`);
  }else if(knowledgeWidthQA){
    const entries=[];
    for(const kind of ["group","accord","note"]){
      const term=await FragranceTerm.findOne({kind,descriptionContent:{$ne:null}}).select("kind key slug name").lean();assert.ok(term);entries.push({kind,...term,path:libraryPath(term)});
    }
    const bounds=selector=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect(),s=getComputedStyle(el);return {left:r.left+parseFloat(s.paddingLeft),width:r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)}})()`);
    for(const width of [1920,1440,390,320]){
      await send("Emulation.setDeviceMetricsOverride",{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      await goto("/my-orders","document.querySelector('.net-orders.store-page-container')");
      const orders=await bounds(".net-orders.store-page-container");
      await goto("/membership","document.querySelector('.loyalty-member')");
      const membership=await bounds(".net-membership .store-page-container");
      assert.deepEqual(membership,orders,"The account pages share the same content bounds");
      for(const entry of entries){
        await goto(entry.path,"document.querySelector('.knowledge-article .product-article')");
        for(const selector of [".knowledge-detail-page",".knowledge-detail-page > .store-page-heading",".knowledge-article",...(await evaluate("Boolean(document.querySelector('.knowledge-article > .product-article'))")?[".knowledge-article > .product-article"]:[])]){
          const actual=await bounds(selector);
          assert.ok(Math.abs(actual.left-orders.left)<1&&Math.abs(actual.width-orders.width)<1,JSON.stringify({width,kind:entry.kind,selector,actual,expected:orders}));
        }
        await noOverflow();
        await assertKnowledgeProductCards();
        await screenshot("knowledge-width-"+entry.kind+"-"+width);
      }
    }
    checks.push("All three knowledge detail pages match both account pages at 1920px/1440px/390px/320px; headings and articles fill the shared content bounds; no horizontal overflow; related-product columns preserved; zero database writes");
  }else if(membershipDesignQA){
    const memberTab=async id=>{await evaluate(`document.getElementById('membership-tab-${id}').click()`);await wait(`!document.getElementById('membership-panel-${id}').hidden`);};
    const base=loyaltyFixtures.respond({url:frontend+'/api/loyalty/me',method:'GET'}).body;
    const reward=base.rewards[0],expiresAt=new Date(Date.now()+86400000*60).toISOString();
    const scenario={rewards:[reward,{...reward,_id:'reward-two',name:'Bộ khám phá hương thơm',image:'/images/categories/women.webp',points:200},{...reward,_id:'reward-three',name:'Quà tặng dành riêng cho thành viên',points:300}],vouchers:[{_id:'voucher-one',code:'VELOURS10',type:'percent',value:10,minSubtotal:1000000,maxDiscount:200000,expiresAt},{_id:'voucher-two',code:'BIRTHDAY150',kind:'birthday',type:'fixed',value:150000,minSubtotal:1000000,expiresAt}]};
    loyaltyFixtures.setMemberScenario(scenario);
    for(const width of [1440,1024,768,390,320]){
      console.log(JSON.stringify({phase:'membership-design',width}));
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      await goto('/membership',"document.querySelectorAll('.loyalty-reward').length===3&&document.querySelectorAll('.net-member-voucher').length===2");
      await noOverflow();
      assert.equal(await evaluate("document.querySelectorAll('.membership-tabs [role=tab]').length"),2);
      assert.equal(await evaluate("document.getElementById('membership-tab-member').getAttribute('aria-selected')==='true'&&document.getElementById('membership-panel-vouchers').hidden&&document.querySelector('.membership-wallet').getClientRects().length===0"),true,'Default member tab hides the voucher wallet');
      assert.equal(await evaluate("[...document.querySelectorAll('.membership-tabs [role=tab]')].every(tab=>document.getElementById(tab.getAttribute('aria-controls')).getAttribute('aria-labelledby')===tab.id)"),true,'Tabs and panels have matching accessible labels');
      await evaluate("document.getElementById('membership-tab-member').focus()");
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
      await wait("!document.getElementById('membership-panel-vouchers').hidden");
      assert.equal(await evaluate("document.activeElement.id==='membership-tab-vouchers'&&document.getElementById('membership-panel-member').hidden&&document.querySelector('.membership-profile').getClientRects().length===0"),true,'Keyboard switches to vouchers and hides member content');await noOverflow();
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36});await wait("!document.getElementById('membership-panel-member').hidden");
      assert.equal(await evaluate("!document.querySelector('.membership-intro,.membership-shortcuts')&&!document.querySelector('.loyalty-status').innerText.includes('Velours Membership')&&!document.querySelector('.loyalty-points').innerText.includes('Tích lũy từ những lần mua sắm')"),true,'All red-marked content is removed');
      const layout=await evaluate("(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {page:rect('.net-membership .store-page-container'),profile:rect('.membership-profile'),tier:rect('.loyalty-status'),points:rect('.loyalty-points'),workspace:rect('.loyalty-workspace'),wallet:rect('.membership-wallet'),tabs:document.querySelectorAll('.loyalty-tabs button').length,background:getComputedStyle(document.querySelector('.loyalty-status')).backgroundColor}})()");
      assert.equal(layout.tabs,6);
      if(width>1100)assert.ok(layout.profile.height<=100,'Compact profile strip');
      await screenshot('membership-overview-'+width);
      if(width>800)assert.ok(layout.tier.height<=310,`Compact membership overview: ${JSON.stringify(layout)}`);
      for(const name of ['profile','workspace'])assert.ok(Math.abs(layout[name].left-layout.profile.left)<1&&Math.abs(layout[name].right-layout.profile.right)<1,'Full-width account sections align');
      if(width>800)assert.ok(Math.abs(layout.tier.top-layout.points.top)<1&&Math.abs(layout.tier.height-layout.points.height)<1,'Rank and points align');
      else assert.ok(layout.points.top>layout.tier.bottom,'Mobile overview stacks');
      assert.equal(await evaluate("document.querySelector('#loyalty-current-tier').textContent"),'Prestige');
      assert.equal(await evaluate("document.querySelector('.loyalty-member').innerText.includes('555.555')"),false,'Gift costs stay private');
      await screenshot('membership-overview-'+width);
      await evaluate("document.querySelector('.loyalty-policy').open=true");
      assert.equal(await evaluate("document.querySelectorAll('.loyalty-tier-grid article').length"),4);
      assert.equal(await evaluate("document.querySelector('.loyalty-tier-grid [data-current] strong').textContent"),'Prestige');
      await noOverflow();await evaluate("document.querySelector('.loyalty-policy').open=false");
      await evaluate("document.querySelector('.loyalty-rewards-link').click()");await wait("document.querySelector('.loyalty-tabs [aria-current]').textContent==='Đổi quà'");
      await evaluate("document.querySelector('.loyalty-workspace').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('membership-rewards-'+width);
      const columns=await evaluate("getComputedStyle(document.querySelector('.loyalty-reward-grid')).gridTemplateColumns.split(' ').length");assert.equal(columns,width>1100?4:width>800?3:width>600?2:1);
      await wait("document.querySelector('.loyalty-reward-image img').complete");assert.equal(await evaluate("(()=>{const img=document.querySelector('.loyalty-reward-image img'),r=img.getBoundingClientRect(),frame=img.parentElement.getBoundingClientRect();return img.naturalWidth>0&&r.width<=frame.width+1&&r.height<=frame.height+1&&getComputedStyle(img).objectFit==='contain'})()"),true,'Reward photos fit fully inside their media frame');
      await evaluate("(()=>{const b=document.querySelector('.loyalty-reward button');b.focus();b.click()})()");await wait("document.querySelector('.loyalty-dialog[open]')");await noOverflow();
      assert.equal(await evaluate("(()=>{const d=document.querySelector('.loyalty-dialog');const r=d.getBoundingClientRect();return r.width<=innerWidth&&r.height<=innerHeight&&!!document.getElementById(d.getAttribute('aria-labelledby'))})()"),true);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("!document.querySelector('.loyalty-dialog')");
      assert.equal(await evaluate("document.activeElement===document.querySelector('.loyalty-reward button')"),true,'Escape restores reward-button focus');
      for(const tab of ['Đặc quyền','Quà đã đổi','Lịch sử điểm','Lịch sử hạng']){await clickText(tab);await pause(120);await noOverflow();}
      await evaluate("document.querySelector('.loyalty-tabs button:last-child').click()");await noOverflow();
      await evaluate("void(window.__membershipLoyaltyNode=document.querySelector('.loyalty-member'))");
      await memberTab('vouchers');await noOverflow();
      assert.equal(await evaluate("document.querySelector('.membership-tab-count').textContent"),'2');
      const wallet=await evaluate("(()=>{const r=document.querySelector('.membership-wallet').getBoundingClientRect();return {left:r.left,right:r.right}})()");assert.ok(Math.abs(wallet.left-layout.profile.left)<1&&Math.abs(wallet.right-layout.profile.right)<1,'Voucher tab uses full page width');
      await evaluate("document.querySelector('.membership-wallet').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('membership-vouchers-'+width);
      assert.equal(await evaluate("[...document.querySelectorAll('.net-member-voucher-value p')].every(p=>{const range=document.createRange();range.selectNodeContents(p);const r=range.getBoundingClientRect(),box=p.parentElement.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right&&r.height<=parseFloat(getComputedStyle(p).lineHeight)+1})"),true,'Voucher amounts remain readable on one line');
      await memberTab('member');assert.equal(await evaluate("window.__membershipLoyaltyNode===document.querySelector('.loyalty-member')&&document.querySelector('.loyalty-tabs [aria-current]').textContent.startsWith('Thông báo')"),true,'Switching top-level tabs preserves loyalty state');await memberTab('vouchers');
    }
    await evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedVoucher=text}}})");
    await evaluate("document.querySelector('.net-member-copy').click()");await wait("window.__copiedVoucher==='VELOURS10'");
    await memberTab('member');
    await clickText('Đổi quà');await evaluate("document.querySelector('.loyalty-reward button').click()");await wait("document.querySelector('.loyalty-dialog[open]')");
    loyaltyFixtures.failNext('/api/loyalty/redeem');await evaluate("document.querySelector('.loyalty-dialog form').requestSubmit()");await wait("document.querySelector('.loyalty-dialog [role=alert]')");
    await evaluate("document.querySelector('.loyalty-dialog form').requestSubmit();document.querySelector('.loyalty-dialog form').requestSubmit()");await wait("!document.querySelector('.loyalty-dialog')");
    const redeem=loyaltyFixtures.requests.filter(row=>row.path==='/api/loyalty/redeem');assert.equal(redeem.length,2);assert.equal(redeem[0].body.requestId,redeem[1].body.requestId,'Retry keeps idempotency key; duplicate confirm sends once');
    await wait("document.querySelector('.loyalty-balance strong').textContent==='400'");
    await clickText('Đặc quyền');await clickText('Nhận quyền lợi');await wait("document.querySelector('.loyalty-dialog select')");
    await evaluate("document.querySelector('.loyalty-dialog form').requestSubmit()");assert.equal(loyaltyFixtures.requests.filter(row=>row.path==='/api/loyalty/claim').length,0,'Eligible order is required');
    await evaluate("(()=>{const select=document.querySelector('.loyalty-dialog select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,select.options[1].value);select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.loyalty-dialog form').requestSubmit();})()");await wait("!document.querySelector('.loyalty-dialog')");
    assert.equal(loyaltyFixtures.requests.find(row=>row.path==='/api/loyalty/claim').body.orderId,'6a0000000000000000000333');
    await clickText('Quà đã đổi');assert.equal(await evaluate("document.querySelector('.loyalty-workspace .loyalty-badge').textContent"),'Chờ xác nhận');
    await evaluate("document.querySelector('.loyalty-tabs button:last-child').click()");await clickText('Đánh dấu đã đọc');await wait("!document.querySelector('.loyalty-unread')");
    loyaltyFixtures.setMemberScenario({rewards:[],campaigns:[],profile:{birthday:''}});await goto('/membership',"document.querySelector('#birthday')&&document.querySelector('.loyalty-empty')");await noOverflow();
    assert.equal(await evaluate("document.querySelector('#birthday').required"),true);await screenshot('membership-empty-mobile');
    await input('#birthday','1995-06-15');await memberTab('vouchers');assert.equal(await evaluate("document.querySelector('.membership-tab-count').textContent"),'0');assert.ok(await evaluate("document.querySelector('.membership-wallet-empty').innerText.includes('Chưa có mã')"));await noOverflow();await screenshot('membership-vouchers-empty');await memberTab('member');assert.equal(await evaluate("document.querySelector('#birthday').value"),'1995-06-15','Birthday draft survives tab changes');
    await clickText('Đặc quyền');assert.ok(await evaluate("document.querySelector('.loyalty-empty').textContent.includes('Chưa có chiến dịch')"));
    loyaltyFixtures.setMemberScenario({membership:{points:{available:0,debt:50}}});await goto('/membership',"document.querySelector('.loyalty-points [role=status]')");assert.equal(await evaluate("document.querySelector('.loyalty-reward button').disabled"),true);await noOverflow();
    loyaltyFixtures.setMemberScenario({membership:{tier:base.membership.tiers.at(-1),nextTier:null,programEnabled:false,canRedeem:false},profile:{username:'Thành viên có tên rất dài để kiểm tra bố cục trên điện thoại',email:'long.account.email.address.for.layout.check@example.invalid'}});
    await goto('/membership',"document.querySelector('.loyalty-top-tier')");assert.equal(await evaluate("document.querySelector('.loyalty-reward button').disabled"),true);await noOverflow();
    const tierColors=[];
    for(const tier of base.membership.tiers){
      loyaltyFixtures.setMemberScenario({membership:{tier,nextTier:tier.id==='private-circle'?null:base.membership.nextTier}});
      for(const width of [1440,390]){
        await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
        await goto('/membership',`document.querySelector('.loyalty-member[data-tier="${tier.id}"]')`);await noOverflow();
        assert.equal(await evaluate("document.querySelector('#loyalty-current-tier').textContent"),tier.name);
        await evaluate("document.querySelector('.loyalty-policy').open=true");
        const colors=await evaluate("(()=>{const s=getComputedStyle(document.querySelector('.loyalty-member')),color=name=>s.getPropertyValue('--tier-'+name).trim();return {bg:color('bg'),end:color('end'),ink:color('ink'),muted:color('muted'),detail:color('detail'),policy:[...document.querySelectorAll('.loyalty-tier-grid article')].map(a=>getComputedStyle(a).getPropertyValue('--tier-bg').trim())}})()");
        assert.equal(new Set(colors.policy).size,4,'Four distinct tier palettes in comparison');
        const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
        const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
        for(const bg of [colors.bg,colors.end])for(const fg of [colors.ink,colors.muted])assert.ok(contrast(bg,fg)>=4.5,`${tier.id} readable tier text`);
        assert.ok(contrast('#ffffff',colors.detail)>=4.5,`${tier.id} readable accents on white`);
        await noOverflow();await screenshot(`membership-palette-${tier.id}-${width}`);
        if(width===1440)tierColors.push(colors.bg);
      }
    }
    assert.equal(new Set(tierColors).size,4);
    loyaltyFixtures.setMemberScenario({});loyaltyFixtures.failNext('/api/loyalty/me');await goto('/membership',"document.querySelector('.loyalty-panel[role=alert]')");await clickText('Thử lại');await wait("document.querySelector('.loyalty-overview')");await noOverflow();
    checks.push('Two top-level member/voucher tabs at 1440/1024/768/390/320px: correct default/selected/hidden states and accessible labels, keyboard ArrowRight/Home, only active panel occupies space, full-width layouts, preserved loyalty subtab and birthday draft, voucher count/empty state/copy; compact luxury tier palettes and policy, all six loyalty subtabs, dialog/focus, redemption retry/idempotency, campaign validation, point/notification updates and error states remain valid; gift costs private; financial actions in memory only');
  }else if(loyaltyQA){
    await goto('/membership',"document.querySelector('.loyalty-member')");
    await noOverflow();await screenshot('loyalty-member-desktop');
    assert.equal(await evaluate("document.querySelector('#loyalty-current-tier').textContent"),"Prestige");
    assert.equal(await evaluate("document.querySelector('.loyalty-member').innerText.includes('555.555')"),false,"Internal gift cost is private");
    await evaluate("document.querySelector('.loyalty-reward button').click()");
    await wait("document.querySelector('.loyalty-dialog[open]')");
    await evaluate("document.querySelector('.loyalty-dialog form').requestSubmit();document.querySelector('.loyalty-dialog form').requestSubmit()");
    await wait("!document.querySelector('.loyalty-dialog')");
    assert.equal(loyaltyFixtures.requests.filter(row=>row.path.endsWith('/redeem')).length,1,"Repeated confirm submits only once");
    await clickText("Đặc quyền");await clickText("Nhận quyền lợi");await wait("document.querySelector('.loyalty-dialog select')");
    await evaluate("(()=>{const select=document.querySelector('.loyalty-dialog select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,select.options[1].value);select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.loyalty-dialog form').requestSubmit();})()");
    await wait("!document.querySelector('.loyalty-dialog')");
    assert.equal(loyaltyFixtures.requests.find(row=>row.path.endsWith('/claim')).body.orderId,"6a0000000000000000000333");
    for(const tab of ["Đặc quyền","Quà đã đổi","Lịch sử điểm","Lịch sử hạng"]){await clickText(tab);await pause(200);await noOverflow();}
    await evaluate("[...document.querySelectorAll('.loyalty-tabs button')].find(button=>button.textContent.startsWith('Thông báo')).click()");
    await clickText("Đánh dấu đã đọc");await wait("!document.querySelector('.loyalty-link')");
    for(const width of [390,320]){
      await send("Emulation.setDeviceMetricsOverride",{width,height:850,deviceScaleFactor:1,mobile:true});
      await clickText("Đổi quà");await noOverflow();await screenshot('loyalty-member-'+width);
      await evaluate("document.querySelector('.loyalty-reward button').click()");await wait("document.querySelector('.loyalty-dialog[open]')");await noOverflow();
      assert.equal(await evaluate("document.querySelector('.loyalty-dialog').getBoundingClientRect().width<=innerWidth"),true);
      await clickText("Đóng");
    }
    await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await goto('/owner',"document.querySelectorAll('.admin-metric-card').length===4");
    const design=()=>evaluate("(()=>{const card=document.querySelectorAll('.admin-metric-card')[1],s=getComputedStyle(card),p=getComputedStyle(card.querySelector('p')),h=getComputedStyle(document.querySelector('.perfume-page-heading h1'));return {radius:s.borderRadius,background:s.backgroundColor,border:s.borderTopColor,font:s.fontFamily,caption:p.fontSize,captionMargin:p.marginBottom,titleFont:h.fontFamily,titleSize:h.fontSize}})()");
    const dashboardDesign=await design();
    await goto('/owner/loyalty',"document.querySelectorAll('.loyalty-admin-tier').length===4");
    assert.deepEqual(await design(),dashboardDesign,'Membership uses the same metric cards and page heading as Dashboard');
    assert.equal(await evaluate("document.querySelector('.admin-sidebar a[aria-current=page]').getAttribute('href')"),'/owner/loyalty');
    await screenshot('loyalty-admin-overview');
    const checkDrawer=async()=>{
      await wait("document.querySelector('.admin-operation-drawer[open]')");await noOverflow();
      assert.equal(await evaluate("(()=>{const d=document.querySelector('.admin-operation-drawer'),r=d.getBoundingClientRect(),f=d.querySelector('footer').getBoundingClientRect(),button=d.querySelector('footer button[type=submit]');return r.width<=innerWidth&&r.height<=innerHeight+1&&f.bottom<=innerHeight+1&&(!button||button.form===d.querySelector('form'))})()"),true,'Drawer fits the viewport and its pinned save button submits the correct form');
    };
    const fillField=async(label,value)=>evaluate(`(()=>{const field=[...document.querySelectorAll('.loyalty-admin-form label')].find(label=>label.textContent.startsWith(${JSON.stringify(label)})).querySelector('input,textarea,select');Object.getOwnPropertyDescriptor(field.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:field.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(field,${JSON.stringify(String(value))});field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
    await evaluate("document.querySelector('.loyalty-admin-tier').open=true");await noOverflow();await screenshot('loyalty-admin-policy');
    await input('.loyalty-admin-form>label:last-of-type textarea',"Kiểm thử thay đổi cấu hình");
    await clickText("Lưu chính sách");await wait("document.querySelectorAll('.loyalty-admin-tier').length===4&&!document.querySelector('.loyalty-admin-policy button[type=submit]').disabled");await pause(200);
    assert.equal(loyaltyFixtures.requests.filter(row=>row.path.endsWith('/policy')).length,1);
    for(const width of [1440,1024,390,320]){
      console.log(JSON.stringify({phase:'loyalty-dashboard-design',width}));
      await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<500});
      await noOverflow();await clickText("Danh mục quà");await clickText("Thêm quà");await noOverflow();
      await checkDrawer();
      assert.equal(await evaluate("document.querySelector('.loyalty-admin-form').innerText.includes('Giá vốn nội bộ')"),true);
      await screenshot('loyalty-admin-reward-'+width);
      if(width===1440){
        await fillField('Tên quà','Quà QA');await clickText('Lưu thay đổi');await pause(100);
        assert.equal(loyaltyFixtures.requests.filter(row=>row.path.endsWith('/rewards')).length,0,'A required reason cannot be skipped by the footer button');
        await fillField('Lý do chỉnh sửa','QA kiểm tra quà');loyaltyFixtures.failNext('/api/loyalty/admin/rewards');
        await clickText('Lưu thay đổi');await wait("document.querySelector('.admin-operation-drawer [role=alert]')");
        assert.equal(await evaluate("document.querySelector('.loyalty-admin-form > label:last-of-type textarea').value"),'QA kiểm tra quà');
        await clickText('Lưu thay đổi');await wait("!document.querySelector('.admin-operation-drawer')");
        const rewardAttempt=loyaltyFixtures.requests.filter(row=>row.path.endsWith('/rewards'));assert.equal(rewardAttempt.length,2);assert.equal(rewardAttempt.at(-1).body.name,'Quà QA');assert.equal(rewardAttempt.at(-1).body.points,100);
      }else await clickText("Đóng");
      await clickText("Chiến dịch VIP");await clickText("Thêm chiến dịch");await noOverflow();await screenshot('loyalty-admin-campaign-'+width);
      await checkDrawer();
      if(width===1440){
        await evaluate("(()=>{const field=[...document.querySelectorAll('.loyalty-admin-form label')].find(label=>label.textContent.startsWith('Mã tài khoản')).querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'user_one\\nuser_two');field.dispatchEvent(new Event('input',{bubbles:true}));})()");
        assert.equal(await evaluate("[...document.querySelectorAll('.loyalty-admin-form label')].find(label=>label.textContent.startsWith('Mã tài khoản')).querySelector('textarea').value"),"user_one\nuser_two","Targeted customer IDs retain line breaks while editing");
        await input('.loyalty-admin-form>label:first-child input',"Campaign QA");
        await input('.loyalty-admin-form>label:last-of-type textarea',"QA multi-customer configuration");
        await clickText("Lưu thay đổi");await wait("!document.querySelector('.loyalty-admin-form')");
        assert.deepEqual(loyaltyFixtures.requests.find(row=>row.path.endsWith('/campaigns')).body.userIds,["user_one","user_two"]);
      }else await clickText("Đóng");
      await evaluate("[...document.querySelectorAll('.loyalty-admin-tabs>button')].find(button=>button.textContent==='Thành viên').click()");
      await wait("document.querySelector('.perfume-table tbody button')");await noOverflow();await clickText("Quản lý");await noOverflow();
      await checkDrawer();await clickText("Gia hạn / điều chỉnh hạng");await noOverflow();await screenshot('loyalty-admin-member-'+width);
      if(width===1440){
        await fillField('Lý do bắt buộc','QA gia hạn hạng');await clickText('Lưu thay đổi');await wait("!document.querySelector('.admin-operation-drawer')");
        const tier=loyaltyFixtures.requests.find(row=>row.path.endsWith('/tier'));assert.equal(tier.body.action,'extend');assert.equal(tier.body.months,12);assert.equal(tier.body.reason,'QA gia hạn hạng');
        await clickText('Quản lý');await checkDrawer();await fillField('Số điểm điều chỉnh',-25);await fillField('Lý do bắt buộc','QA điều chỉnh điểm');
        await evaluate("document.querySelector('.admin-operation-drawer form').requestSubmit();document.querySelector('.admin-operation-drawer form').requestSubmit()");await wait("!document.querySelector('.admin-operation-drawer')");
        const points=loyaltyFixtures.requests.filter(row=>row.path.endsWith('/points'));assert.equal(points.length,1);assert.equal(points[0].body.points,-25);assert.ok(points[0].body.requestId);
      }else await clickText("Đóng");
      await clickText("Yêu cầu đổi quà");await pause(200);await noOverflow();
      if(width===1440){
        await wait("document.querySelector('.loyalty-admin-row button')");await clickText('Xử lý');await checkDrawer();
        await fillField('Lý do / ghi chú xử lý','QA xác nhận quà');await clickText('Lưu thay đổi');await wait("!document.querySelector('.admin-operation-drawer')");
        await evaluate("(()=>{const select=document.querySelector('[aria-label=\"Lọc trạng thái đổi quà\"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'Confirmed');select.dispatchEvent(new Event('change',{bubbles:true}));})()");
        await wait("document.querySelector('.loyalty-admin-row button')");await clickText('Xử lý');await checkDrawer();
        assert.deepEqual(await evaluate("[...document.querySelector('.admin-operation-drawer select').options].map(option=>option.value)"),['Fulfilled','Cancelled']);
        await fillField('Lý do / ghi chú xử lý','QA giao quà');await clickText('Lưu thay đổi');await wait("!document.querySelector('.admin-operation-drawer')");
        assert.deepEqual(loyaltyFixtures.requests.filter(row=>row.method==='PATCH'&&row.path.includes('/redemptions/')).map(row=>row.body.status),['Confirmed','Fulfilled']);
      }
      await clickText("Hoàn trả & đối soát");await noOverflow();await screenshot('loyalty-admin-refund-'+width);
      if(width===1440){
        await fillField('Mã đơn hàng','6a0000000000000000000333');await wait("document.querySelector('.loyalty-admin-refund-layout').innerText.includes('10.000.000')");
        await fillField('Tiền hàng hoàn trả lần này',100000);await fillField('Lý do / mã chứng từ hoàn trả','QA hoàn trả');await clickText('Ghi nhận điều chỉnh');
        await wait("document.querySelector('.loyalty-admin-refund-layout input[type=number]').value==='0'");
        assert.equal(loyaltyFixtures.requests.find(row=>row.path.endsWith('/refund')).body.amountVnd,100000);
      }
      await clickText("Nhật ký");await pause(200);await noOverflow();
      await wait("document.querySelector('.loyalty-admin-audit-details')");await evaluate("document.querySelector('.loyalty-admin-audit-details').open=true");
      assert.deepEqual(await evaluate("JSON.parse(document.querySelector('.loyalty-admin-audit-details pre').textContent)"),{before:{version:0},after:{version:1}});await screenshot('loyalty-admin-audit-'+width);
      await clickText("Chính sách hạng");await pause(100);
    }
    loyaltyFixtures.setEmpty(true);await goto('/owner/loyalty',"document.querySelectorAll('.loyalty-admin-tier').length===4");
    for(const [tab,title] of [['Danh mục quà','Chưa có quà tặng'],['Chiến dịch VIP','Chưa có chiến dịch VIP'],['Thành viên','Chưa có thành viên'],['Yêu cầu đổi quà','Chưa có yêu cầu trong trạng thái này'],['Nhật ký','Chưa có nhật ký quản trị']]){await clickText(tab);await wait(`document.querySelector('.admin-operation-empty strong')?.textContent===${JSON.stringify(title)}`);await noOverflow();}
    await clickText('Danh mục quà');await evaluate("[...document.querySelectorAll('.loyalty-admin button')].find(button=>button.textContent==='Thêm quà').focus()");await clickText('Thêm quà');await checkDrawer();
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("!document.querySelector('.admin-operation-drawer')");
    assert.equal(await evaluate("document.activeElement.textContent"),'Thêm quà');
    checks.push("Dashboard-matched metric cards and typography; all seven Loyalty admin tabs and pinned native drawers at 1440/1024/390/320px; policy save, required reasons, reward error/retry, targeted campaign IDs, tier extension, duplicate-protected point changes, redemption statuses, refunds, empty states, audit JSON, Escape/focus restore; customer point/reward privacy retained; all mutations isolated in memory, zero database writes");
  }else if(libraryQA){
    const dialogsOnly=process.argv.includes('--library-dialogs-only');
    const labels={brand:'thương hiệu',group:'nhóm hương',accord:'kiểu mùi',note:'note hương'};
    for(const kind of dialogsOnly?[]:['brand','group','accord','note']){
      console.log(JSON.stringify({library:kind,step:'desktop-crud'}));
      const url=kind==='brand'?'/owner/brands':`/owner/library?kind=${kind}`,label=labels[kind],name=`AAA kiểm thử ${kind}`,renamed=`AAA đã sửa ${kind}`;
      await goto(url,"document.querySelectorAll('.perfume-table tbody tr').length===25");await noOverflow();
      await clickText(`Thêm ${label}`);await wait("document.querySelector('.perfume-library-dialog[open] .tiptap')");
      await input('.perfume-library-dialog .perfume-field input',name);
      await evaluate("document.querySelector('.perfume-library-dialog .tiptap').focus()");await send('Input.insertText',{text:`Giới thiệu mới cho ${label}.`});
      if(kind==='brand'){
        const {root:documentRoot}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:documentRoot.nodeId,selector:'input[aria-label="Tải ảnh đại diện"]'});
        await send('DOM.setFileInputFiles',{nodeId,files:[path.join(root,'client/public',libraryCover)]});
        await wait(`document.querySelector('.perfume-library-cover img')?.getAttribute('src')===${JSON.stringify(libraryCover)}&&!document.querySelector('.perfume-library-dialog button[type="submit"]').disabled`);
      }
      await evaluate("document.querySelector('.perfume-library-dialog button[type=\"submit\"]').click()");
      await wait(`!document.querySelector('.perfume-library-dialog')&&document.querySelector('.perfume-table tbody tr')?.textContent.includes(${JSON.stringify(name)})`);
      const created=libraryFixtures.terms.find(term=>term.name===name);assert.equal(created.kind,kind);assert.ok(created.description.includes('Giới thiệu mới'));if(kind==='brand')assert.equal(created.image,libraryCover);
      await evaluate("document.querySelector('.perfume-table tbody tr button[title=\"Chỉnh sửa\"]').click()");await wait("document.querySelector('.perfume-library-dialog[open] .tiptap')");
      await input('.perfume-library-dialog .perfume-field input',renamed);await evaluate("document.querySelector('.perfume-library-dialog button[type=\"submit\"]').click()");
      await wait(`!document.querySelector('.perfume-library-dialog')&&document.querySelector('.perfume-table tbody tr')?.textContent.includes(${JSON.stringify(renamed)})`);
      await clickText(`Thêm ${label}`);await wait("document.querySelector('.perfume-library-dialog[open] .tiptap')");await input('.perfume-library-dialog .perfume-field input',renamed);
      await evaluate("document.querySelector('.perfume-library-dialog button[type=\"submit\"]').click()");await wait("document.querySelector('.perfume-library-dialog [role=\"alert\"]')?.textContent.includes('đã tồn tại')");
      await evaluate("document.querySelector('[aria-label=\"Đóng biên tập\"]').click()");await wait("!document.querySelector('.perfume-library-dialog')");
      await input('[aria-label="Tìm trong thư viện"]',`Mục kiểm thử ${kind} 00`);await wait("document.querySelectorAll('.perfume-table tbody tr').length===1");
      await evaluate("document.querySelector('.perfume-table button[title=\"Xóa\"]').click()");await wait("document.querySelector('.perfume-library-delete-dialog[open]')");
      await evaluate("document.querySelector('.perfume-library-delete-confirm').click()");await wait("document.querySelector('.perfume-library-delete-dialog [role=\"alert\"]')?.textContent.includes('2 sản phẩm')");
      await screenshot(`library-delete-linked-${kind}`);await evaluate("document.querySelector('.perfume-library-delete-dialog footer button').click()");await wait("!document.querySelector('.perfume-library-delete-dialog')");
      await input('[aria-label="Tìm trong thư viện"]',renamed);await wait(`document.querySelectorAll('.perfume-table tbody tr').length===1&&document.querySelector('.perfume-table tbody tr').textContent.includes(${JSON.stringify(renamed)})`);
      await evaluate("document.querySelector('.perfume-table button[title=\"Xóa\"]').click()");await wait("document.querySelector('.perfume-library-delete-dialog[open]')");await evaluate("document.querySelector('.perfume-library-delete-confirm').click()");
      await wait("!document.querySelector('.perfume-library-delete-dialog')&&document.querySelectorAll('.perfume-table tbody tr').length===0");
      await input('[aria-label="Tìm trong thư viện"]','');await wait("document.querySelectorAll('.perfume-table tbody tr').length===25&&document.querySelector('[aria-label=\"Trang 2\"]')&&!document.querySelector('[aria-label=\"Trang 2\"]').disabled");
      await evaluate("document.querySelector('[aria-label=\"Trang 2\"]').click()");await wait("document.querySelectorAll('.perfume-table tbody tr').length===1&&document.querySelector('.perfume-pagination').textContent.includes('Trang 2')");
      await evaluate("document.querySelector('.perfume-table button[title=\"Xóa\"]').click()");await wait("document.querySelector('.perfume-library-delete-dialog[open]')");await evaluate("document.querySelector('.perfume-library-delete-confirm').click()");
      await wait("!document.querySelector('.perfume-library-delete-dialog')&&document.querySelectorAll('.perfume-table tbody tr').length===25&&document.querySelector('.perfume-pagination').textContent.includes('Trang 1/1')");await noOverflow();
    }
    for(const width of [390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      for(const kind of ['brand','group','accord','note']){
        await goto(kind==='brand'?'/owner/brands':`/owner/library?kind=${kind}`,"document.querySelectorAll('.perfume-table tbody tr').length===25");await noOverflow();
        await clickText(`Thêm ${labels[kind]}`);await wait("document.querySelector('.perfume-library-dialog[open] .tiptap')");await noOverflow();
        const bounds=await evaluate("(()=>{const dialog=document.querySelector('.perfume-library-dialog'),form=dialog.querySelector('form'),title=dialog.querySelector('h2');return {width:innerWidth,dialogLeft:dialog.getBoundingClientRect().left,dialogWidth:dialog.getBoundingClientRect().width,scrollLeft:dialog.scrollLeft,scrollWidth:dialog.scrollWidth,clientWidth:dialog.clientWidth,formLeft:form.getBoundingClientRect().left,formWidth:form.getBoundingClientRect().width,titleLeft:title.getBoundingClientRect().left}})()");
        const visual=await evaluate("({width:visualViewport.width,left:visualViewport.offsetLeft,scale:visualViewport.scale})");
        assert.ok(bounds.dialogWidth<=width+2&&bounds.titleLeft>=visual.left&&bounds.scrollWidth<=bounds.clientWidth+2,JSON.stringify({bounds,visual}));
        assert.ok(Math.abs(visual.width-width)<=2&&visual.left<=2,JSON.stringify(visual));await screenshot(`library-create-${kind}-${width}`);
        await evaluate("document.querySelector('[aria-label=\"Đóng biên tập\"]').click()");await wait("!document.querySelector('.perfume-library-dialog')");
        assert.equal(await evaluate("document.body.style.overflow==='hidden'"),false);
        await evaluate("document.querySelector('.perfume-table button[title=\"Xóa\"]').click()");await wait("document.querySelector('.perfume-library-delete-dialog[open]')");
        const confirmation=await evaluate("(()=>{const rect=document.querySelector('.perfume-library-delete-dialog').getBoundingClientRect();return {left:rect.left,right:rect.right,offset:visualViewport.offsetLeft}})()");
        assert.ok(confirmation.left>=0&&confirmation.right<=width+2&&confirmation.offset<=2,JSON.stringify(confirmation));await screenshot(`library-delete-${kind}-${width}`);
        await evaluate("document.querySelector('.perfume-library-delete-dialog footer button').click()");await wait("!document.querySelector('.perfume-library-delete-dialog')");
        assert.equal(await evaluate("document.body.style.overflow==='hidden'"),false);
      }
    }
    for(const kind of dialogsOnly?[]:['brand','group','accord','note']){
      assert.ok(libraryFixtures.requests.some(request=>request.method==='POST'&&request.body?.kind===kind));
      assert.ok(libraryFixtures.requests.some(request=>request.method==='PATCH'&&request.body?.name===`AAA đã sửa ${kind}`));
      assert.equal(libraryFixtures.terms.filter(term=>term.kind===kind).length,25);
    }
    checks.push(dialogsOnly?'390px/320px library dialogs fit the visual viewport and close correctly':'Create/edit/delete for brands and all three fragrance libraries; rich text and cover upload; duplicate-name errors; linked-product deletion guard; deleting final pagination row; 390px/320px dialogs and close controls; all mutations isolated in memory');
  }else if(fullLibraryQA){
    for(const kind of ['group','accord','note']){
      const term=await FragranceTerm.findOne({kind,...(kind==='note'?{}:{'descriptionContent.content.type':'libraryCards'})}).lean();assert.ok(term);
      await goto('/owner/library?kind='+kind,"document.querySelector('.perfume-search input')");
      await input('.perfume-search input',term.name);
      await wait(`Array.from(document.querySelectorAll('.perfume-table tbody tr')).some(row=>row.querySelector('strong')?.textContent===${JSON.stringify(term.name)})`);
      await evaluate(`Array.from(document.querySelectorAll('.perfume-table tbody tr')).find(row=>row.querySelector('strong')?.textContent===${JSON.stringify(term.name)}).querySelector('button[title="Chỉnh sửa"]').click()`);
      await wait("document.querySelector('.perfume-library-dialog .tiptap')?.editor");
      const roundtrip=sanitizeArticle(await evaluate("document.querySelector('.perfume-library-dialog .tiptap').editor.getJSON()"),LIBRARY_ARTICLE_LIMITS);
      assert.equal(articleToPlainText(roundtrip),articleToPlainText(term.descriptionContent));
      assert.deepEqual(roundtrip.content.filter(node=>node.type==='libraryCards'),term.descriptionContent.content.filter(node=>node.type==='libraryCards'));
      await evaluate("document.querySelector('.perfume-library-dialog .article-preview-toggle').click()");
      await wait("document.querySelector('.perfume-library-dialog .article-editor-preview .product-article')");
      assert.equal(await evaluate("document.querySelectorAll('.perfume-library-dialog .article-editor-preview .article-library-cards').length"),term.descriptionContent.content.filter(node=>node.type==='libraryCards').length);
      await noOverflow();await screenshot('library-fulltext-owner-'+kind);
      await evaluate("document.querySelector('.perfume-library-dialog header button').click()");await wait("!document.querySelector('.perfume-library-dialog')");
    }
    checks.push('Full source text and linked-note/product card blocks survive Tiptap JSON round trips and owner preview for all three library types; zero database writes');
  }else if(descriptionsQA){
    const records=await Product.find({isDeleted:{$ne:true},'source.id':{$in:[42518,64535,64512,46900,50121,39796]}}).select('title description descriptionContent source').lean();
    assert.equal(records.length,6);
    for(const record of records){
      assert.equal(record.description,'');assert.equal(record.descriptionContent,null);
      await goto(`/collection/${record._id}`,"document.querySelector('.product-description-copy')");
      await noOverflow();
      assert.equal(await evaluate("Boolean(document.querySelector('.product-description-copy .product-article'))"),false);
      await evaluate("document.querySelector('.product-detail-tabs').scrollIntoView({block:'start',behavior:'instant'})");
      await screenshot(`cleared-product-description-${record._id}-desktop`);
    }
    const record=records.find(row=>row.source.id===50121);
    await goto(`/owner/edit-product/${record._id}`,"document.querySelector('.perfume-article-panel .tiptap')");
    assert.equal(await evaluate("document.querySelector('.perfume-article-panel .tiptap').textContent.trim()"),'');
    assert.equal(await evaluate("document.querySelectorAll('.perfume-article-panel .tiptap img').length"),0);
    for(const width of [390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await goto(`/collection/${record._id}`,"document.querySelector('.product-description-copy')");await noOverflow();
      assert.equal(await evaluate("Boolean(document.querySelector('.product-description-copy .product-article'))"),false);
      await evaluate("document.querySelector('.product-detail-tabs').scrollIntoView({block:'start',behavior:'instant'})");await screenshot(`cleared-product-description-mobile-${width}`);
    }
    checks.push('Six real products have empty text and rich descriptions; no article or replacement placeholder renders; owner editor is empty; 390px/320px layouts; zero database writes');
  }else if(knowledgeQA){
    const groupDirectory=(await call(publicLibraryTerms,{params:{kind:'group'},query:{view:'directory'}})).body;
    const accordDirectory=(await call(publicLibraryTerms,{params:{kind:'accord'},query:{view:'directory'}})).body;
    const noteDirectory=(await call(publicLibraryTerms,{params:{kind:'note'},query:{view:'directory'}})).body;
    await goto('/knowledge/group',"document.querySelectorAll('.knowledge-card').length==="+groupDirectory.total);
    assert.equal(await evaluate("document.querySelectorAll('.knowledge-family-scroll tbody tr').length"),10);
    assert.equal(await evaluate("Boolean(document.querySelector('.knowledge-page > .velours-pagination'))"),false);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.knowledge-directory')).gridTemplateColumns.split(' ').length"),3);
    await wait("[...document.querySelectorAll('.knowledge-card img')].slice(0,3).every(img=>img.complete&&img.naturalWidth>0)");
    await noOverflow();await screenshot('knowledge-groups-desktop');
    await evaluate("document.querySelector('.knowledge-introduction-more').open=true");
    assert.equal(await evaluate("document.querySelectorAll('.knowledge-concept-comparison h3').length"),3);
    await evaluate("document.querySelector('.knowledge-introduction-more').open=false");
    await goto('/knowledge/accord',"document.querySelectorAll('.knowledge-card').length==="+accordDirectory.total);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.knowledge-directory')).gridTemplateColumns.split(' ').length"),6);
    assert.equal(await evaluate("document.querySelector('.knowledge-card small').textContent"),'Aldehydes');
    await wait("[...document.querySelectorAll('.knowledge-card img')].slice(0,6).every(img=>img.complete&&img.naturalWidth>0)");
    await noOverflow();await screenshot('knowledge-accords-desktop');
    await input('.knowledge-search input','aldehydes');await wait("document.querySelectorAll('.knowledge-card').length===1");
    assert.equal(await evaluate("document.querySelector('.knowledge-card').getAttribute('href')"),'/knowledge/accord/andehit');
    await goto('/knowledge/note',"document.querySelectorAll('.knowledge-origin-banner.has-image').length===16");
    assert.equal(await evaluate("new Set([...document.querySelectorAll('.knowledge-card')].map(a=>a.getAttribute('href'))).size"),noteDirectory.total);
    await wait("document.querySelector('.knowledge-origin-banner img').complete&&document.querySelector('.knowledge-origin-banner img').naturalWidth>0");
    await noOverflow();await screenshot('knowledge-note-origins-desktop');
    await evaluate("document.querySelector('.knowledge-origin-navigation a:last-child').click()");
    await wait("location.hash.startsWith('#origin-')&&(()=>{const box=document.getElementById(location.hash.slice(1)).getBoundingClientRect();return box.top>=0&&box.top<innerHeight/2})()");
    await noOverflow();await screenshot('knowledge-note-last-origin');
    await goto('/knowledge/note?origin=cam-chanh-citrus-smells',"document.querySelectorAll('.knowledge-note-section').length===1");
    assert.equal(await evaluate("document.querySelectorAll('.knowledge-card').length"),36);
    await input('.knowledge-search input','Bergamot');await wait("document.querySelector('.knowledge-card[href=\"/knowledge/note/cam-bergamot\"]')");
    await evaluate("document.querySelector('.knowledge-card[href=\"/knowledge/note/cam-bergamot\"]').click()");
    await wait("document.querySelector('.knowledge-article .product-article')&&document.querySelectorAll('.knowledge-product-grid .net-product-card').length===15");
    assert.equal(await evaluate("Boolean(document.querySelector('.knowledge-reading-aside,.knowledge-eyebrow,.store-page-heading-actions'))"),false);
    assert.equal(await evaluate("document.querySelectorAll('.store-page-breadcrumb li').length"),3);
    await noOverflow();await screenshot('knowledge-note-detail-desktop');
    await goto('/knowledge/note?q=unmatched-example-xyz',"document.querySelector('.knowledge-directory-empty a')");
    await evaluate("document.querySelector('.knowledge-directory-empty a').click()");
    await wait("!location.search&&document.querySelectorAll('.knowledge-origin-banner.has-image').length===16");
    for(const width of [390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      for(const kind of ['group','accord','note']){
        await goto('/knowledge/'+kind,"document.querySelector('.knowledge-card')");await noOverflow();await screenshot('knowledge-'+kind+'-mobile-'+width);
      }
      await evaluate("document.querySelector('.inessa-menu-toggle').click()");
      await wait("document.querySelectorAll('#store-navigation .store-info-menu').length===2");
      await evaluate("document.querySelectorAll('#store-navigation .store-info-menu button')[0].click()");
      await wait("document.querySelector('#store-navigation .store-info-dropdown')");await noOverflow();
      await goto('/knowledge/brand/dior',"location.pathname==='/collection'&&document.querySelector('.collection-catalog-main')");
    }
    checks.push('All group/accord/note directory entries visible; 10-row family table; 3-column banners and 6-column ingredient grids; English and Vietnamese labels; English search; 16 origin banners and anchor navigation; source-category deep links; original detail articles and related-product pagination; empty-state reset; 390px/320px layouts; mobile menus; old brand pages remain removed');
  }else{
  if(brandsQA){
    const directory=await call(listBrands,{}),brands=directory.body.brands;
    assert.ok(brands.length>100&&brands.every(brand=>brand.image));
    const chanel=brands.find(brand=>brand.name==='Chanel');
    const chanelIds=(await Product.find({brand:'Chanel'}).select('_id').lean()).map(product=>String(product._id));
    await goto('/collection',"document.querySelectorAll('.net-product-card').length===16");
    await evaluate("document.querySelector('.inessa-collection-search-toggle').click()");
    await input('[aria-label="Tìm kiếm sản phẩm"]','not-a-brand-result');
    await evaluate("document.querySelector('#store-shop-navigation .store-brand-trigger').click()");
    await wait(`document.querySelectorAll('#store-shop-navigation .store-brand-card').length===${brands.length}`);
    await wait("[...document.querySelectorAll('.store-brand-image img')].slice(0,10).every(img=>img.complete&&img.naturalWidth>0)");
    await screenshot('brands-desktop');
    assert.equal(await evaluate("(()=>{const logo=document.querySelector('.inessa-brand').getBoundingClientRect(),nav=document.querySelector('#store-shop-navigation').getBoundingClientRect(),trigger=document.querySelector('#store-shop-navigation .store-brand-trigger').getBoundingClientRect(),dropdown=document.querySelector('.store-brand-dropdown').getBoundingClientRect();return Math.abs((logo.left+logo.right)/2-document.documentElement.clientWidth/2)<2&&trigger.right<logo.left&&nav.right<logo.left&&dropdown.right<=innerWidth&&getComputedStyle(document.querySelector('.inessa-logo-mark')).height==='34px'})()"),true,'Header logo stays centred with room for the brand trigger');
    await noOverflow();await screenshot('brands-desktop');
    // Also load logos initially below the scroll area, checking all directory assets.
    assert.equal(await evaluate("Promise.all([...document.querySelectorAll('.store-brand-image img')].map(img=>new Promise(resolve=>{const check=new Image();check.onload=()=>resolve(true);check.onerror=()=>resolve(false);check.src=img.src}))).then(results=>results.every(Boolean))"),true);
    await input('[aria-label="Tìm thương hiệu nước hoa"]','Chanel');
    await wait("document.querySelectorAll('.store-brand-card').length===1");
    await evaluate("document.querySelector('.store-brand-card').click()");
    await wait(`location.search==='?brand=Chanel'&&document.querySelectorAll('.net-product-card').length===16&&document.querySelector('.inessa-collection-results').textContent.includes('/ ${chanel.availableCount} ')`);
    assert.equal(await evaluate(`(()=>{const allowed=${JSON.stringify(chanelIds)};return [...document.querySelectorAll('.net-product-card')].every(link=>allowed.includes(link.getAttribute('href').split('/').pop()))&&(!document.querySelector('[aria-label="Tìm kiếm sản phẩm"]')||document.querySelector('[aria-label="Tìm kiếm sản phẩm"]').value==='')&&!document.querySelector('.store-brand-dropdown')})()`),true);
    await screenshot('brands-chanel-collection');
    await evaluate("document.querySelector('.inessa-collection-page-arrows [aria-label=\"Trang sau\"]')?.click()");
    await evaluate("document.querySelector('.store-collection-brand a').click()");
    await wait("location.search===''&&document.querySelector('.inessa-collection-results').textContent.includes('/ 2251 ')");
    await evaluate("document.querySelector('#store-shop-navigation .store-brand-trigger').focus();document.querySelector('#store-shop-navigation .store-brand-trigger').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))");
    await wait("document.activeElement===document.querySelector('[aria-label=\"Tìm thương hiệu nước hoa\"]')");
    await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");
    await wait("!document.querySelector('.store-brand-dropdown')&&document.activeElement===document.querySelector('#store-shop-navigation .store-brand-trigger')");
    await evaluate("document.querySelector('#store-shop-navigation .store-brand-trigger').click()");
    await evaluate("document.querySelector('.inessa-collection-heading').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    await wait("!document.querySelector('.store-brand-dropdown')");
    for(const width of [390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await goto('/collection',"document.querySelectorAll('.net-product-card').length===16");
      await evaluate("document.querySelector('.inessa-menu-toggle').click();document.querySelector('#store-navigation .store-brand-trigger')?.click()");
      await wait("document.querySelector('#store-navigation .store-brand-trigger')");
      if(!await evaluate("Boolean(document.querySelector('#store-navigation .store-brand-dropdown'))"))await evaluate("document.querySelector('#store-navigation .store-brand-trigger').click()");
      await wait(`document.querySelectorAll('#store-navigation .store-brand-card').length===${brands.length}`);
      await noOverflow();await screenshot(`brands-mobile-${width}`);
      await input('[aria-label="Tìm thương hiệu nước hoa"]','Dior');
      await wait("document.querySelectorAll('.store-brand-card').length===1");
      await evaluate("document.querySelector('.store-brand-card').click()");
      await wait("location.search==='?brand=Dior'&&!document.querySelector('#store-navigation')&&document.querySelector('.store-collection-brand strong')?.textContent==='Dior'&&document.querySelector('.inessa-collection-reset')&&document.querySelectorAll('.net-product-card').length===16");
      await noOverflow();
      await clickText('Xóa bộ lọc');await wait("location.search===''&&!document.querySelector('.store-collection-brand')");
    }
    checks.push('173 real brand logos, centred smaller logo, brand search/collection filter/reset, keyboard/outside dismissal and 390px/320px navigation');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  }
  if(experienceQA){
    const fragrant=await Product.findOne({isPublished:true,'source.url':'https://apaniche.vn/afnan-supremacy-silver-edp'}).lean();assert.ok(fragrant);
    const expected=[...fragrant.fragrance.longevity,...fragrant.fragrance.sillage];
    const checkRows=async(selector)=>assert.equal(await evaluate(`(()=>{const expected=${JSON.stringify(expected)},rows=[...document.querySelectorAll(${JSON.stringify(selector+' .perfume-chart-row')})];return rows.length===expected.length&&rows.every((row,index)=>{const data=expected[index],meter=row.querySelector('.perfume-chart-track'),width=meter.getBoundingClientRect().width,fill=meter.firstElementChild.getBoundingClientRect().width,known=Number.isFinite(data.displayedPercent)&&data.displayedPercent>=0&&data.displayedPercent<=100;return row.firstElementChild.textContent===data.label&&row.querySelector('small').textContent===(data.displayedCount==null?'—':data.displayedCount.toLocaleString('vi-VN'))&&Math.abs(fill/width*100-(known?data.displayedPercent:0))<.5&&getComputedStyle(meter.firstElementChild).backgroundColor==='rgb(128, 0, 0)'})})()`),true,'Assessment counts, percentages and source bar color are preserved');
    await goto(`/collection/${fragrant._id}`,"document.querySelector('.perfume-fragrance-charts')");
    assert.equal(await evaluate("(()=>{const section=document.querySelector('.product-detail-experience'),overview=document.querySelector('.product-detail-overview'),charts=section.querySelector('.perfume-assessment');return section.previousElementSibling===overview&&section.nextElementSibling.classList.contains('product-detail-assurances')&&!section.closest('[role=tabpanel]')&&section.getBoundingClientRect().top>=overview.getBoundingClientRect().bottom&&Math.abs(charts.getBoundingClientRect().width-overview.getBoundingClientRect().width)<2})()"),true,'Assessments remain full width after the overview and before shipping assurances');
    assert.equal(await evaluate("document.querySelectorAll('.net-product-detail .perfume-assessment').length"),1);
    await evaluate("document.querySelector('[data-product-tab=\"description\"]').click()");await wait("document.querySelector('.perfume-fragrance-charts').getBoundingClientRect().height>0");
    await checkRows('.product-detail-experience');
    const seasonColors=['rgb(159, 229, 132)','rgb(252, 149, 138)','rgb(249, 190, 110)','rgb(120, 214, 240)','rgb(68, 123, 163)','rgb(252, 244, 135)'];
    assert.equal(await evaluate(`(()=>{const expected=${JSON.stringify(seasonColors)},items=[...document.querySelectorAll('.perfume-suitability-item')];return items.length===6&&items.every((item,i)=>item.querySelector('svg')&&getComputedStyle(item.querySelector('.perfume-chart-track > span')).backgroundColor===expected[i])})()`),true);
    assert.equal(await evaluate("(()=>{const parts=[...document.querySelector('.perfume-fragrance-charts').children].map(element=>element.getBoundingClientRect());return Math.max(...parts.map(p=>p.top+p.height/2))-Math.min(...parts.map(p=>p.top+p.height/2))<3})()"),true,'Wide product profile has three aligned sections');
    await evaluate("document.querySelector('.perfume-fragrance-charts').scrollIntoView({block:'center',behavior:'instant'})");await noOverflow();await screenshot('experience-design-desktop');
    await goto(`/owner/edit-product/${fragrant._id}?tab=assessments`,"document.querySelector('.perfume-editor-preview .perfume-fragrance-charts')");
    await checkRows('.perfume-editor-preview');
    assert.equal(await evaluate("document.querySelectorAll('.perfume-editor-body input[type=checkbox]').length"),0);
    await evaluate("document.querySelector('.perfume-editor-preview').scrollIntoView({block:'center',behavior:'instant'})");await noOverflow();await screenshot('experience-design-editor-desktop');
    const edge={longevity:[{label:'Yếu 1-3H',displayedPercent:0,displayedCount:0},{label:'Trung Bình 4-5H',displayedPercent:null,displayedCount:null,sourceRawCount:-8,sourceCountIssue:'invalid',sourceRawPercent:140,sourceValueIssue:'invalid'}],suitability:[{label:'Xuân',displayedPercent:0},{label:'Hạ',displayedPercent:null}]};
    await evaluate(`(async()=>{const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');const {default:Charts}=await import('/src/components/FragranceCharts.jsx');const container=document.createElement('div');container.id='qa-experience';container.className='net-theme';container.style.cssText='padding:22px;max-width:1320px';document.body.append(container);createRoot(container).render(React.createElement(React.Fragment,null,React.createElement('div',{id:'qa-experience-public'},React.createElement(Charts,{fragrance:${JSON.stringify(edge)}})),React.createElement('div',{id:'qa-experience-source'},React.createElement(Charts,{fragrance:${JSON.stringify(edge)},showSourceIssues:true}))));})()`);
    await wait("document.querySelectorAll('#qa-experience .perfume-suitability-item').length===12");
    assert.equal(await evaluate("(()=>{const publicPanel=document.querySelector('#qa-experience-public'),source=document.querySelector('#qa-experience-source'),zero=publicPanel.querySelector('.perfume-chart-track'),unknown=publicPanel.querySelectorAll('.perfume-chart-track')[1];return zero.getAttribute('role')==='meter'&&zero.getAttribute('aria-valuenow')==='0'&&publicPanel.querySelector('small').textContent==='0'&&unknown.getAttribute('role')==='img'&&!unknown.hasAttribute('aria-valuenow')&&unknown.title.includes('Chưa có dữ liệu')&&!publicPanel.querySelector('.perfume-assessment-source')&&source.querySelector('.perfume-assessment-source').textContent.includes('-8 lượt · 140%')})()"),true,'Unknown differs from zero, and raw source issues are visible only in the editor');
    for(const width of [390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await noOverflow();}
    for(const width of [1024,390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});
      await goto(`/collection/${fragrant._id}`,"document.querySelector('.perfume-fragrance-charts')");
      await evaluate("document.querySelector('[data-product-tab=\"description\"]').click()");await wait("document.querySelector('.perfume-fragrance-charts').getBoundingClientRect().height>0");
      await checkRows('.product-detail-experience');await noOverflow();
      await evaluate("document.querySelector('.perfume-fragrance-charts').scrollIntoView({block:'center',behavior:'instant'})");await screenshot(`experience-design-${width}`);
    }
    checks.push('source-style experience layout, exact counts/percentages, six seasonal colors/icons, zero versus unknown, editor source issues and 1024px/390px/320px responsiveness');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  }
  if(accordsQA){
    const fragrant=await Product.findOne({isPublished:true,'source.url':'https://apaniche.vn/afnan-supremacy-silver-edp'}).lean();assert.ok(fragrant);
    const rgb=hex=>`rgb(${[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)).join(', ')})`;
    const expected=fragrant.fragrance.accords.map(accord=>({background:rgb(getAccordColors(accord).background),foreground:rgb(getAccordColors(accord).foreground),percent:accord.displayedPercent}));
    const inspect=async(selector,expected)=>assert.equal(await evaluate(`(()=>{const expected=${JSON.stringify(expected)},rows=[...document.querySelectorAll(${JSON.stringify(selector+' .perfume-accord-meter')})];return rows.length===expected.length&&rows.every((row,i)=>{const fill=row.querySelector('.perfume-accord-fill'),color=getComputedStyle(fill),text=getComputedStyle(fill.firstElementChild);return color.backgroundColor===expected[i].background&&text.color===expected[i].foreground&&Math.abs(fill.getBoundingClientRect().width/row.getBoundingClientRect().width*100-expected[i].percent)<.5&&(i===0||row.getBoundingClientRect().top>=rows[i-1].getBoundingClientRect().bottom-1)})})()`),true,'Accords use exact source colors and proportional vertical bars');
    await goto(`/collection/${fragrant._id}`,"document.querySelector('.perfume-accord-meters')");
    await evaluate("document.querySelector('[data-product-tab=\"description\"]').click()");
    await wait("document.querySelector('.perfume-accord-meters').getBoundingClientRect().height>0");
    await evaluate("document.querySelector('.perfume-accord-meters').scrollIntoView({block:'center',behavior:'instant'})");
    await inspect('.product-detail-accords',expected);await noOverflow();await screenshot('accord-colors-detail-desktop');
    await goto(`/owner/edit-product/${fragrant._id}?tab=fragrance`,"document.querySelector('.perfume-editor-preview .perfume-accord-meters')");
    await inspect('.perfume-editor-preview',expected);
    await input('[aria-label="Tỷ lệ kiểu mùi 1"]','1.5');
    await wait("document.querySelector('.perfume-accord-fill').style.width==='1.5%'");
    await input('[aria-label="Tỷ lệ kiểu mùi 1"]','100');
    await evaluate("document.querySelector('.perfume-editor-preview').scrollIntoView({block:'center',behavior:'instant'})");await screenshot('accord-colors-editor-desktop');
    // Render every known color plus edge cases in the browser only; no product save.
    const fixture=[...Object.values(accordPalette).map(color=>({label:color.label,displayedPercent:100})),{label:'Gỗ',displayedPercent:1.5},{label:'Ngọt',displayedPercent:0},{label:'Mùi tùy chỉnh chưa xác định',displayedPercent:null},{label:'Tên mùi rất dài '.repeat(10),displayedPercent:3}];
    await evaluate(`(async()=>{const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');const {default:Accords}=await import('/src/components/FragranceAccords.jsx');const container=document.createElement('div');container.id='qa-accord-colors';container.className='net-theme';container.style.cssText='padding:22px;max-width:600px';document.body.append(container);createRoot(container).render(React.createElement(Accords,{accords:${JSON.stringify(fixture)}}));})()`);
    await wait(`document.querySelectorAll('#qa-accord-colors .perfume-accord-meter').length===${fixture.length}`);
    const allExpected=fixture.slice(0,68).map(accord=>({background:rgb(getAccordColors(accord).background),foreground:rgb(getAccordColors(accord).foreground),percent:100}));
    assert.equal(await evaluate(`(()=>{const expected=${JSON.stringify(allExpected)},fills=[...document.querySelectorAll('#qa-accord-colors .perfume-accord-fill')];return expected.every((color,i)=>getComputedStyle(fills[i]).backgroundColor===color.background&&getComputedStyle(fills[i].firstElementChild).color===color.foreground)})()`),true);
    for(const width of [390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await noOverflow();
      await evaluate("document.querySelector('#qa-accord-colors').scrollIntoView({block:'start',behavior:'instant'})");await screenshot(`accord-colors-all-${width}`);
    }
    for(const width of [390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await goto(`/collection/${fragrant._id}`,"document.querySelector('.perfume-accord-meters')");
      await evaluate("document.querySelector('[data-product-tab=\"description\"]').click()");
      await wait("document.querySelector('.perfume-accord-meters').getBoundingClientRect().height>0");
      await evaluate("document.querySelector('.perfume-accord-meters').scrollIntoView({block:'center',behavior:'instant'})");
      await inspect('.product-detail-accords',expected);await noOverflow();await screenshot(`accord-colors-detail-${width}`);
    }
    checks.push('68 exact source accord colors, proportional vertical bars, matching dashboard preview, unsaved edits, tiny/zero/unknown values and 390px/320px layouts');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  }
  if(productTabsQA){
    await goto(`/collection/${sample._id}`,"document.querySelectorAll('[data-product-tab]').length===2&&document.querySelector('.product-description-copy p')?.textContent.trim()");
    const currentTab=tab=>`document.querySelector('[data-product-tab="${tab}"]')?.getAttribute('aria-selected')==='true'`;
    assert.equal(await evaluate(currentTab('description')),true);
    const expectedNotes=[['top','Hương đầu'],['middle','Hương giữa'],['base','Hương cuối']].map(([key,label])=>({label,text:sample.fragrance.notes[key]?.map(note=>note.name).join(', ')||'Chưa có dữ liệu'}));
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.product-description-notes > div')].map(card=>({label:card.querySelector('h3').textContent,text:card.querySelector('p').textContent}))"),expectedNotes);
    assert.equal(await evaluate("!document.querySelector('.product-description-copy dl')&&!document.querySelector('[data-product-tab=\"profile\"]')&&!document.querySelector('.product-detail-experience > p')"),true,'Only the three note stages move into description; the profile tab and assessment disclaimer are removed');
    assert.equal(await evaluate("document.querySelectorAll('.product-detail-tab-panel:not([hidden])').length===1&&!document.querySelector('#pair-with-title')&&!document.querySelector('[aria-label=\"Thông tin sản phẩm\"] [aria-expanded]')"),true);
    assert.equal(await evaluate("(()=>{const tabs=document.querySelector('.product-detail-tabs').getBoundingClientRect(),detail=document.querySelector('.net-product-detail');const style=getComputedStyle(detail);return Math.abs(tabs.width-(detail.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)))<2})()"),true);
    await evaluate("document.querySelector('.product-detail-tabs').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('detail-tabs-description-desktop');
    assert.equal(await evaluate("document.querySelector('.product-detail-experience .perfume-fragrance-charts').getBoundingClientRect().height>0"),true);
    await noOverflow();
    await evaluate("document.querySelector('[data-product-tab=\"description\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}))");
    await wait(`${currentTab('reviews')}&&document.activeElement===document.querySelector('[data-product-tab="reviews"]')`);
    await wait("document.querySelector('#reviews textarea')");
    await input('#reviews textarea','Bản nhận xét đang nhập, chưa gửi.');
    await evaluate("document.querySelector('[data-product-tab=\"description\"]').click();document.querySelector('[data-product-tab=\"reviews\"]').click()");
    await wait(currentTab('reviews'));
    assert.equal(await evaluate("document.querySelector('#reviews textarea').value"),'Bản nhận xét đang nhập, chưa gửi.');
    await screenshot('detail-tabs-reviews-desktop');
    await evaluate("document.querySelector('[data-product-tab=\"description\"]').click()");
    await evaluate("document.querySelector('[aria-label=\"Thông tin sản phẩm\"] a[href=\"#reviews\"]').click()");
    await wait(`${currentTab('reviews')}&&document.querySelector('#reviews').getBoundingClientRect().top>=-2&&document.querySelector('#reviews').getBoundingClientRect().top<160`);
    await goto('/collection',"document.querySelectorAll('.net-product-card').length===16");
    await goto(`/collection/${sample._id}#reviews`,currentTab('reviews'));
    await wait("document.querySelector('#reviews').getBoundingClientRect().top>=-2&&document.querySelector('#reviews').getBoundingClientRect().top<160");
    for(const width of [390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await goto(`/collection/${sample._id}`,currentTab('description'));
      await evaluate("document.querySelector('.product-detail-tabs').scrollIntoView({block:'start',behavior:'instant'})");
      await noOverflow();await screenshot(`detail-tabs-description-${width}`);
      for(const tab of ['description','reviews']){
        await evaluate(`document.querySelector('[data-product-tab="${tab}"]').click()`);await wait(currentTab(tab));await noOverflow();
        await wait("(()=>{const selected=document.querySelector('[data-product-tab][aria-selected=\"true\"]').getBoundingClientRect(),list=document.querySelector('.product-detail-tab-list').getBoundingClientRect();return selected.left>=list.left-2&&selected.right<=list.right+2})()");
      }
      await screenshot(`detail-tabs-reviews-${width}`);
    }
    checks.push('full-width product tabs, perfume charts, retained review draft, keyboard navigation, review shortcuts/deep links and 390px/320px layouts');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  }
  if(operationsQA){
    await goto('/owner/orders',"document.querySelector('.admin-orders-page')&&!document.body.textContent.includes('Đang tải đơn hàng…')&&document.body.textContent.includes('Chưa có đơn hàng nào')");
    await noOverflow();await screenshot('operations-orders-empty-desktop');
    await goto('/owner/add-category',"document.querySelectorAll('.admin-category-list > li').length>0");
    const categoryCount=await evaluate("document.querySelectorAll('.admin-category-list > li').length");
    await noOverflow();await screenshot('operations-categories-desktop');
    await input('[aria-label="Tìm danh mục hoặc loại sản phẩm"]','Nước hoa nam');await wait("document.querySelectorAll('.admin-category-list > li').length===1");
    await input('[aria-label="Tìm danh mục hoặc loại sản phẩm"]','');await wait(`document.querySelectorAll('.admin-category-list > li').length===${categoryCount}`);
    await evaluate("document.querySelector('.admin-category-list [aria-label^=\"Chỉnh sửa danh mục\"]').click()");
    await wait("document.querySelector('[aria-label=\"Tên danh mục đang sửa\"]')");await input('[aria-label="Tên danh mục đang sửa"]','Tên thử không lưu');await clickText('Hủy');
    assert.equal(await evaluate("Boolean(document.querySelector('[aria-label=\"Tên danh mục đang sửa\"]'))"),false);
    await evaluate("document.querySelector('.admin-category-list [aria-label^=\"Xóa danh mục\"]').click()");await wait("document.querySelector('dialog[open]')");await clickText('Hủy');
    operationsActive=true;
    await goto('/owner/orders',"document.querySelectorAll('.net-order-card').length===10");
    await noOverflow();await screenshot('operations-orders-desktop');
    await evaluate("(()=>{const select=document.querySelector('.net-order-status');select.value='Shipping';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await wait("document.querySelector('.net-order-status')?.value==='Shipping'&&!document.querySelector('.net-order-status').disabled");
    await selectPage('[aria-label="Phân trang đơn hàng"]','.admin-order-list',2);
    await goto('/owner/vouchers',"document.querySelectorAll('.admin-voucher-table tbody tr').length===3");
    await noOverflow();await screenshot('operations-vouchers-desktop');
    await input('[aria-label="Tìm mã giảm giá"]','VELOURS10');await wait("document.querySelectorAll('.admin-voucher-table tbody tr').length===1");
    await input('[aria-label="Tìm mã giảm giá"]','');await wait("document.querySelectorAll('.admin-voucher-table tbody tr').length===3");
    await evaluate("document.querySelector('[aria-label=\"Tắt mã giảm giá VELOURS10\"]').click()");await wait("document.querySelector('[aria-label=\"Bật mã giảm giá VELOURS10\"]')&&!document.querySelector('[aria-label=\"Bật mã giảm giá VELOURS10\"]').disabled");
    await clickText('Thêm mã giảm giá');await wait("document.querySelector('.admin-operation-drawer[open]')");
    await input('dialog [name="code"]','QATEST20');
    const startsAt=new Date().toISOString().slice(0,10),expires=new Date();expires.setUTCFullYear(expires.getUTCFullYear()+1);
    await input('dialog [name="startsAt"]',startsAt);await input('dialog [name="expiresAt"]',expires.toISOString().slice(0,10));
    await screenshot('operations-voucher-drawer-desktop');
    await evaluate("document.querySelector('.admin-operation-drawer footer button[type=submit]').click()");
    await wait("!document.querySelector('.admin-operation-drawer[open]')&&document.querySelectorAll('.admin-voucher-table tbody tr').length===4");
    await evaluate("document.querySelector('[aria-label=\"Xóa mã giảm giá QATEST20\"]').click()");await wait("document.querySelector('dialog[aria-labelledby=\"delete-voucher-title\"][open]')");
    await evaluate("document.querySelector('dialog[aria-labelledby=\"delete-voucher-title\"] button:last-child').click()");
    await wait("!document.querySelector('dialog[open]')&&document.querySelectorAll('.admin-voucher-table tbody tr').length===3");
    await goto('/owner/messages',"document.querySelector('.admin-conversation-row')");
    await noOverflow();await screenshot('operations-messages-desktop');
    await evaluate("document.querySelector('.admin-conversation-row').click()");await wait("document.querySelector('.admin-support-thread textarea')&&!document.querySelector('.admin-support-thread textarea').disabled");
    await input('.admin-support-thread textarea','Phản hồi kiểm thử giao diện');
    await evaluate("document.querySelector('[aria-label=\"Gửi tin nhắn CSKH\"]').click()");await wait("document.querySelector('[aria-label=\"Lịch sử tin nhắn\"]')?.textContent.includes('Phản hồi kiểm thử giao diện')");
    await clickText('Đánh dấu hoàn tất');await wait("document.querySelector('.support-thread-status').textContent.includes('Mở lại hội thoại')");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.admin-support-thread .support-thread-message[data-own=true] > p:nth-child(2)')).color"),'rgb(255, 255, 255)');
    await screenshot('operations-thread-desktop');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    for(const [url,condition,name] of [
      ['/owner/orders',"document.querySelector('.net-order-card')",'orders'],['/owner/add-category',"document.querySelector('.admin-category-list > li')",'categories'],
      ['/owner/vouchers',"document.querySelector('.admin-voucher-table tbody tr')",'vouchers'],['/owner/messages',"document.querySelector('.admin-conversation-row')",'messages'],
    ]){await goto(url,condition);await noOverflow();await screenshot(`operations-${name}-mobile`);}
    await evaluate("document.querySelector('.admin-conversation-row').click()");await wait("document.querySelector('.admin-thread-back')?.getBoundingClientRect().width>0&&document.querySelector('.admin-support-thread textarea')&&!document.querySelector('.admin-support-thread textarea').disabled");
    assert.equal(await evaluate("document.querySelector('.support-thread-compose').getBoundingClientRect().bottom<=innerHeight+1"),true);
    await noOverflow();await screenshot('operations-thread-mobile');
    await evaluate("document.querySelector('.admin-thread-back').click()");await wait("getComputedStyle(document.querySelector('.admin-message-sidebar')).display!=='none'");
    await send('Emulation.setDeviceMetricsOverride',{width:320,height:760,deviceScaleFactor:1,mobile:true});
    for(const [url,condition] of [['/owner/orders',"document.querySelector('.net-order-card')"],['/owner/add-category',"document.querySelector('.admin-category-list > li')"],['/owner/vouchers',"document.querySelector('.admin-voucher-table tbody tr')"],['/owner/messages',"document.querySelector('.admin-conversation-row')"]]){await goto(url,condition);await noOverflow();}
    await goto('/owner/vouchers',"document.querySelector('.admin-voucher-table tbody tr')");await clickText('Thêm mã giảm giá');await wait("document.querySelector('.admin-operation-drawer[open]')");
    assert.equal(await evaluate("document.querySelector('.admin-operation-drawer').getBoundingClientRect().width<=innerWidth+1"),true);
    await screenshot('operations-voucher-drawer-320');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait("!document.querySelector('.admin-operation-drawer[open]')");
    assert.ok(operationsFixtures.requests.some(request=>request.path==='/api/orders/status'));
    assert.ok(operationsFixtures.requests.some(request=>request.path==='/api/vouchers'&&request.method==='POST'));
    assert.ok(operationsFixtures.requests.some(request=>request.path.endsWith('/messages')&&request.method==='POST'));
    operationsActive=false;await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    checks.push('unified operations pages: category load/search/edit cancellation, order status/pagination, voucher create/toggle/delete, staff messaging/status, 390px/320px and drawer Escape (in-memory fixtures only)');
  }
  if(editorQA){
    const editorUrl=`/owner/edit-product/${sample._id}`;
    await goto(`${editorUrl}?tab=fragrance`,"document.querySelector('.perfume-accord-editor')");
    await clickText('Thêm kiểu mùi');await input('[aria-label="Tên kiểu mùi 1"]','Gỗ');await input('[aria-label="Tỷ lệ kiểu mùi 1"]','65');
    await clickText('Thêm kiểu mùi');await input('[aria-label="Tên kiểu mùi 2"]','Cam chanh');await input('[aria-label="Tỷ lệ kiểu mùi 2"]','35');
    await evaluate("document.querySelector('[aria-label=\"Đưa kiểu mùi 2 lên\"]').click()");
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Tên kiểu mùi 1\"]').value"),'Cam chanh');
    await clickText('Thêm kiểu mùi');await input('[aria-label="Tên kiểu mùi 3"]','Thử xóa');
    await evaluate("document.querySelector('[aria-label=\"Xóa kiểu mùi 3\"]').click()");
    await noOverflow();await screenshot('editor-accords-desktop');
    await clickText('Đánh giá trải nghiệm');
    await input('[aria-label="Số lượt Lưu hương Yếu 1-3H"]','123');await input('[aria-label="Tỷ lệ Lưu hương Yếu 1-3H"]','25');
    await input('[aria-label="Tỷ lệ Mùa và thời điểm Xuân"]','88');
    assert.equal(await evaluate("document.querySelectorAll('.perfume-editor-body input[type=checkbox]').length"),0);
    await screenshot('editor-assessments-desktop');
    await clickText('Dung tích & giá');
    const size=sample.sizes.find(size=>sample.inStockBySize[size]&&sample.price[size]>0);assert.ok(size);
    await input(`[aria-label=${JSON.stringify(`Tồn kho ${size}`)}]`,'7');
    const priceSelector=`[aria-label=${JSON.stringify(`Giá ${size} VND`)}]`;
    const priceState=async(value,caret)=>wait(`(()=>{const price=document.querySelector(${JSON.stringify(priceSelector)});return price.value===${JSON.stringify(value ? value+' ₫' : '')}${caret==null?'':`&&price.selectionStart===${caret}`}})()`);
    const caretAt=async(start,end=start)=>evaluate(`(()=>{const price=document.querySelector(${JSON.stringify(priceSelector)});price.focus();price.setSelectionRange(${start},${end});})()`);
    const key=async key=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});};
    assert.equal(await evaluate("!document.querySelector('.admin-brand-caption')&&!document.querySelector('.perfume-inventory-notice')&&!document.querySelector('.perfume-variant-table small')&&!document.querySelector('.perfume-variant-table').textContent.includes('Trạng thái nguồn')"),true);
    await evaluate(`document.querySelector(${JSON.stringify(priceSelector)}).focus()`);
    await input(priceSelector,'349000');await priceState('349.000',7);
    await send('Input.insertText',{text:'0'});await priceState('3.490.000',9);
    await input(priceSelector,'349000');await caretAt(4);await key('Backspace');await priceState('34.000',2);
    await input(priceSelector,'349000');await caretAt(3);await key('Delete');await priceState('34.900',4);
    await input(priceSelector,'1234567');await caretAt(3);await send('Input.insertText',{text:'9'});await priceState('12.934.567',4);
    await caretAt(0,12);await send('Input.insertText',{text:'2.000.000 ₫'});await priceState('2.000.000',9);
    await key('End');await priceState('2.000.000',9);await key('Delete');await priceState('2.000.000',9);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(priceSelector)}).checkValidity()`),true);
    await input(priceSelector,'1000000');await priceState('1.000.000',9);
    await input(priceSelector,'');await wait(`document.querySelector(${JSON.stringify(priceSelector)}).validity.valueMissing`);
    await input(priceSelector,'0');await priceState('0',1);
    await input(priceSelector,'349000');
    for(const invalid of ['-349000','1e6','9007199254740992']){await input(priceSelector,invalid);await priceState('349.000');}
    await noOverflow();await screenshot('editor-formatted-prices-desktop');
    await clickText('Hình ảnh');
    let expectedImages=[...sample.images];
    await evaluate("document.querySelector('[aria-label=\"Đưa ảnh 2 lên trước\"]').click()");
    [expectedImages[0],expectedImages[1]]=[expectedImages[1],expectedImages[0]];
    await evaluate("document.querySelectorAll('.perfume-gallery > div')[2].querySelector('button').click()");
    expectedImages=[expectedImages[2],...expectedImages.filter((_,index)=>index!==2)];
    await evaluate(`document.querySelector('[aria-label="Bỏ ảnh ${expectedImages.length}"]').click()`);expectedImages.pop();
    const files=['perfume-002.jpg','perfume-003.jpg'].map(file=>path.join(root,'client/public/images/inessa',file));files.forEach(file=>assert.ok(fs.existsSync(file)));
    const chooseFiles=async(selector,files)=>{const {root:documentRoot}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:documentRoot.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId,files});};
    editorUploadImages=[sample.images[1],sample.images[2]];
    await chooseFiles('[aria-label="Thêm ảnh sản phẩm"]',files);expectedImages.push(...editorUploadImages);
    await wait(`document.querySelectorAll('.perfume-gallery > div').length===${expectedImages.length}&&!document.querySelector('button[form]').disabled`);
    editorUploadImages=[sample.images[0]];await chooseFiles('[aria-label="Thay ảnh 1"]',[files[0]]);expectedImages[0]=sample.images[0];
    await wait(`document.querySelector('.perfume-gallery img').getAttribute('src')===${JSON.stringify(getProductImageUrl(expectedImages[0],500))}&&!document.querySelector('button[form]').disabled`);
    await screenshot('editor-gallery-desktop');await clickText('Lưu thay đổi');
    await wait("document.querySelector('button[form]')?.textContent.includes('Lưu thay đổi')&&!document.querySelector('button[form]').disabled");
    await wait(`document.querySelector('.perfume-editor-summary img')?.getAttribute('src')===${JSON.stringify(getProductImageUrl(expectedImages[0],200))}`);
    assert.equal(editorPatches.length,1);assert.equal(editorPatches[0].stockBySize[size],7);assert.equal(editorPatches[0].inventoryMode,'source');
    assert.equal(editorPatches[0].price[size],349000);assert.equal(typeof editorPatches[0].price[size],'number');
    assert.equal(editorPatches[0].assessmentsVisible,undefined);assert.deepEqual(editorPatches[0].images,expectedImages);
    assert.deepEqual(editorPatches[0].accords.map(row=>row.label),['Cam chanh','Gỗ']);
    await goto(`${editorUrl}?tab=assessments`,"document.querySelector('.perfume-assessment-editor')");
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Tỷ lệ Mùa và thời điểm Xuân\"]').value"),'88');
    await goto(`/collection/${sample._id}`,"document.querySelector('.product-detail-experience .perfume-fragrance-charts')");
    assert.equal(await evaluate("Boolean(document.querySelector('.product-detail-experience .perfume-suitability [aria-valuenow=\"88\"]'))&&document.querySelector('.perfume-accord-meters').textContent.includes('Cam chanh')"),true);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    for(const tab of ['fragrance','assessments','variants','images']){await goto(`${editorUrl}?tab=${tab}`,"document.querySelector('.perfume-editor-body')");await noOverflow();await screenshot(`editor-${tab}-mobile`);}
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    checks.push('editor: formatted VND typing/paste/caret/deletion, integer API prices, removed variant helper text, editable accords/experience, per-size quantities and gallery saves (in-memory only)');
  }
  if(popularQA){
    const showPopularSection=async()=>{
      await goto('/',"document.querySelector('.inessa-story-reverse')");
      await evaluate("document.querySelector('.inessa-story-reverse').parentElement.nextElementSibling.scrollIntoView({block:'start',behavior:'instant'})");
      await wait("document.querySelectorAll('.net-popular-products .net-product-card').length===10");
    };
    await showPopularSection();
    assert.match(await evaluate("document.querySelector('.net-popular-products h3').textContent"),/Gợi ý cho bạn/);
    await noOverflow();await screenshot('popular-no-sales-desktop');
    popularResponse={statusCode:200,body:{success:true,products:[{...sample,soldQuantity:5}]}};
    await evaluate("window.dispatchEvent(new Event('focus'))");
    await wait("document.querySelectorAll('.net-popular-products .net-product-card').length===1&&document.querySelector('.net-popular-products h3').textContent.includes('bán chạy')");
    assert.equal(await evaluate("document.querySelector('.net-popular-products .net-product-card').getAttribute('href')"),`/collection/${sample._id}`);
    await screenshot('popular-ranked-desktop');
    popularResponse={statusCode:500,body:{success:false,message:'Không thể tải sản phẩm bán chạy'}};
    await evaluate("window.dispatchEvent(new Event('focus'))");
    await wait("document.querySelector('.net-popular-products [role=\"alert\"]')");
    popularResponse=null;
    await evaluate("document.querySelector('.net-popular-products [role=\"alert\"] button').click()");
    await wait("!document.querySelector('.net-popular-products [role=\"alert\"]')&&document.querySelector('.net-popular-products h3').textContent.includes('Gợi ý cho bạn')&&document.querySelectorAll('.net-popular-products .net-product-card').length===10");
    await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await showPopularSection();await noOverflow();await screenshot('popular-no-sales-mobile');
    await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    checks.push('homepage: no-sales catalog suggestions, paid-sales ranking, API error/retry and mobile rendering');
  }
  if(typographyQA){
    await goto('/',"document.querySelector('#hero-title')");await checkSerif('#hero-title');await noOverflow();await screenshot('typography-home-desktop');
    await goto('/about',"document.querySelector('.inessa-about-hero h1')");await checkSerif('.inessa-about-hero h1');await noOverflow();await screenshot('typography-about-desktop');
    checks.push('Lora font files render Vietnamese serif headings with actual glyphs');
  }
  if(!operationsOnly){
  await goto("/owner","document.querySelectorAll('.admin-metric-card strong')[2]?.textContent.includes('2.444')");await noOverflow();await screenshot("dashboard-desktop");checks.push("overview: 2444 products and zero revenue");
  if(typographyQA)assert.ok((await evaluate("getComputedStyle(document.querySelector('.perfume-page-heading h1')).fontFamily")).includes('Inter'));
  if(dashboardQA){
    await wait("document.querySelectorAll('.admin-overview-table tbody tr').length===5&&document.querySelector('.admin-revenue-chart .recharts-wrapper')");
    assert.equal(await evaluate("document.querySelectorAll('.admin-metric-card').length"),4);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.admin-metric-card.is-primary')).backgroundColor"),'rgb(27, 27, 29)');
    await noOverflow();await screenshot('admin-overview-desktop');
    await evaluate("document.querySelector('.admin-products-panel').scrollIntoView({block:'start',behavior:'instant'})");
    await wait("[...document.querySelectorAll('.admin-overview-table img')].slice(0,3).every(img=>img.complete&&img.naturalWidth>0)");
    assert.equal(await evaluate("Math.abs(document.querySelector('.admin-sidebar').getBoundingClientRect().top-20)<2"),true,'Desktop navigation stays visible while scrolling');
    await screenshot('admin-overview-details');
    await evaluate("(()=>{const select=document.querySelector('[aria-label=\"Khoảng thời gian biểu đồ\"]');select.value='3';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await wait("document.querySelectorAll('.admin-revenue-chart .recharts-xAxis .recharts-cartesian-axis-tick').length===3");
    for(const term of ['Dior','Chanel']){
      await input('[aria-label="Tìm nhanh sản phẩm"]',term);
      await evaluate("document.querySelector('.admin-global-search').requestSubmit()");
      await wait(`document.querySelector('[aria-label="Tìm sản phẩm hoặc ID nguồn"]')?.value===${JSON.stringify(term)}&&document.querySelector('.perfume-product-cell strong')?.textContent.includes(${JSON.stringify(term)})&&!document.querySelector('.perfume-loading')`);
    }
    for(const [url,title] of [['/owner/add-category','Danh mục'],['/owner/add-product','Thêm sản phẩm'],['/owner/vouchers','Mã giảm giá']]){
      await goto(url,`document.querySelector('.velours-admin-route h1')?.textContent.includes(${JSON.stringify(title)})`);
      await noOverflow();await screenshot(`admin-${url.split('/').pop()}-desktop`);
    }
    checks.push('monochrome dashboard, actual metrics, chart period control and repeat global searches');
  }
  await goto("/owner/list-product","document.querySelectorAll('.perfume-table tbody tr').length===25");await noOverflow();
  const firstTitle=await evaluate("document.querySelector('.perfume-product-cell strong').textContent");
  await evaluate("document.querySelector('[aria-label=\"Trang sau\"]').click()");await wait(`document.querySelector('.perfume-product-cell strong')?.textContent!==${JSON.stringify(firstTitle)}&&!document.querySelector('.perfume-loading')`);checks.push("server pagination");
  if(paginationQA){await compactPager('.perfume-pagination nav');await wait("document.activeElement===document.querySelector('.perfume-table')&&document.querySelector('.perfume-table').getBoundingClientRect().top<100");checks.push("catalog pagination scrolls after server rows arrive");}
  await input('[aria-label="Tìm sản phẩm hoặc ID nguồn"]',"Dior");await wait("document.querySelector('.perfume-product-cell strong')?.textContent.includes('Dior')&&!document.querySelector('.perfume-loading')");await screenshot("products-desktop");checks.push("catalog search");
  await goto(`/owner/edit-product/${sample._id}?tab=variants`,"document.querySelector('.perfume-variant-table')");
  assert.equal(await evaluate("Boolean(document.querySelector('input[aria-label^=\"Tồn kho\"]'))"),true);
  await input('[aria-label="Tên dung tích mới"]',"QA 10ml");await clickText("Thêm dung tích");await wait("document.querySelector('.perfume-variant-table').textContent.includes('QA 10ml')");await screenshot("variants-desktop");checks.push("per-size prices, images and source availability; add capacity");
  await clickText("Hồ sơ mùi");await wait("document.querySelector('.perfume-notes-grid textarea')");
  await clickText("Đánh giá trải nghiệm");await wait("document.querySelector('.perfume-fragrance-charts')");
  await clickText("Nguồn dữ liệu");await wait("document.querySelector('.perfume-source-details')");checks.push("fragrance, assessment and preserved source tabs");
  await goto("/owner/library?kind=note","document.querySelector('.perfume-pagination')?.textContent.includes('950')");
  if(paginationQA){await compactPager('.perfume-pagination nav');await selectPage('.perfume-pagination nav','.perfume-table',2);checks.push("library pagination and list scroll");}
  await clickText("Biên tập");await wait("document.querySelector('dialog[open]')");await evaluate("document.querySelector('[aria-label=\"Đóng biên tập\"]').click()");checks.push("950-note library and editor dialog");
  await goto("/owner/orders","document.body.textContent.includes('Chưa có đơn hàng nào')");await screenshot("orders-desktop");checks.push("empty order and revenue dashboard");
  await goto("/collection","document.querySelectorAll('.net-product-card').length===16");await wait("[...document.querySelectorAll('.net-product-media img')].slice(0,4).every(img=>img.complete&&img.naturalWidth>0)");await noOverflow();await screenshot("collection-desktop");checks.push("16 real catalog cards per page, loaded product images and VND prices");
  if(typographyQA){await checkSerif('.inessa-collection-heading h1');await checkSerif('.net-product-card h5');await screenshot('typography-collection-desktop');}
  if(paginationQA){
    await compactPager('.inessa-collection-pagination');
    assert.equal(await evaluate("document.querySelectorAll('.inessa-collection-page-arrows button').length"),2);
    assert.equal(await evaluate("document.querySelector('.inessa-collection-page-arrows [aria-label=\"Trang trước\"]').disabled"),true);
    await evaluate("document.querySelector('.inessa-collection-page-arrows [aria-label=\"Trang sau\"]').click()");
    await wait("document.querySelector('.inessa-collection-pagination [aria-current=\"page\"]')?.textContent==='2'&&document.activeElement===document.querySelector('.inessa-collection-grid')&&Math.abs(document.querySelector('.inessa-collection-grid').getBoundingClientRect().top-100)<3");
    await evaluate("document.querySelector('.inessa-collection-page-arrows [aria-label=\"Trang trước\"]').click()");
    await wait("document.querySelector('.inessa-collection-pagination [aria-current=\"page\"]')?.textContent==='1'&&document.querySelector('.inessa-collection-page-arrows [aria-label=\"Trang trước\"]').disabled");
    await screenshot('collection-toolbar-arrows-desktop');
    const firstProduct=await evaluate("document.querySelector('.net-product-card').textContent");
    await selectPage('.inessa-collection-pagination','.inessa-collection-grid',2);
    assert.notEqual(await evaluate("document.querySelector('.net-product-card').textContent"),firstProduct);
    await selectPage('.inessa-collection-pagination','.inessa-collection-grid',5);await compactPager('.inessa-collection-pagination');await screenshot('pagination-desktop');
    const lastCollectionPage=await evaluate("Math.max(...[...document.querySelectorAll('.inessa-collection-pagination button')].map(button=>Number(button.textContent)).filter(Number.isInteger))");
    await selectPage('.inessa-collection-pagination','.inessa-collection-grid',lastCollectionPage);
    assert.equal(await evaluate("document.querySelector('.inessa-collection-pagination [aria-label=\"Trang sau\"]').disabled"),true);
    assert.equal(await evaluate("document.querySelector('.inessa-collection-page-arrows [aria-label=\"Trang sau\"]').disabled"),true);
    await selectPage('.inessa-collection-pagination','.inessa-collection-grid',1);
    checks.push(`${lastCollectionPage} pages: compact beginning/middle/end, synchronized toolbar arrows and scroll to first product row`);
  }
  await goto(`/collection/${sample._id}`,"document.querySelector('.product-description-copy')");
  assert.equal(await evaluate("Boolean(document.querySelector('.product-detail-experience .perfume-fragrance-charts'))"),true);
  const detailImage='[aria-label="Thư viện ảnh sản phẩm"] img:not([alt=""])';
  await wait(`(()=>{const img=document.querySelector(${JSON.stringify(detailImage)});return img?.complete&&img.naturalWidth>0})()`);
  const excludedAvatar=[sample.images[0],getProductImageUrl(sample.images[0],160),getProductImageUrl(sample.images[0],960)];
  assert.equal(await evaluate(`(()=>{const excluded=${JSON.stringify(excludedAvatar)};return [...document.querySelectorAll('[aria-label="Thư viện ảnh sản phẩm"] img')].every(img=>!excluded.includes(img.src))})()`),true,"Detail gallery must not contain the product avatar");
  const originalDetailSrc=await evaluate(`document.querySelector(${JSON.stringify(detailImage)}).src`);
  await evaluate("document.querySelector('[aria-label=\"Xem ảnh sản phẩm 2\"]').click()");
  await wait(`(()=>{const img=document.querySelector(${JSON.stringify(detailImage)});return img?.src!==${JSON.stringify(originalDetailSrc)}&&img?.complete&&img.naturalWidth>0})()`);
  checks.push("loaded detail image and gallery selection, with the product avatar excluded");
  if(paginationQA){await evaluate("document.querySelector('[data-product-tab=\"reviews\"]').click()");await wait("document.querySelector('[aria-label=\"Phân trang đánh giá\"]')");await selectPage('[aria-label="Phân trang đánh giá"]','#reviews .pagination-list-start',2);checks.push("asynchronous review pagination scroll");}
  assert.equal(await evaluate("document.body.textContent.includes('100 sản phẩm còn trong kho')"),false);await noOverflow();await screenshot("detail-desktop");checks.push("public perfume profile and source inventory copy");
  await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await goto("/owner","document.querySelectorAll('.admin-metric-card strong')[2]?.textContent.includes('2.444')");await noOverflow();await screenshot("dashboard-mobile");
  if(dashboardQA){
    await wait("document.querySelectorAll('.admin-overview-table tbody tr').length===5");
    await screenshot('admin-overview-mobile');
    await evaluate("document.querySelector('.admin-menu-toggle').click()");
    await wait("document.querySelector('.admin-sidebar').classList.contains('is-open')&&document.querySelector('.admin-sidebar').getBoundingClientRect().left>=0");
    await screenshot('admin-mobile-navigation');
    await wait("document.activeElement===document.querySelector('.admin-brand')");
    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}))");
    assert.equal(await evaluate("document.activeElement===document.querySelector('.admin-sidebar-footer button')"),true);
    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
    await wait("!document.querySelector('.admin-sidebar').classList.contains('is-open')");
    assert.equal(await evaluate("document.activeElement===document.querySelector('.admin-menu-toggle')&&document.body.style.overflow!=='hidden'"),true);
    await evaluate("document.querySelector('.admin-menu-toggle').click();document.querySelector('.admin-nav-group a[href=\"/owner/list-product\"]').click()");
    await wait("location.pathname==='/owner/list-product'&&document.querySelectorAll('.perfume-table tbody tr').length===25&&!document.querySelector('.admin-sidebar').classList.contains('is-open')");
    await noOverflow();
    await send("Emulation.setDeviceMetricsOverride",{width:320,height:760,deviceScaleFactor:1,mobile:true});
    await goto('/owner',"document.querySelectorAll('.admin-metric-card strong')[2]?.textContent.includes('2.444')");await noOverflow();await screenshot('admin-overview-320');
    await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
    for(const [url,title] of [['/owner/add-category','Danh mục'],['/owner/add-product','Thêm sản phẩm'],['/owner/vouchers','Mã giảm giá']]){
      await goto(url,`document.querySelector('.velours-admin-route h1')?.textContent.includes(${JSON.stringify(title)})`);
      await noOverflow();await screenshot(`admin-${url.split('/').pop()}-mobile`);
    }
    checks.push('responsive 390px/320px dashboard and mobile menu, Escape dismissal and unified product navigation');
  }
  await goto("/owner/list-product","document.querySelectorAll('.perfume-table tbody tr').length===25");await noOverflow();await screenshot("products-mobile");
  await goto(`/owner/edit-product/${sample._id}?tab=variants`,"document.querySelector('.perfume-variant-table')");await noOverflow();await screenshot("variants-mobile");
  await goto("/collection","document.querySelectorAll('.net-product-card').length===16");await wait("[...document.querySelectorAll('.net-product-media img')].slice(0,2).every(img=>img.complete&&img.naturalWidth>0)");await noOverflow();await screenshot("collection-mobile");checks.push("390px responsive layouts without horizontal document overflow");
  if(typographyQA){
    await checkSerif('.inessa-collection-heading h1');await screenshot('typography-collection-mobile');
    await goto('/',"document.querySelector('#hero-title')");await checkSerif('#hero-title');await noOverflow();await screenshot('typography-home-mobile');
    await send("Emulation.setDeviceMetricsOverride",{width:320,height:760,deviceScaleFactor:1,mobile:true});await noOverflow();await screenshot('typography-home-320');
    checks.push('Vietnamese typography: desktop, 390px and 320px layouts');
  }
  if(paginationQA){
    await compactPager('.inessa-collection-pagination');await selectPage('.inessa-collection-pagination','.inessa-collection-grid',5);await noOverflow();await screenshot('pagination-mobile');
    await send("Emulation.setDeviceMetricsOverride",{width:320,height:760,deviceScaleFactor:1,mobile:true});await compactPager('.inessa-collection-pagination');await noOverflow();
    assert.equal(await evaluate("(()=>{const arrows=document.querySelector('.inessa-collection-page-arrows').getBoundingClientRect();const select=document.querySelector('.inessa-collection-sort-tools select').getBoundingClientRect();return arrows.left>=select.right-1&&Math.abs((arrows.top+arrows.bottom)/2-(select.top+select.bottom)/2)<3})()"),true);
    await evaluate("document.querySelector('.inessa-collection-toolbar').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('collection-toolbar-arrows-mobile');
    await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await goto('/owner/messages',"document.querySelector('[aria-label=\"Phân trang hội thoại\"]')");
    await compactPager('[aria-label="Phân trang hội thoại"]');
    await evaluate("document.querySelector('.net-admin-messages .overflow-y-auto').scrollTop=3000");
    await selectPage('[aria-label="Phân trang hội thoại"]','.net-admin-messages .pagination-list-start',2,'.net-admin-messages .overflow-y-auto');
    await wait("document.querySelector('.net-admin-messages .overflow-y-auto').scrollTop<5");
    checks.push('compact 320px pagination and conversation list scroll');
  }
  }
  }
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(artifacts,"result.json"),JSON.stringify({passed:true,checks,errors,actualDatabaseReads:true,mockedAuthentication:!builtCollectionQA&&!builtKnowledgeQA&&!builtPoliciesQA,builtArtifact:builtArtifactQA,paginationFixtures:paginationQA,popularFixtures:popularQA,editorFixtures:editorQA,editorFixtureSaves:editorPatches.length,operationsFixtures:operationsQA,operationsFixtureActions:operationsFixtures?.requests.length||0,typography:typographyQA,dashboardDesign:dashboardQA,databaseWrites:0},null,2));
  console.log(JSON.stringify({passed:true,checks,screenshots:artifacts,databaseWrites:0,...(libraryFixtures?{libraryFixtureActions:libraryFixtures.requests.length}:{})}));
}finally{
  try{if(ws?.readyState===1)await send("Browser.close");}catch{}ws?.close();chrome?.kill();vite?.kill();
  await Promise.allSettled([...inFlightReads]);await mongoose.disconnect();
}
