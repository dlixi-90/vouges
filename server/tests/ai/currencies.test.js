import test from "node:test";
import assert from "node:assert/strict";
import Product from "../../models/Product.js";
import {parseBudgetAmount,parseBudgetQuantity} from "../../services/ai/budgetAmount.js";
import {getVndExchangeRate,convertBudgetToVnd,exchangeRateSource,clearExchangeRateCache} from "../../services/ai/exchangeRates.js";
import {searchProducts} from "../../services/ai/tools/searchProducts.js";
import {chatWithAI} from "../../controllers/aiController.js";
import AIToolAudit from "../../models/AIToolAudit.js";
import {sanitizeToolArguments} from "../../services/ai/auditAIToolCall.js";

test.beforeEach(t=>{clearExchangeRateCache();t.after(clearExchangeRateCache);t.mock.method(exchangeRateSource,"now",()=>Date.parse("2026-11-03T12:00:00Z"));});

test("Vietnamese and English money words, decimals and shorthand preserve the full amount",()=>{
  for(const [input,amount] of [
    ["1tr5",1500000],["1 triệu 5",1500000],["1 tr 250",1250000],["một triệu năm",1500000],["1tr250",1250000],["1tr",1000000],["1.5tr",1500000],["1,5 triệu",1500000],["2 củ",2000000],["500k",500000],
    ["một triệu rưỡi",1500000],["1tr rưỡi",1500000],["nửa triệu",500000],["một phẩy năm triệu",1500000],
    ["một triệu năm trăm nghìn",1500000],["hai trăm ba mươi lăm nghìn",235000],["một trăm linh năm nghìn đồng",105000],
    ["one million five hundred thousand dong",1500000],["one and a half million VND",1500000],["one million and a half dong",1500000],
    ["1 tỷ hai trăm triệu",1200000000],["1e6",1000000],["1,00,000",100000],
  ]){const parsed=parseBudgetAmount(input);assert.equal(parsed.amount,amount,input);assert.equal(parsed.currency,"VND",input);}
});

test("foreign currencies accept symbols, ISO, Vietnamese/English names and localized decimal notation",()=>{
  for(const [input,currency,amount] of [
    ["100 đô","USD",100],["một trăm đô la Mỹ","USD",100],["one hundred and twenty-five US dollars","USD",125],
    ["fifty euros","EUR",50],["hai trăm yên Nhật","JPY",200],["một nghìn tệ","CNY",1000],
    ["100.50 USD","USD",100.5],["100,50 USD","USD",100.5],["€1.234,56","EUR",1234.56],["1,234.56 euros","EUR",1234.56],
    ["$100","USD",100],["C$100","CAD",100],["A$100","AUD",100],["S$100","SGD",100],["100000₩","KRW",100000],
    ["50 bảng Anh","GBP",50],["50 baht","THB",50],["25CHF","CHF",25],["1000 rupees","INR",1000],
    ["100¥ JPY","JPY",100],["1 234,50 EUR","EUR",1234.5],["CHF 1’234.50","CHF",1234.5],
    ["one hundred dollars and fifty cents","USD",100.5],["một trăm đô năm mươi xu","USD",100.5],
    ["fifty cents USD","USD",0.5],["５０ USD","USD",50],["١٠٠ USD","USD",100],
  ]){const parsed=parseBudgetAmount(input);assert.equal(parsed.amount,amount,input);assert.equal(parsed.currency,currency,input);}
  assert.deepEqual(parseBudgetAmount(100.5,"USD"),{amount:100.5,currency:"USD",assumedCurrency:false});
  assert.equal(parseBudgetAmount("100¥","CNY").currency,"CNY");
  assert.equal(parseBudgetAmount("100 đô").assumedCurrency,true);
});

test("ambiguous or invalid money cannot silently turn into a product filter",()=>{
  for(const input of ["100¥","100 USD EUR","100 USD VND","one fakeword dollars","100abc","-100 đô","1-2 triệu","1.00.000","1.000 000",{},[],true,false,NaN,Infinity,"",null,"0x100","9007199254740992","100/2 USD","100;drop", "a".repeat(161)])assert.throws(()=>parseBudgetAmount(input),undefined,String(input));
  assert.throws(()=>parseBudgetAmount("100USD","EUR"));assert.throws(()=>parseBudgetAmount(100,"../../USD"));
  assert.throws(()=>parseBudgetAmount(0.5));assert.equal(parseBudgetQuantity("100 nonsense"),null);
});

test("reference rates are validated, cached and coalesced without using guesses or stale fallbacks",async t=>{
  let now=Date.parse("2026-11-03T12:00:00Z");t.mock.method(exchangeRateSource,"now",()=>now);
  const load=t.mock.method(exchangeRateSource,"load",async base=>({base,quote:"VND",rate:base==="USD"?26000.25:28000.5,date:"2026-11-02"}));
  const [a,b]=await Promise.all([getVndExchangeRate("USD"),getVndExchangeRate("USD")]);assert.deepEqual(a,b);assert.equal(load.mock.callCount(),1);assert.equal(a.source,"Frankfurter");assert.equal(a.date,"2026-11-02");
  await getVndExchangeRate("USD");assert.equal(load.mock.callCount(),1);
  now+=6*3600000+1;await getVndExchangeRate("USD");assert.equal(load.mock.callCount(),2);
  now+=8*86400000;await assert.rejects(getVndExchangeRate("USD"),/tỷ giá/);assert.equal(load.mock.callCount(),3);
  await assert.rejects(getVndExchangeRate("USD/../../"),/không hợp lệ/);
  await getVndExchangeRate("VND");assert.equal(load.mock.callCount(),3);
});

test("exchange-rate requests use a fixed HTTPS origin and send no customer amount or identity",async t=>{
  const fetch=t.mock.method(globalThis,"fetch",async(url,options)=>{
    assert.equal(url,"https://api.frankfurter.dev/v2/rate/EUR/VND");assert.deepEqual(options.headers,{Accept:"application/json"});assert.ok(options.signal instanceof AbortSignal);assert.equal(options.body,undefined);
    return {ok:true,json:async()=>({base:"EUR",quote:"VND",rate:28000,date:"2026-11-02"})};
  });
  assert.equal((await getVndExchangeRate("EUR")).rate,28000);assert.equal(fetch.mock.callCount(),1);
});

test("malformed, mismatched, future and unavailable rates fail before querying products",async t=>{
  t.mock.method(Product,"find",()=>assert.fail("No lookup without a valid rate"));
  const valid={base:"USD",quote:"VND",date:"2026-11-02",rate:26000};
  for(const data of [{...valid,rate:0},{...valid,rate:-1},{...valid,rate:"26000"},{...valid,base:"EUR"},{...valid,quote:"USD"},{...valid,date:"2026-12-01"},{...valid,date:"2026-02-30"},{...valid,date:"2026-01-01"}]){
    clearExchangeRateCache();t.mock.method(exchangeRateSource,"load",async()=>data);await assert.rejects(searchProducts({maxPrice:"100USD"}),/tỷ giá/);
  }
  clearExchangeRateCache();t.mock.method(exchangeRateSource,"load",async()=>{throw new Error("Provider down");});await assert.rejects(searchProducts({maxPrice:"100USD"}),/tỷ giá/);
  t.mock.method(exchangeRateSource,"load",async()=>valid);assert.equal((await getVndExchangeRate("USD")).rate,26000);
});

test("foreign budget conversion rounds bounds exactly and filters actual VND prices",async t=>{
  assert.equal(convertBudgetToVnd(50.25,28000.5,"max"),1407025);assert.equal(convertBudgetToVnd(50.25,28000.5,"min"),1407026);
  assert.equal(convertBudgetToVnd(0.1,0.2,"max"),0);assert.equal(convertBudgetToVnd(0.1,0.2,"min"),1);assert.equal(convertBudgetToVnd(100,26000.25,"max"),2600025);
  assert.throws(()=>convertBudgetToVnd(Number.MAX_SAFE_INTEGER,26000,"max"));
  const load=t.mock.method(exchangeRateSource,"load",async base=>({base,quote:"VND",rate:base==="USD"?26000.25:28000.5,date:"2026-11-02"}));
  const rows=[2600025,2600026].map((price,i)=>({_id:`qa-${i}`,title:"Test",sizes:["50ml"],price:{"50ml":price},inStock:true,inventoryMode:"tracked",stockBySize:{"50ml":4},inStockBySize:{"50ml":true}}));
  t.mock.method(Product,"find",()=>({select(){return this;},lean:async()=>rows}));
  const found=await searchProducts({maxPrice:"one hundred US dollars",availability:"available"});
  assert.equal(found.count,1);assert.equal(found.filters.maxPrice,2600025);assert.equal(found.products[0].id,"qa-0");assert.equal(found.filters.budgetConversions.max.amount,100);assert.equal(found.filters.budgetConversions.max.currency,"USD");assert.equal(found.filters.budgetConversions.max.date,"2026-11-02");
  await searchProducts({minPrice:50,maxPrice:100,priceCurrency:"USD"});assert.equal(load.mock.callCount(),1);
  const vnd=await searchProducts({maxPrice:"ba triệu"});assert.equal(vnd.filters.maxPrice,3000000);assert.equal(vnd.filters.budgetConversions,undefined);assert.equal(load.mock.callCount(),1);
  const mixed=await searchProducts({minPrice:"fifty US dollars",maxPrice:"fifty euros"});assert.equal(mixed.filters.minPrice,1300013);assert.equal(mixed.filters.maxPrice,1400025);assert.equal(load.mock.callCount(),2);
});

test("money audit records canonical amount/currency instead of arbitrary raw text",()=>{
  const valid=sanitizeToolArguments("searchProducts",{minPrice:"một triệu rưỡi",maxPrice:"one hundred US dollars"}).safeArguments;
  assert.deepEqual(valid,{minPrice:1500000,minPriceCurrency:"VND",maxPrice:100,maxPriceCurrency:"USD"});
  const invalid=sanitizeToolArguments("searchProducts",{maxPrice:"contact private@example.com or 0912345678"});
  assert.equal(invalid.safeArguments.maxPrice,"[invalid-budget]");assert.equal(JSON.stringify(invalid).includes("private@example.com"),false);
});

test("foreign money chat passes original currency to search and returns sourced conversion to the model",async t=>{
  const previous=process.env.GROQ_API_KEY;process.env.GROQ_API_KEY="test-key";t.after(()=>{if(previous===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previous;});
  t.mock.method(exchangeRateSource,"load",async base=>({base,quote:"VND",rate:26000,date:"2026-11-02"}));
  t.mock.method(Product,"find",()=>({select(){return this;},lean:async()=>[]}));t.mock.method(AIToolAudit,"create",async row=>row);
  let calls=0;t.mock.method(globalThis,"fetch",async(_url,options)=>{
    const body=JSON.parse(options.body);calls++;
    if(calls===1){assert.ok(body.messages[0].content.includes("Không tự ước tính tỷ giá"));return {ok:true,json:async()=>({choices:[{message:{role:"assistant",tool_calls:[{id:"currency-search",type:"function",function:{name:"searchProducts",arguments:JSON.stringify({maxPrice:100,priceCurrency:"USD"})}}]}}]})};}
    const result=JSON.parse(body.messages.at(-1).content);assert.equal(result.filters.maxPrice,2600000);assert.equal(result.filters.budgetConversions.max.source,"Frankfurter");
    return {ok:true,json:async()=>({choices:[{message:{role:"assistant",content:"Chưa tìm thấy sản phẩm phù hợp."}}]})};
  });
  const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await chatWithAI({auth:()=>({userId:"user_fx_qa"}),body:{message:"one hundred US dollars"}},res);
  assert.equal(res.code,200);assert.equal(res.body.success,true);assert.equal(calls,2);
  assert.match(res.body.message,/100 USD ≈ 2\.600\.000 VND/);assert.match(res.body.message,/Frankfurter, ngày 02\/11\/2026/);assert.match(res.body.message,/Chưa tìm thấy/);
});
