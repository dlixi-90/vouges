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
import {catalogSummary,catalogProducts,catalogProduct,libraryTerms} from "../controllers/catalogController.js";
import {listProduct,singleProduct,listPopularProducts} from "../controllers/productController.js";
import {listBrands} from "../controllers/brandController.js";
import {listCategories} from "../controllers/categoryController.js";
import {dashboard} from "../controllers/dashboardController.js";
import {listVouchers} from "../controllers/voucherController.js";
import Product from "../models/Product.js";
import {getProductImageUrl} from "../../client/src/utils/productImage.js";
import {sanitizeFragranceRows} from "../services/fragranceEditing.js";
import {createOperationsFixtures} from "./qa/operationsFixtures.mjs";
import accordPalette from "../../client/src/data/accordColors.json" with { type: "json" };
import {getAccordColors} from "../../client/src/utils/accordColors.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const artifacts=path.join(root,".qa-perfume");fs.mkdirSync(artifacts,{recursive:true});
const profile=path.join(artifacts,"chrome-profile");
const frontend="http://localhost:5188";
const paginationQA=process.argv.includes("--pagination");
const typographyQA=process.argv.includes("--typography");
const dashboardQA=process.argv.includes("--dashboard-design");
const popularQA=process.argv.includes("--popular-products");
const editorQA=process.argv.includes("--editor-fields");
const operationsQA=process.argv.includes("--operations-ui");
const brandsQA=process.argv.includes("--brand-menu");
const productTabsQA=process.argv.includes("--product-tabs");
const accordsQA=process.argv.includes("--accord-colors");
const experienceQA=process.argv.includes("--experience-design");
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
export const useClerk=()=>({openSignIn});
export const ClerkProvider=({children})=>children;
export const UserButton=()=>React.createElement('span',null,'QA');
UserButton.MenuItems=({children})=>children;UserButton.Action=()=>null;UserButton.Link=()=>null;`;

const call=async(handler,req)=>{
  const res={statusCode:200,status(code){this.statusCode=code;return this;},set(){},json(body){this.body=body;return this;}};
  await handler({...req,user:{_id:"qa-owner",role:"owner"},auth:()=>({userId:"qa-owner"})},res);return res;
};
const api=async request=>{
  const url=new URL(request.url),pathname=url.pathname;const req={query:Object.fromEntries(url.searchParams),params:{}};
  if(request.method==="OPTIONS")return {statusCode:204,body:null};
  if(operationsActive){const fixture=operationsFixtures.respond(request);if(fixture)return fixture;}
  // These edits live only in the browser harness; never pass writes to MongoDB.
  if(editorQA&&editorProduct&&request.method==="PATCH"&&pathname===`/api/catalog/products/${editorProduct._id}`){
    const body=JSON.parse(request.postData);editorPatches.push(body);
    assert.equal(body.expectedUpdatedAt,editorProduct.updatedAt);
    const fragrance={...editorProduct.fragrance,group:body.group,style:body.style,notes:body.notes,assessmentsVisible:true};
    for(const field of ['accords','longevity','sillage','suitability'])fragrance[field]=sanitizeFragranceRows(field,body[field],editorProduct.fragrance[field]);
    const inStockBySize=Object.fromEntries(body.sizes.map(size=>[size,Boolean(body.inStockBySize[size]&&body.price[size]>0&&(body.inventoryMode==='source'||body.stockBySize[size]>0))]));
    const sizeImages=Object.fromEntries(body.sizes.filter(size=>body.sizeImages[size]).map(size=>[size,body.sizeImages[size]]));
    editorProduct={...editorProduct,fragrance,images:body.images,sizes:body.sizes,inventoryMode:body.inventoryMode,stockBySize:body.stockBySize,price:body.price,inStockBySize,sizeImages,inStock:Object.values(inStockBySize).some(Boolean),updatedAt:new Date().toISOString()};
    return {statusCode:200,body:{success:true,product:editorProduct}};
  }
  if(editorQA&&request.method==="POST"&&pathname==="/api/catalog/media")return {statusCode:200,body:{success:true,images:editorUploadImages}};
  if(request.method!=="GET"){writes.push({method:request.method,path:pathname,body:request.postData});return {statusCode:405,body:{success:false,message:"Browser QA is read-only"}};}
  if(pathname==="/api/users")return {statusCode:200,body:{success:true,role:"owner",cartData:{},cartAddedAt:{}}};
  if(pathname==="/api/catalog/summary")return call(catalogSummary,req);
  if(pathname==="/api/catalog/products")return call(catalogProducts,req);
  if(pathname.startsWith("/api/catalog/products/")){req.params.id=pathname.split("/").pop();const result=await call(catalogProduct,req);if(editorQA&&req.params.id===editorProduct?._id)result.body.product=editorProduct;return result;}
  if(pathname==="/api/catalog/terms")return call(libraryTerms,req);
  if(pathname==="/api/products")return call(listProduct,req);
  if(pathname==="/api/products/brands")return call(listBrands,req);
  if(pathname==="/api/products/single"){const result=await call(singleProduct,req);if(editorQA&&req.query.productId===editorProduct?._id)result.body.product=editorProduct;return result;}
  if(pathname==="/api/products/popular")return popularQA&&popularResponse ? popularResponse : call(listPopularProducts,req);
  if(pathname==="/api/categories")return call(listCategories,req);
  if(pathname==="/api/orders/dashboard")return call(dashboard,req);
  if(pathname==="/api/vouchers")return call(listVouchers,req);
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
  const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error(`CDP timeout: ${method}`));},15000);
  pending.set(requestId,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id:requestId,method,params}));
});
const evaluate=async(expression)=>{
  const result=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
};
const wait=async(expression)=>{const started=Date.now();while(Date.now()-started<25000){try{if(await evaluate(`Boolean(${expression})`))return;}catch{}await pause(150);}throw new Error(`UI timeout ${expression}: ${await evaluate('document.body.innerText.slice(0,800)')}`);};
const goto=async(url,condition)=>{await evaluate('window.__oldQaDocument=true');await send("Page.navigate",{url:frontend+url});await wait(`!window.__oldQaDocument&&(${condition})`);};
const screenshot=async(name)=>{const result=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});fs.writeFileSync(path.join(artifacts,`${name}.png`),Buffer.from(result.data,"base64"));};
const clickText=async(text)=>evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!button)throw new Error('Missing button');button.click();return true;})()`);
const input=async(selector,value)=>evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw new Error('Missing input');Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
const noOverflow=async()=>assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),true,"Document overflows horizontally");
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
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
  const sample=await Product.findOne({isPublished:true,inStock:true,"sizes.1":{$exists:true},"fragrance.notes.top.0":{$exists:true},...(editorQA?{"images.2":{$exists:true}}:{})}).lean();
  assert.ok(sample);
  if(operationsQA)operationsFixtures=createOperationsFixtures(sample);
  if(editorQA)editorProduct={...JSON.parse(JSON.stringify(sample)),fragrance:{...sample.fragrance,accords:[],assessmentsVisible:false}};
  vite=spawn(process.execPath,[path.join(root,"client/node_modules/vite/bin/vite.js"),"--host","127.0.0.1","--port","5188","--strictPort"],{cwd:path.join(root,"client"),windowsHide:true,stdio:"ignore"});
  for(let i=0;i<100;i++){try{if((await fetch(frontend)).ok)break;}catch{}await pause(150);}
  chrome=spawn("C:/Program Files/Google/Chrome/Application/chrome.exe",["--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-allow-origins=*","--remote-debugging-port=9288",`--user-data-dir=${profile}`,"about:blank"],{windowsHide:true,stdio:"ignore"});
  let target;for(let i=0;i<100;i++){try{target=(await(await fetch("http://127.0.0.1:9288/json/list")).json()).find(t=>t.type==="page");if(target)break;}catch{}await pause(150);}assert.ok(target);
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=async event=>{
    const data=JSON.parse(event.data);if(data.id){const item=pending.get(data.id);if(item){pending.delete(data.id);data.error?item.reject(new Error(JSON.stringify(data.error))):item.resolve(data.result);}return;}
    if(data.method==="Runtime.exceptionThrown")errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
    if(data.method==="Fetch.requestPaused"){
      const {requestId,request}=data.params;
      try{
        let result,mime;
        if(request.url.includes("@clerk_react")){result={statusCode:200,body:fakeClerk};mime="text/javascript";}
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
  if(typographyQA||editorQA)await send('DOM.enable');
  if(typographyQA)await send('CSS.enable');
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send("Fetch.enable",{patterns:[{urlPattern:"*localhost:3000/*"},{urlPattern:"*@clerk_react*"}]});
  if(brandsQA){
    const directory=await call(listBrands,{}),brands=directory.body.brands;
    assert.ok(brands.length>100&&brands.every(brand=>brand.image));
    const chanel=brands.find(brand=>brand.name==='Chanel');
    const chanelIds=(await Product.find({brand:'Chanel'}).select('_id').lean()).map(product=>String(product._id));
    await goto('/collection',"document.querySelectorAll('.net-product-card').length===16");
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
    assert.equal(await evaluate(`(()=>{const allowed=${JSON.stringify(chanelIds)};return [...document.querySelectorAll('.net-product-card')].every(link=>allowed.includes(link.getAttribute('href').split('/').pop()))&&document.querySelector('[aria-label="Tìm kiếm sản phẩm"]').value===''&&!document.querySelector('.store-brand-dropdown')})()`),true);
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
    await evaluate("document.querySelector('[data-product-tab=\"profile\"]').click()");await wait("document.querySelector('.perfume-fragrance-charts').getBoundingClientRect().height>0");
    await checkRows('.perfume-profile');
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
      await evaluate("document.querySelector('[data-product-tab=\"profile\"]').click()");await wait("document.querySelector('.perfume-fragrance-charts').getBoundingClientRect().height>0");
      await checkRows('.perfume-profile');await noOverflow();
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
    await evaluate("document.querySelector('[data-product-tab=\"profile\"]').click()");
    await wait("document.querySelector('.perfume-accord-meters').getBoundingClientRect().height>0");
    await evaluate("document.querySelector('.perfume-accord-meters').scrollIntoView({block:'center',behavior:'instant'})");
    await inspect('.perfume-profile',expected);await noOverflow();await screenshot('accord-colors-detail-desktop');
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
      await evaluate("document.querySelector('[data-product-tab=\"profile\"]').click()");
      await wait("document.querySelector('.perfume-accord-meters').getBoundingClientRect().height>0");
      await evaluate("document.querySelector('.perfume-accord-meters').scrollIntoView({block:'center',behavior:'instant'})");
      await inspect('.perfume-profile',expected);await noOverflow();await screenshot(`accord-colors-detail-${width}`);
    }
    checks.push('68 exact source accord colors, proportional vertical bars, matching dashboard preview, unsaved edits, tiny/zero/unknown values and 390px/320px layouts');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  }
  if(productTabsQA){
    await goto(`/collection/${sample._id}`,"document.querySelectorAll('[data-product-tab]').length===3&&document.querySelector('.product-description-copy p')?.textContent.trim()");
    const currentTab=tab=>`document.querySelector('[data-product-tab="${tab}"]')?.getAttribute('aria-selected')==='true'`;
    assert.equal(await evaluate(currentTab('description')),true);
    assert.equal(await evaluate("document.querySelectorAll('.product-detail-tab-panel:not([hidden])').length===1&&!document.querySelector('#pair-with-title')&&!document.querySelector('[aria-label=\"Thông tin sản phẩm\"] [aria-expanded]')"),true);
    assert.equal(await evaluate("(()=>{const tabs=document.querySelector('.product-detail-tabs').getBoundingClientRect(),detail=document.querySelector('.net-product-detail');const style=getComputedStyle(detail);return Math.abs(tabs.width-(detail.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)))<2})()"),true);
    await evaluate("document.querySelector('.product-detail-tabs').scrollIntoView({block:'start',behavior:'instant'})");await screenshot('detail-tabs-description-desktop');
    await evaluate("document.querySelector('[data-product-tab=\"profile\"]').click()");await wait(currentTab('profile'));
    assert.equal(await evaluate("document.querySelector('.perfume-profile .perfume-fragrance-charts').getBoundingClientRect().height>0"),true);
    await noOverflow();await screenshot('detail-tabs-profile-desktop');
    await evaluate("document.querySelector('[data-product-tab=\"profile\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}))");
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
      for(const tab of ['profile','reviews']){
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
    const priceState=async(value,caret)=>wait(`(()=>{const price=document.querySelector(${JSON.stringify(priceSelector)});return price.value===${JSON.stringify(value)}${caret==null?'':`&&price.selectionStart===${caret}`}})()`);
    const caretAt=async(start,end=start)=>evaluate(`(()=>{const price=document.querySelector(${JSON.stringify(priceSelector)});price.focus();price.setSelectionRange(${start},${end});})()`);
    const key=async key=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});};
    assert.equal(await evaluate("!document.querySelector('.admin-brand-caption')&&!document.querySelector('.perfume-inventory-notice')&&!document.querySelector('.perfume-variant-table small')&&!document.querySelector('.perfume-variant-table').textContent.includes('Trạng thái nguồn')"),true);
    await evaluate(`document.querySelector(${JSON.stringify(priceSelector)}).focus()`);
    await input(priceSelector,'349000');await priceState('349.000',7);
    await send('Input.insertText',{text:'0'});await priceState('3.490.000',9);
    await input(priceSelector,'349000');await caretAt(4);await key('Backspace');await priceState('34.000',2);
    await input(priceSelector,'349000');await caretAt(3);await key('Delete');await priceState('34.900',4);
    await input(priceSelector,'1234567');await caretAt(3);await send('Input.insertText',{text:'9'});await priceState('12.934.567',4);
    await caretAt(0,10);await send('Input.insertText',{text:'2.000.000 ₫'});await priceState('2.000.000',9);
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
    await goto(`/collection/${sample._id}`,"document.querySelector('.perfume-profile .perfume-fragrance-charts')");
    assert.equal(await evaluate("Boolean(document.querySelector('.perfume-profile .perfume-suitability [aria-valuenow=\"88\"]'))&&document.querySelector('.perfume-accord-meters').textContent.includes('Cam chanh')"),true);
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
  await goto("/owner","document.querySelector('.perfume-source-count')?.textContent.includes('2.444')");await noOverflow();await screenshot("dashboard-desktop");checks.push("overview: 2444 products and zero revenue");
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
  await goto(`/collection/${sample._id}`,"document.querySelector('.perfume-profile')");
  assert.equal(await evaluate("Boolean(document.querySelector('.perfume-profile .perfume-fragrance-charts'))"),true);
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
  await goto("/owner","document.querySelector('.perfume-source-count')?.textContent.includes('2.444')");await noOverflow();await screenshot("dashboard-mobile");
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
    await evaluate("document.querySelector('.admin-menu-toggle').click();document.querySelector('.admin-nav-group a[href=\"/owner/inventory\"]').click()");
    await wait("location.pathname==='/owner/inventory'&&document.querySelectorAll('.perfume-table tbody tr').length===25&&!document.querySelector('.admin-sidebar').classList.contains('is-open')");
    await noOverflow();
    await send("Emulation.setDeviceMetricsOverride",{width:320,height:760,deviceScaleFactor:1,mobile:true});
    await goto('/owner',"document.querySelector('.perfume-source-count')?.textContent.includes('2.444')");await noOverflow();await screenshot('admin-overview-320');
    await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
    for(const [url,title] of [['/owner/add-category','Danh mục'],['/owner/add-product','Thêm sản phẩm'],['/owner/vouchers','Mã giảm giá']]){
      await goto(url,`document.querySelector('.velours-admin-route h1')?.textContent.includes(${JSON.stringify(title)})`);
      await noOverflow();await screenshot(`admin-${url.split('/').pop()}-mobile`);
    }
    checks.push('responsive 390px/320px dashboard and mobile menu, Escape dismissal and inventory navigation');
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
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(artifacts,"result.json"),JSON.stringify({passed:true,checks,errors,actualDatabaseReads:true,mockedAuthentication:true,paginationFixtures:paginationQA,popularFixtures:popularQA,editorFixtures:editorQA,editorFixtureSaves:editorPatches.length,operationsFixtures:operationsQA,operationsFixtureActions:operationsFixtures?.requests.length||0,typography:typographyQA,dashboardDesign:dashboardQA,databaseWrites:0},null,2));
  console.log(JSON.stringify({passed:true,checks,screenshots:artifacts,databaseWrites:0}));
}finally{
  try{if(ws?.readyState===1)await send("Browser.close");}catch{}ws?.close();chrome?.kill();vite?.kill();
  await Promise.allSettled([...inFlightReads]);await mongoose.disconnect();
}
