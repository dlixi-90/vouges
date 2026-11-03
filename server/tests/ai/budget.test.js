import test from "node:test";
import assert from "node:assert/strict";
import Product from "../../models/Product.js";
import AIToolAudit from "../../models/AIToolAudit.js";
import { parseVndAmount, normalizeVndAmountsInText } from "../../services/ai/vndAmount.js";
import { searchProducts } from "../../services/ai/tools/searchProducts.js";
import { chatWithAI } from "../../controllers/aiController.js";

const product = (id, amount) => ({
  _id: id, title: "Nước hoa kiểm thử", sizes: ["50ml"], price: {"50ml":amount},
  stockBySize: {"50ml":4}, inStockBySize: {"50ml":true}, inStock:true,
  inventoryMode:"tracked", images:["test.jpg"], fragrance:{group:"Cam Chanh", accords:[{label:"Tươi mát"}], notes:{top:[{name:"Bưởi"}]}},
});
const products = [product("507f1f77bcf86cd799439011",1000000),product("507f1f77bcf86cd799439012",1500000)];
const query = rows => ({select(){return this;},lean:async()=>rows});
const response = () => ({code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const reply = message => ({ok:true,json:async()=>({choices:[{message}]})});

test("AI VND parsing accepts consistent grouping and currency without guessing malformed amounts",()=>{
  for(const value of [1000000,"1000000","1.000.000","1,000,000","1 000 000","1\u00a0000\u00a0000","1\u202f000\u202f000","1.000.000 ₫","1.000.000đ","1.000.000 VND","1.000.000 đồng"])assert.equal(parseVndAmount(value),1000000);
  assert.equal(parseVndAmount(0),0);assert.equal(parseVndAmount("0 ₫"),0);assert.equal(parseVndAmount("50.000"),50000);
  for(const value of [null,undefined,true,false,[],{},"", " ", "1.00.000","1,000.000","1.000 000","1.5",1.5,"1e6","0x100","-1000000",-1,"1000abc","1 triệu",Infinity,NaN,Number.MAX_SAFE_INTEGER+1,"9007199254740992","1".repeat(65)])assert.equal(parseVndAmount(value),null,String(value));
});

test("model input normalizes monetary grouping, ranges and follow-ups without changing links, decimals or identifiers",()=>{
  for(const [input,expected] of [
    ["1.000.000","1000000"],["Ngân sách:1.000.000đ.","Ngân sách:1000000đ."],
    ["Từ 500.000-1.000.000 VND","Từ 500000-1000000 VND"],
    ["1,000,000 hoặc 1 500 000 ₫","1000000 hoặc 1500000 ₫"],
    ["https://example.com/1.000.000 user@1.000.000 v1.000.000","https://example.com/1.000.000 user@1.000.000 v1.000.000"],
    ["1.5 triệu, 50ml, 03/11/2026, 1.000,000","1.5 triệu, 50ml, 03/11/2026, 1.000,000"],
    ["1.000 000","1.000 000"],
  ])assert.equal(normalizeVndAmountsInText(input),expected);
});

test("formatted AI budget filters select the exact eligible prices and reject invalid values before database access",async t=>{
  const find=t.mock.method(Product,"find",()=>query(products));
  for(const maxPrice of [1000000,"1.000.000","1,000,000","1 000 000 ₫"]){
    const result=await searchProducts({maxPrice,availability:"available"});
    assert.equal(result.count,1);assert.equal(result.products[0].id,products[0]._id);assert.equal(result.filters.maxPrice,1000000);
  }
  await searchProducts({minPrice:"1.000.000",maxPrice:"1.500.000"});
  const reads=find.mock.callCount();
  for(const maxPrice of [true,[],{},"1.00.000","-1","",0.5,"9007199254740992"])await assert.rejects(searchProducts({maxPrice}));
  await assert.rejects(searchProducts({minPrice:"1.500.000",maxPrice:"1.000.000"}),/minPrice/);assert.equal(find.mock.callCount(),reads);
});

test("AI budget conversation retries malformed provider JSON once, filters correctly and sends only product summaries to the model",async t=>{
  const previous=process.env.GROQ_API_KEY;process.env.GROQ_API_KEY="test-key";
  t.after(()=>{if(previous===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previous;});
  const detailedProducts=products.map(p=>({...p,fragrance:{...p.fragrance,notes:{top:Array.from({length:60},()=>({name:"Bưởi"}))},components:Array.from({length:10},()=>({name:"Thành phần kiểm thử",notes:{top:Array.from({length:60},()=>({name:"Cam Bergamot"}))}}))}}));
  t.mock.method(Product,"find",()=>query(detailedProducts));
  const audits=[];t.mock.method(AIToolAudit,"create",async row=>{audits.push(row);return row;});
  const calls=[];
  t.mock.method(globalThis,"fetch",async(_url,options)=>{
    const request=JSON.parse(options.body);calls.push(request);
    if(calls.length===1)return {ok:false,status:400,json:async()=>({error:{message:"Failed to parse tool call arguments as JSON",code:"tool_use_failed",failed_generation:"untrusted failed content"}})};
    if(calls.length===2)return reply({role:"assistant",tool_calls:[{id:"budget-search",type:"function",function:{name:"searchProducts",arguments:JSON.stringify({maxPrice:"1.000.000",availability:"available"})}}]});
    const result=JSON.parse(request.messages.at(-1).content);
    assert.equal(result.products.length,1);assert.equal(result.filters.maxPrice,1000000);
    assert.equal(result.products[0].availableOptions[0].amount,1000000);assert.equal(result.products[0].availableOptions[0].size,"50ml");
    assert.equal(result.products[0].productOptions,undefined);assert.equal(result.products[0].fragrance.notes,undefined);assert.equal(result.products[0].detailsAvailable,true);
    assert.ok(request.messages.at(-1).content.length<JSON.stringify(detailedProducts[0]).length/3,"Large perfume profiles cannot inflate the search summary");
    return reply({role:"assistant",content:"Có nước hoa 50ml phù hợp ngân sách 1.000.000 ₫."});
  });
  const body={message:"1.000.000",history:[{role:"user",content:"Tìm nước hoa dưới 1.500.000đ"}]};const res=response();
  await chatWithAI({auth:()=>({userId:"user_budget_qa"}),body},res);
  assert.equal(res.code,200);assert.equal(res.body.success,true);assert.equal(calls.length,3);assert.equal(audits.length,1);
  assert.equal(calls[0].messages.at(-1).content,"1000000");assert.equal(calls[0].messages[1].content,"Tìm nước hoa dưới 1500000đ");assert.equal(body.message,"1.000.000");
  assert.equal(calls[1].temperature,0);assert.equal(JSON.stringify(calls[1]).includes("untrusted failed content"),false);
  assert.equal(res.body.products[0].image,"test.jpg");assert.equal(res.body.products[0].fragrance.notes.top[0].name,"Bưởi");assert.equal(res.body.products[0].productOptions.length,1);
  assert.equal(res.body.products[0].fragrance.notes.top.length,60);assert.equal(res.body.products[0].fragrance.components.length,10);
});

test("invalid provider tool JSON has a bounded retry and does not execute any tool",async t=>{
  const previous=process.env.GROQ_API_KEY;process.env.GROQ_API_KEY="test-key";
  t.after(()=>{if(previous===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previous;});
  t.mock.method(console,"error",()=>{});t.mock.method(Product,"find",()=>assert.fail("No tool can run from rejected generation"));t.mock.method(AIToolAudit,"create",()=>assert.fail("No tool executed"));
  const fetch=t.mock.method(globalThis,"fetch",async()=>({ok:false,status:400,json:async()=>({error:{message:"Failed to parse tool call arguments as JSON"}})}));
  const res=response();await chatWithAI({auth:()=>({userId:"user_budget_qa"}),body:{message:"1.000.000"}},res);
  assert.equal(res.code,502);assert.equal(fetch.mock.callCount(),2);assert.equal(res.body.success,false);
});
