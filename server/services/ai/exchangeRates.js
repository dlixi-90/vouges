const DAY=86400000,TTL=6*3600000,MAX_RATE_AGE=7*DAY;
const cache=new Map(),pending=new Map();
export const exchangeRateSource={
  now:()=>Date.now(),
  load:async currency=>{
    const response=await fetch(`https://api.frankfurter.dev/v2/rate/${currency}/VND`,{signal:AbortSignal.timeout(7000),headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error("Rate unavailable");
    return response.json();
  },
};
export const clearExchangeRateCache=()=>{cache.clear();pending.clear();};

export const getVndExchangeRate=async currency=>{
  if(typeof currency!=="string"||!/^[A-Z]{3}$/u.test(currency))throw new Error("Mã ngoại tệ không hợp lệ.");
  if(currency==="VND")return {base:"VND",quote:"VND",rate:1,date:null,source:null};
  const now=exchangeRateSource.now(),hit=cache.get(currency);
  if(hit&&now<hit.expiresAt&&now-hit.rateAt<=MAX_RATE_AGE)return hit.value;
  if(pending.has(currency))return pending.get(currency);
  const request=(async()=>{
    try{
      const data=await exchangeRateSource.load(currency),rateAt=Date.parse(`${data?.date}T00:00:00Z`);
      if(data?.base!==currency||data?.quote!=="VND"||typeof data.rate!=="number"||!Number.isFinite(data.rate)||data.rate<=0
        ||!/^\d{4}-\d{2}-\d{2}$/u.test(data.date||"")||!Number.isFinite(rateAt)||new Date(rateAt).toISOString().slice(0,10)!==data.date||rateAt>now+DAY||now-rateAt>MAX_RATE_AGE)throw new Error("Invalid rate");
      const value={base:currency,quote:"VND",rate:data.rate,date:data.date,source:"Frankfurter",sourceUrl:"https://frankfurter.dev/"};
      if(cache.size>=32)cache.delete(cache.keys().next().value);
      cache.set(currency,{value,rateAt,expiresAt:now+TTL});return value;
    }catch{throw new Error(`Chưa lấy được tỷ giá ${currency}/VND đủ mới. Không tự đoán tỷ giá; đề nghị khách thử lại hoặc cung cấp ngân sách VND.`);}
    finally{pending.delete(currency);}
  })();
  pending.set(currency,request);return request;
};

// Multiply decimal representations exactly; upper bounds round down and lower bounds up.
const fraction=value=>{
  const [mantissa,exponent="0"]=String(value).toLowerCase().split("e"),[whole,decimal=""]=mantissa.split(".");
  const shift=Number(exponent)-decimal.length,digits=BigInt(whole+decimal);
  return shift>=0?[digits*10n**BigInt(shift),1n]:[digits,10n**BigInt(-shift)];
};
export const convertBudgetToVnd=(amount,rate,bound)=>{
  if(typeof amount!=="number"||!Number.isFinite(amount)||amount<0||typeof rate!=="number"||!Number.isFinite(rate)||rate<=0||!["min","max"].includes(bound))throw new Error("Số tiền quy đổi không hợp lệ.");
  const [a,b]=fraction(amount),[c,d]=fraction(rate),numerator=a*c,denominator=b*d;
  const result=bound==="min"?(numerator+denominator-1n)/denominator:numerator/denominator;
  if(result>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("Ngân sách quy đổi quá lớn.");
  return Number(result);
};
