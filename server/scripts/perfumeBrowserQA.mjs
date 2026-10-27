// Local browser harness: real database reads, mocked Clerk identity, and no writes.
// The production server and its authentication middleware are never modified.
// --pagination adds temporary review/inbox fixtures in the browser only.
import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawn} from "node:child_process";
import mongoose from "mongoose";
import {catalogSummary,catalogProducts,catalogProduct,libraryTerms} from "../controllers/catalogController.js";
import {listProduct,singleProduct,listPopularProducts} from "../controllers/productController.js";
import {listCategories} from "../controllers/categoryController.js";
import {dashboard} from "../controllers/dashboardController.js";
import Product from "../models/Product.js";
import {getProductImageUrl} from "../../client/src/utils/productImage.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const artifacts=path.join(root,".qa-perfume");fs.mkdirSync(artifacts,{recursive:true});
const profile=path.join(artifacts,"chrome-profile");
const frontend="http://localhost:5188";
const paginationQA=process.argv.includes("--pagination");
const typographyQA=process.argv.includes("--typography");
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
  if(request.method!=="GET"){writes.push({method:request.method,path:pathname,body:request.postData});return {statusCode:405,body:{success:false,message:"Browser QA is read-only"}};}
  if(pathname==="/api/users")return {statusCode:200,body:{success:true,role:"owner",cartData:{},cartAddedAt:{}}};
  if(pathname==="/api/catalog/summary")return call(catalogSummary,req);
  if(pathname==="/api/catalog/products")return call(catalogProducts,req);
  if(pathname.startsWith("/api/catalog/products/")){req.params.id=pathname.split("/").pop();return call(catalogProduct,req);}
  if(pathname==="/api/catalog/terms")return call(libraryTerms,req);
  if(pathname==="/api/products")return call(listProduct,req);
  if(pathname==="/api/products/single")return call(singleProduct,req);
  if(pathname==="/api/products/popular")return call(listPopularProducts,req);
  if(pathname==="/api/categories")return call(listCategories,req);
  if(pathname==="/api/orders/dashboard")return call(dashboard,req);
  if(pathname.endsWith("/reviews/mine"))return {statusCode:200,body:{success:true,review:null,canReview:false}};
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
const input=async(selector,value)=>evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw new Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
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
  const sample=await Product.findOne({isPublished:true,inStock:true,"sizes.1":{$exists:true},"fragrance.notes.top.0":{$exists:true}}).lean();
  assert.ok(sample);
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
        await send("Fetch.fulfillRequest",{requestId,responseCode:result.statusCode,responseHeaders:[{name:"Content-Type",value:mime},{name:"Access-Control-Allow-Origin",value:frontend},{name:"Access-Control-Allow-Headers",value:"Authorization,Content-Type"},{name:"Access-Control-Allow-Methods",value:"GET,PATCH,POST,OPTIONS"}],body:Buffer.from(typeof result.body==="string"?result.body:JSON.stringify(result.body)).toString("base64")});
      }catch(error){
        // Navigation can cancel a paused request before its database read finishes.
        if(error.message==='{"code":-32602,"message":"Invalid InterceptionId."}')return;
        errors.push(error.message);try{await send("Fetch.failRequest",{requestId,errorReason:"Failed"});}catch{}
      }
    }
  };
  await send("Page.enable");await send("Runtime.enable");
  if(typographyQA){await send('DOM.enable');await send('CSS.enable');}
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send("Fetch.enable",{patterns:[{urlPattern:"*localhost:3000/*"},{urlPattern:"*@clerk_react*"}]});
  if(typographyQA){
    await goto('/',"document.querySelector('#hero-title')");await checkSerif('#hero-title');await noOverflow();await screenshot('typography-home-desktop');
    await goto('/about',"document.querySelector('.inessa-about-hero h1')");await checkSerif('.inessa-about-hero h1');await noOverflow();await screenshot('typography-about-desktop');
    checks.push('Lora font files render Vietnamese serif headings with actual glyphs');
  }
  await goto("/owner","document.querySelector('.perfume-source-count')?.textContent.includes('2.444')");await noOverflow();await screenshot("dashboard-desktop");checks.push("overview: 2444 products and zero revenue");
  if(typographyQA)await checkSerif('.perfume-page-heading h1');
  await goto("/owner/list-product","document.querySelectorAll('.perfume-table tbody tr').length===25");await noOverflow();
  const firstTitle=await evaluate("document.querySelector('.perfume-product-cell strong').textContent");
  await evaluate("document.querySelector('[aria-label=\"Trang sau\"]').click()");await wait(`document.querySelector('.perfume-product-cell strong')?.textContent!==${JSON.stringify(firstTitle)}&&!document.querySelector('.perfume-loading')`);checks.push("server pagination");
  if(paginationQA){await compactPager('.perfume-pagination nav');await wait("document.activeElement===document.querySelector('.perfume-table')&&document.querySelector('.perfume-table').getBoundingClientRect().top<100");checks.push("catalog pagination scrolls after server rows arrive");}
  await input('[aria-label="Tìm sản phẩm hoặc ID nguồn"]',"Dior");await wait("document.querySelector('.perfume-product-cell strong')?.textContent.includes('Dior')&&!document.querySelector('.perfume-loading')");await screenshot("products-desktop");checks.push("catalog search");
  await goto(`/owner/edit-product/${sample._id}?tab=variants`,"document.querySelector('.perfume-variant-table')");
  assert.equal(await evaluate("Boolean(document.querySelector('input[aria-label^=\"Tồn kho\"]'))"),false);
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
  const detailImage='[aria-label="Thư viện ảnh sản phẩm"] img:not([alt=""])';
  await wait(`(()=>{const img=document.querySelector(${JSON.stringify(detailImage)});return img?.complete&&img.naturalWidth>0})()`);
  const excludedAvatar=[sample.images[0],getProductImageUrl(sample.images[0],160),getProductImageUrl(sample.images[0],960)];
  assert.equal(await evaluate(`(()=>{const excluded=${JSON.stringify(excludedAvatar)};return [...document.querySelectorAll('[aria-label="Thư viện ảnh sản phẩm"] img')].every(img=>!excluded.includes(img.src))})()`),true,"Detail gallery must not contain the product avatar");
  const originalDetailSrc=await evaluate(`document.querySelector(${JSON.stringify(detailImage)}).src`);
  await evaluate("document.querySelector('[aria-label=\"Xem ảnh sản phẩm 2\"]').click()");
  await wait(`(()=>{const img=document.querySelector(${JSON.stringify(detailImage)});return img?.src!==${JSON.stringify(originalDetailSrc)}&&img?.complete&&img.naturalWidth>0})()`);
  checks.push("loaded detail image and gallery selection, with the product avatar excluded");
  if(paginationQA){await wait("document.querySelector('[aria-label=\"Phân trang đánh giá\"]')");await selectPage('[aria-label="Phân trang đánh giá"]','#reviews .pagination-list-start',2);checks.push("asynchronous review pagination scroll");}
  assert.equal(await evaluate("document.body.textContent.includes('100 sản phẩm còn trong kho')"),false);await noOverflow();await screenshot("detail-desktop");checks.push("public perfume profile and source inventory copy");
  await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await goto("/owner","document.querySelector('.perfume-source-count')?.textContent.includes('2.444')");await noOverflow();await screenshot("dashboard-mobile");
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
  fs.writeFileSync(path.join(artifacts,"result.json"),JSON.stringify({passed:true,checks,errors,actualDatabaseReads:true,mockedAuthentication:true,paginationFixtures:paginationQA,typography:typographyQA,databaseWrites:0},null,2));
  console.log(JSON.stringify({passed:true,checks,screenshots:artifacts,databaseWrites:0}));
}finally{
  try{if(ws?.readyState===1)await send("Browser.close");}catch{}ws?.close();chrome?.kill();vite?.kill();
  await Promise.allSettled([...inFlightReads]);await mongoose.disconnect();
}
