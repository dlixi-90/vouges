import {sanitizeArticle,articleToPlainText,LIBRARY_ARTICLE_LIMITS} from "../../client/src/utils/productArticle.js";

const sourceBrand=()=>/(?<![\p{L}\p{N}])(?:(?:theo|của)\s+|(?:đang\s+có\s+)?tại\s+)?apa[\s\u200b-]*niche(?![\p{L}\p{N}])/giu;
const hasBrand=value=>typeof value==="string"&&sourceBrand().test(value);
const textOf=node=>node?.type==="text"?node.text:(node?.content||[]).map(textOf).join(node?.type==="doc"?"\n":"");
const categories=["Nước hoa nam","Nước hoa nữ","Nước hoa unisex"];
const categoryOf=node=>node?.type==="image"?categories.find(label=>label.toLocaleLowerCase("vi-VN")===node.attrs?.alt?.trim().toLocaleLowerCase("vi-VN")):null;
export const categoryCardHeading="Khám phá nước hoa theo giới tính";

// Edit visible spans only. URLs, image paths, source evidence and text formatting survive.
const cleanInline=node=>{
  if(!["paragraph","heading"].includes(node.type))return;
  const joined=(node.content||[]).map(child=>child.type==="text"?child.text:"\n").join("");
  const edits=[...joined.matchAll(sourceBrand())].map(match=>[match.index,match.index+match[0].length]);
  if(!edits.length)return;
  let offset=0;
  node.content=(node.content||[]).flatMap(child=>{
    const original=child.type==="text"?child.text:"\n",start=offset;offset+=original.length;
    let value="",cursor=0;
    for(const [from,to] of edits){const a=Math.max(0,from-start),b=Math.min(original.length,to-start);if(b<=a)continue;value+=original.slice(cursor,a);cursor=b;}
    value+=original.slice(cursor);
    if(child.type!=="text")return value?[child]:[];
    value=value.replace(/[ \t]{2,}/g," ").replace(/\s+([,.;:!?])/g,"$1");
    return value?[{...child,text:value}]:[];
  });
  const first=node.content.find(child=>child.type==="text"),last=node.content.findLast(child=>child.type==="text");
  if(first){first.text=first.text.trimStart();if(edits[0][0]===0&&first.text)first.text=first.text[0].toLocaleUpperCase("vi-VN")+first.text.slice(1);}
  if(last)last.text=last.text.trimEnd();
  node.content=node.content.filter(child=>child.type!=="text"||child.text);
};
const cleanLabel=value=>hasBrand(value)?value.replace(sourceBrand(),"").replace(/[ \t]{2,}/g," ").trim():value;
export function reviseProductPresentation(product){
  const fields={};
  for(const field of ["title","brand","description","ingredients"]){
    const value=cleanLabel(product[field]);if(value!==product[field])fields[field]=value;
  }
  if(fields.title==="")throw Error("Removing source branding would leave an empty product name");
  return fields;
}
const cleanNode=node=>{
  cleanInline(node);
  if(node.attrs){
    for(const field of ["alt","title"])if(typeof node.attrs[field]==="string")node.attrs[field]=cleanLabel(node.attrs[field]);
    for(const item of node.attrs.items||[])for(const field of ["name","englishName","description"])if(typeof item[field]==="string")item[field]=cleanLabel(item[field]);
  }
  for(const child of node.content||[])cleanNode(child);
};
export function reviseLibraryPresentation(term){
  const content=structuredClone(term.descriptionContent);
  if(!content){
    const description=cleanLabel(term.description),relatedHeading=cleanLabel(term.contentImport?.relatedHeading);
    const changed=description!==term.description||relatedHeading!==term.contentImport?.relatedHeading;
    return {changed,descriptionContent:content,description,relatedHeading,sections:0,categoryLinks:0};
  }
  const original=JSON.stringify(content),nodes=content.content||[],result=[];let sections=0;
  for(let i=0;i<nodes.length;i++){
    const node=nodes[i],triples=[];
    if(node.type==="heading"&&hasBrand(textOf(node))){
      for(let j=i+1;j+2<nodes.length;j+=3){
        const category=categoryOf(nodes[j]),count=textOf(nodes[j+1]),caption=nodes[j+2];
        if(!category||nodes[j+1].type!=="paragraph"||!/^\d+$/.test(count.trim())||caption.type!=="paragraph")break;
        const link=caption.content?.find(child=>child.marks?.some(mark=>mark.type==="link"));
        const href=link?.marks.find(mark=>mark.type==="link")?.attrs?.href;
        if(!href||!/^https:\/\/(?:www\.)?apaniche\.vn\/nuoc-hoa-(?:nam|nu|unisex)(?:[?#]|$)/i.test(href))break;
        triples.push({category,image:nodes[j].attrs});
      }
    }
    if(triples.length===3&&new Set(triples.map(row=>row.category)).size===3){
      result.push({type:"heading",attrs:{...node.attrs},content:[{type:"text",text:categoryCardHeading}]});
      result.push({type:"libraryCards",attrs:{columns:3,items:triples.map(({category,image})=>({name:category,href:"/collection?"+new URLSearchParams({category}),image:image.src,width:image.width,height:image.height,description:"Xem bộ sưu tập"}))}});
      i+=9;sections++;
      // These source-shop inventory totals are neither Velours counts nor editorial facts.
      if(nodes[i+1]?.type==="paragraph"&&/^Trên cơ sở dữ liệu, nhóm hương .* có \d+/u.test(textOf(nodes[i+1])))i++;
    }else result.push(node);
  }
  content.content=result;cleanNode(content);
  const relatedHeading=cleanLabel(term.contentImport?.relatedHeading);
  const changed=original!==JSON.stringify(content)||hasBrand(term.description)||relatedHeading!==term.contentImport?.relatedHeading;
  if(!changed)return {changed:false,sections:0,categoryLinks:0};
  const descriptionContent=sanitizeArticle(content,LIBRARY_ARTICLE_LIMITS);
  return {changed:true,descriptionContent,description:articleToPlainText(descriptionContent).slice(0,5000),relatedHeading,sections,categoryLinks:sections*3};
}
