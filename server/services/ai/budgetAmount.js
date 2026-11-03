const fold = text => text.normalize("NFKC").normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/giu, "d").toLowerCase().trim().replace(/[\u00a0\u202f]/gu," ").replace(/[٠-٩۰-۹]/gu,digit=>String(digit.codePointAt(0)-(digit<="٩"?0x660:0x6f0)));
const aliases = {
  VND:["vietnamese dong","vietnam dong","viet nam dong","dong viet nam","vn dong","dong","vndong","d","₫"],
  USD:["us dollars","us dollar","american dollars","american dollar","do la my","do my","dollars","dollar","bucks","buck","do la","do","us$","$"],
  EUR:["euros","euro","€"], GBP:["british pounds","british pound","pounds sterling","pound sterling","bang anh","pounds","pound","£"],
  JPY:["japanese yen","yen nhat","yen","円"], CNY:["nhan dan te","trung quoc te","yuan","renminbi","rmb","te","元","人民币"],
  KRW:["south korean won","korean won","won han quoc","won","₩"], THB:["thai baht","baht thai","baht","฿"],
  AUD:["australian dollars","australian dollar","do la uc","do uc","a$","au$"],
  CAD:["canadian dollars","canadian dollar","do la canada","do canada","c$","ca$"],
  SGD:["singapore dollars","singapore dollar","do la singapore","do singapore","s$","sg$"],
  HKD:["hong kong dollars","hong kong dollar","do la hong kong","hk$"], TWD:["taiwan dollars","taiwan dollar","do dai loan","nt$"],
  CHF:["swiss francs","swiss franc","franc thuy si"], INR:["indian rupees","indian rupee","rupees","rupee","₹"],
  MYR:["malaysian ringgit","ringgit"], IDR:["indonesian rupiah","rupiah"], RUB:["russian rubles","russian ruble","rubles","ruble","rup","₽"],
  AED:["uae dirhams","uae dirham","dirhams","dirham"], SAR:["saudi riyals","saudi riyal","riyals","riyal"],
};
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const currencyTerms = [...Object.entries(aliases).flatMap(([code,words])=>words.map(word=>[word,code])),
  ...Intl.supportedValuesOf("currency").map(code=>[code.toLowerCase(),code])].sort((a,b)=>b[0].length-a[0].length);
const words = Object.fromEntries([
  ...["khong|zero","mot|one|a|an","hai|two","ba|three","bon|tu|four","nam|lam|five","sau|six","bay|seven","tam|eight","chin|nine"].flatMap((group,i)=>group.split("|").map(word=>[word,i])),
  ...Object.entries({ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,half:0.5,nua:0.5}),
]);
const scales = {k:1000,nghin:1000,ngan:1000,thousand:1000,thousands:1000,tr:1000000,trieu:1000000,cu:1000000,m:1000000,million:1000000,millions:1000000,ty:1000000000,ti:1000000000,b:1000000000,billion:1000000000,billions:1000000000,trillion:1000000000000};

const decimalNumber = text => {
  if(/[’']/u.test(text))return /^\d{1,3}(?:[’']\d{3})+(?:[.,]\d{1,9})?$/u.test(text)?decimalNumber(text.replace(/[’']/gu,"")):null;
  if (/^\d+(?:[.,]\d+)?e[+-]?\d{1,2}$/u.test(text)) return Number(text.replace(",","."));
  if (/^\d+$/u.test(text)) return Number(text);
  if (/^\d{1,3}(?:[., ]\d{3})+$/u.test(text) && [".",","," "].filter(sep=>text.includes(sep)).length===1) return Number(text.replace(/[., ]/gu,""));
  if (/^\d{1,2}(?:,\d{2})+,\d{3}$/u.test(text)) return Number(text.replace(/,/gu,""));
  const separators=[...text.matchAll(/[.,]/gu)];
  if (!separators.length) return null;
  const last=separators.at(-1),whole=text.slice(0,last.index),fraction=text.slice(last.index+1);
  if (!/^\d{1,9}$/u.test(fraction) || whole.includes(last[0])) return null;
  const other=last[0]==="."?",":".";
  if (whole && !/^\d+$/u.test(whole) && !new RegExp(`^(?:\\d{1,3}(?:${escape(other)}\\d{3})+|\\d{1,3}(?: \\d{3})+)$`,"u").test(whole)) return null;
  return Number(`${whole.replace(/[., ]/gu,"")||"0"}.${fraction}`);
};

const smallNumber = tokens => {
  const point=tokens.findIndex(word=>["phay","cham","point"].includes(word));
  if (point>=0) {
    const integer=smallNumber(tokens.slice(0,point)),digits=tokens.slice(point+1).map(word=>words[word]??(/^\d$/u.test(word)?Number(word):null));
    return integer!==null && digits.length && digits.every(d=>Number.isInteger(d)&&d>=0&&d<=9) ? integer+Number(`0.${digits.join("")}`) : null;
  }
  if (!tokens.length) return null;
  if(tokens.length>1&&tokens.every(token=>decimalNumber(token)!==null))return null;
  let hundreds=0,current=0,seen=false;
  for (const token of tokens) {
    if (["and","linh","le"].includes(token)) continue;
    if (["tram","hundred"].includes(token)) {if(hundreds||current>=10)return null;hundreds=(seen?current:1)*100;current=0;seen=true;continue;}
    if (token==="muoi") {if(current>=10)return null;current=(current||1)*10;seen=true;continue;}
    const value=words[token]??decimalNumber(token);
    if (value===null||!Number.isFinite(value)) return null;
    current+=value;seen=true;
  }
  return seen?hundreds+current:null;
};

export const parseBudgetQuantity = input => {
  if (typeof input==="number") return Number.isFinite(input)&&input>=0&&input<=Number.MAX_SAFE_INTEGER?input:null;
  if (typeof input!=="string"||input.length>160) return null;
  let text=fold(input).replace(/(?<=[a-z])-(?=[a-z])/gu," ").replace(/\s+/gu," ").trim().replace(/^\+(?=\d)/u,"");
  const numeric=decimalNumber(text);
  if (numeric!==null) return Number.isFinite(numeric)&&numeric>=0&&numeric<=Number.MAX_SAFE_INTEGER?numeric:null;
  if (!text||/[+\-:/<>{}=]/u.test(text)) return null;
  const compact=/^(\d+(?:[.,]\d+)?)\s*(tr|trieu|k|m|b|ty|ti|cu)\s*(\d{1,3})$/u.exec(text);
  if (compact) {
    if(compact[3].length===2&&["tr","trieu","cu","ty","ti"].includes(compact[2]))return null;
    return (decimalNumber(compact[1])+Number(`0.${compact[3]}`))*scales[compact[2]];
  }
  const half=/(?:\s+ruoi|\s+and a half)$/u.exec(text);
  if (half) {
    const main=text.slice(0,half.index),value=parseBudgetQuantity(main),units=main.replace(/(\d)([a-z])/gu,"$1 $2").match(/trieu|nghin|ngan|thousand|million|billion|trillion|\b(?:tr|k|m|b|ty|ti|cu)\b/gu);
    return value===null?null:value+0.5*(scales[units?.at(-1)]||1);
  }
  text=text.replace(/\band a half\b/gu,"point five").replace(/\bhalf a\b/gu,"half").replace(/(\d)([a-z])/gu,"$1 $2").replace(/([a-z])(\d)/gu,"$1 $2");
  const tokens=text.split(/\s+/u),largest=Math.max(0,...tokens.map(token=>scales[token]||0));
  if (!largest) return smallNumber(tokens);
  const index=tokens.findIndex(token=>scales[token]===largest);
  if (tokens.slice(index+1).some(token=>scales[token]===largest)) return null;
  const head=index?parseBudgetQuantity(tokens.slice(0,index).join(" ")):1;
  const tail=tokens.slice(index+1).filter(token=>token!=="and");
  const rest=tail.length?parseBudgetQuantity(tail.join(" ")):0;
  if (head===null||rest===null) return null;
  if(["trieu","ty","ti","cu"].includes(tokens[index])&&tail.length===1&&rest>0&&rest<10)return head*largest+rest*largest/10;
  const result=head*largest+rest;
  return Number.isFinite(result)&&result>=0&&result<=Number.MAX_SAFE_INTEGER?result:null;
};

export const parseBudgetAmount = (input, priceCurrency) => {
  const hint=priceCurrency==null?null:String(priceCurrency).trim().toUpperCase();
  if (hint!==null && !/^[A-Z]{3}$/u.test(hint)) throw new Error("Loại tiền cần là mã ISO ba chữ, ví dụ VND, USD hoặc EUR.");
  if (typeof input!=="number" && typeof input!=="string") throw new Error("Ngân sách phải là số hoặc cách viết số tiền bằng chữ.");
  let text=typeof input==="string"?fold(input):null,currency=null,assumedCurrency=false;
  if (text!==null) {
    if (text.length>160) throw new Error("Số tiền quá dài.");
    const yenSymbol=text.includes("¥");text=text.replace(/¥/gu," ").trim();
    for (const [alias,code] of currencyTerms) {
      const pattern=new RegExp(`(^|[\\d\\s])${escape(alias)}(?=$|[\\d\\s])`,"u"),match=pattern.exec(text);
      if (!match) continue;
      if (currency && currency!==code) throw new Error("Mỗi mức ngân sách chỉ được chứa một loại tiền. Hãy tách khoảng giá hoặc làm rõ đơn vị.");
      currency=code;assumedCurrency=code==="USD"&&["$","do","do la","dollar","dollars","buck","bucks"].includes(alias);
      const before=text.slice(0,match.index)+match[1],after=text.slice(match.index+match[0].length).trim(),cents=/^(?:and\s+)?(.+?)\s*(?:cents?|pence|xu)$/u.exec(after);
      if(before.trim()&&cents){
        const major=parseBudgetQuantity(before),minor=parseBudgetQuantity(cents[1]);
        if(major===null||minor===null||!Number.isInteger(minor)||minor>=100||!["USD","EUR","GBP","AUD","CAD","SGD","HKD","TWD","CHF"].includes(code))throw new Error("Chưa rõ phần tiền lẻ; cần làm rõ lượng tiền và loại tiền.");
        text=String(major+minor/100);
      }else text=text.replace(pattern,`${match[1]} `).trim();
    }
    if(yenSymbol && !["JPY","CNY"].includes(currency||hint))throw new Error("Ký hiệu ¥ có thể là JPY hoặc CNY. Vui lòng làm rõ loại tiền trước khi tìm sản phẩm.");
  }
  if (hint && currency && hint!==currency) throw new Error("Đơn vị tiền trong ngân sách khác priceCurrency. Hãy dùng đúng loại tiền khách nhập.");
  currency=currency||hint||"VND";
  const cents=text===null?null:/^(.+?)\s*(?:cents?|pence|xu)$/u.exec(text);
  if(cents && currency==="VND")throw new Error("Cần làm rõ cent/pence/xu thuộc loại ngoại tệ nào.");
  const quantity=parseBudgetQuantity(cents?cents[1]:text??input),amount=quantity===null?null:cents?quantity/100:quantity;
  if (amount===null||!Number.isFinite(amount)||amount<0||amount>Number.MAX_SAFE_INTEGER||(currency==="VND"&&!Number.isSafeInteger(amount))) throw new Error("Chưa hiểu rõ số tiền. Hãy làm rõ lượng tiền và đơn vị, ví dụ một triệu rưỡi, 1tr5 hoặc one hundred US dollars.");
  return {amount,currency,assumedCurrency};
};
