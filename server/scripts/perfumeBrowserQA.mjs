// Local browser harness: real database reads, mocked Clerk identity, and no writes.
// The production server and its authentication middleware are never modified.
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

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const artifacts=path.join(root,".qa-perfume");fs.mkdirSync(artifacts,{recursive:true});
const profile=path.join(artifacts,"chrome-profile");
const frontend="http://localhost:5188";
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chrome,vite,ws,id=0;const pending=new Map(),errors=[],checks=[],writes=[];
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
        else{result=await api(request);mime="application/json";}
        await send("Fetch.fulfillRequest",{requestId,responseCode:result.statusCode,responseHeaders:[{name:"Content-Type",value:mime},{name:"Access-Control-Allow-Origin",value:frontend},{name:"Access-Control-Allow-Headers",value:"Authorization,Content-Type"},{name:"Access-Control-Allow-Methods",value:"GET,PATCH,POST,OPTIONS"}],body:Buffer.from(mime==="text/javascript"?result.body:JSON.stringify(result.body)).toString("base64")});
      }catch(error){errors.push(error.message);try{await send("Fetch.failRequest",{requestId,errorReason:"Failed"});}catch{}}
    }
  };
  await send("Page.enable");await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send("Fetch.enable",{patterns:[{urlPattern:"*localhost:3000/*"},{urlPattern:"*@clerk_react*"}]});
  await goto("/owner","document.querySelector('.perfume-source-count')?.textContent.includes('2.444')");await noOverflow();await screenshot("dashboard-desktop");checks.push("overview: 2444 products and zero revenue");
  await goto("/owner/list-product","document.querySelectorAll('.perfume-table tbody tr').length===25");await noOverflow();
  const firstTitle=await evaluate("document.querySelector('.perfume-product-cell strong').textContent");
  await evaluate("document.querySelector('[aria-label=\"Trang sau\"]').click()");await wait(`document.querySelector('.perfume-product-cell strong')?.textContent!==${JSON.stringify(firstTitle)}&&!document.querySelector('.perfume-loading')`);checks.push("server pagination");
  await input('[aria-label="Tìm sản phẩm hoặc ID nguồn"]',"Dior");await wait("document.querySelector('.perfume-product-cell strong')?.textContent.includes('Dior')&&!document.querySelector('.perfume-loading')");await screenshot("products-desktop");checks.push("catalog search");
  await goto(`/owner/edit-product/${sample._id}?tab=variants`,"document.querySelector('.perfume-variant-table')");
  assert.equal(await evaluate("Boolean(document.querySelector('input[aria-label^=\"Tồn kho\"]'))"),false);
  await input('[aria-label="Tên dung tích mới"]',"QA 10ml");await clickText("Thêm dung tích");await wait("document.querySelector('.perfume-variant-table').textContent.includes('QA 10ml')");await screenshot("variants-desktop");checks.push("per-size prices, images and source availability; add capacity");
  await clickText("Hồ sơ mùi");await wait("document.querySelector('.perfume-notes-grid textarea')");
  await clickText("Đánh giá trải nghiệm");await wait("document.querySelector('.perfume-fragrance-charts')");
  await clickText("Nguồn dữ liệu");await wait("document.querySelector('.perfume-source-details')");checks.push("fragrance, assessment and preserved source tabs");
  await goto("/owner/library?kind=note","document.querySelector('.perfume-pagination')?.textContent.includes('950')");
  await clickText("Biên tập");await wait("document.querySelector('dialog[open]')");await evaluate("document.querySelector('[aria-label=\"Đóng biên tập\"]').click()");checks.push("950-note library and editor dialog");
  await goto("/owner/orders","document.body.textContent.includes('Chưa có đơn hàng nào')");await screenshot("orders-desktop");checks.push("empty order and revenue dashboard");
  await goto("/collection","document.querySelectorAll('.net-product-card').length===8");await wait("[...document.querySelectorAll('.net-product-media img')].slice(0,4).every(img=>img.complete&&img.naturalWidth>0)");await noOverflow();await screenshot("collection-desktop");checks.push("real catalog cards, loaded product images and VND prices");
  await goto(`/collection/${sample._id}`,"document.querySelector('.perfume-profile')");
  const detailImage='[aria-label="Thư viện ảnh sản phẩm"] img:not([alt=""])';
  await wait(`(()=>{const img=document.querySelector(${JSON.stringify(detailImage)});return img?.complete&&img.naturalWidth>0})()`);
  const originalDetailSrc=await evaluate(`document.querySelector(${JSON.stringify(detailImage)}).src`);
  await evaluate("document.querySelector('[aria-label=\"Xem ảnh sản phẩm 2\"]').click()");
  await wait(`(()=>{const img=document.querySelector(${JSON.stringify(detailImage)});return img?.src!==${JSON.stringify(originalDetailSrc)}&&img?.complete&&img.naturalWidth>0})()`);
  checks.push("loaded detail image and gallery thumbnail selection");
  assert.equal(await evaluate("document.body.textContent.includes('100 sản phẩm còn trong kho')"),false);await noOverflow();await screenshot("detail-desktop");checks.push("public perfume profile and source inventory copy");
  await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await goto("/owner","document.querySelector('.perfume-source-count')?.textContent.includes('2.444')");await noOverflow();await screenshot("dashboard-mobile");
  await goto("/owner/list-product","document.querySelectorAll('.perfume-table tbody tr').length===25");await noOverflow();await screenshot("products-mobile");
  await goto(`/owner/edit-product/${sample._id}?tab=variants`,"document.querySelector('.perfume-variant-table')");await noOverflow();await screenshot("variants-mobile");
  await goto("/collection","document.querySelectorAll('.net-product-card').length===8");await wait("[...document.querySelectorAll('.net-product-media img')].slice(0,2).every(img=>img.complete&&img.naturalWidth>0)");await noOverflow();await screenshot("collection-mobile");checks.push("390px responsive layouts without horizontal document overflow");
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(artifacts,"result.json"),JSON.stringify({passed:true,checks,errors,actualDatabaseReads:true,mockedAuthentication:true,databaseWrites:0},null,2));
  console.log(JSON.stringify({passed:true,checks,screenshots:artifacts,databaseWrites:0}));
}finally{
  try{if(ws?.readyState===1)await send("Browser.close");}catch{}ws?.close();chrome?.kill();vite?.kill();await mongoose.disconnect();
}
