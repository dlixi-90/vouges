import test from "node:test";
import assert from "node:assert/strict";
import {reviseLibraryPresentation,reviseProductPresentation,categoryCardHeading} from "./library-presentation.mjs";
import {articleToPlainText} from "../../client/src/utils/productArticle.js";
const p=text=>({type:"paragraph",content:[{type:"text",text}]});
const headings=text=>({type:"heading",attrs:{level:2},content:[{type:"text",text}]});
const retail=(label,slug,count)=>[{type:"image",attrs:{src:"/images/"+slug+".webp",alt:label,width:150,height:150,articleWidth:100}},p(String(count)),{type:"paragraph",content:[{type:"text",text:"Chai "},{type:"text",text:label,marks:[{type:"link",attrs:{href:"https://apaniche.vn/nuoc-hoa-"+slug+"#group"}}]}]}];
test("source inventory triples become three internal category cards; unrelated editorial content and URLs remain",()=>{
  const before=p("Nội dung giới thiệu được giữ nguyên.");
  const term={descriptionContent:{type:"doc",content:[before,headings("Nước Hoa nhóm hương Cam Chanh đang có tại Apa Niche"),...retail("Nước hoa nam","nam",23),...retail("Nước hoa nữ","nu",22),...retail("Nước hoa unisex","unisex",20),p("Trên cơ sở dữ liệu, nhóm hương Aromatic Fruity có 22 dòng nước hoa dành cho nữ."),p("Kết luận khác.")]}};
  const result=reviseLibraryPresentation(term);
  assert.equal(result.sections,1);assert.equal(result.categoryLinks,3);assert.deepEqual(result.descriptionContent.content[0],before);
  assert.equal(articleToPlainText(result.descriptionContent.content[1]),categoryCardHeading);
  const items=result.descriptionContent.content[2].attrs.items;
  assert.deepEqual(items.map(item=>new URL(item.href,"https://velours.invalid").searchParams.get("category")),["Nước hoa nam","Nước hoa nữ","Nước hoa unisex"]);
  assert.ok(items.every(item=>item.href.startsWith("/collection?")));assert.equal(result.descriptionContent.content.at(-1).content[0].text,"Kết luận khác.");
  assert.equal(/Apa\s*Niche|\b23\b|\b22\b|\b20\b/i.test(result.description),false);
  assert.equal(reviseLibraryPresentation({...term,...result}).changed,false);
  assert.ok(JSON.stringify(term).includes("Apa Niche"),"Planning never mutates its source");
});
test("brand removal spans text formatting without breaking links, photos or ordinary prose",()=>{
  const href="https://apaniche.vn/source",term={descriptionContent:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Theo Apa "},{type:"text",text:"Niche",marks:[{type:"bold"}]},{type:"text",text:" có thể là chai nước hoa này.",marks:[{type:"italic"}]}]},{type:"paragraph",content:[{type:"text",text:"Liên kết tham khảo",marks:[{type:"link",attrs:{href}}]}]},{type:"image",attrs:{src:"https://apaniche.vn/photo.webp",alt:"Ảnh Apa Niche",title:"",articleWidth:100}}]}};
  const result=reviseLibraryPresentation(term);
  assert.equal(articleToPlainText(result.descriptionContent.content[0]),"Có thể là chai nước hoa này.");
  assert.deepEqual(result.descriptionContent.content[0].content[0].marks,[{type:"italic"}]);
  assert.equal(result.descriptionContent.content[1].content[0].marks[0].attrs.href,href);
  assert.equal(result.descriptionContent.content[2].attrs.src,"https://apaniche.vn/photo.webp");
  assert.equal(result.descriptionContent.content[2].attrs.alt,"Ảnh");
});
test("incomplete or editorial image-number sequences are not discarded",()=>{
  const term={descriptionContent:{type:"doc",content:[headings("Bài viết khác"),...retail("Nước hoa nam","nam",23),p("Nội dung.")]}};
  const result=reviseLibraryPresentation(term);assert.equal(result.changed,false);assert.equal(result.sections,0);
});
test("plain fallback copy and related-product headings are also cleaned",()=>{
  const result=reviseLibraryPresentation({descriptionContent:null,description:"Gợi ý tại Apa Niche",contentImport:{relatedHeading:"Sản phẩm tại Apa Niche"}});
  assert.equal(result.changed,true);assert.equal(result.description,"Gợi ý");assert.equal(result.relatedHeading,"Sản phẩm");
});
test("gift product copy loses the retailer label without changing commerce, photos or source evidence",()=>{
  const product={title:"Set Nước Hoa Nam Apa Niche",brand:"Apa Niche",description:"",price:{"100ml":1000000},stockBySize:{"100ml":3},images:["/images/one.webp"],source:{provider:"apaniche"}};
  assert.deepEqual(reviseProductPresentation(product),{title:"Set Nước Hoa Nam",brand:""});
  assert.deepEqual(reviseProductPresentation({...product,...reviseProductPresentation(product)}),{});
  assert.throws(()=>reviseProductPresentation({title:"Apa Niche"}),/empty product name/);
});
