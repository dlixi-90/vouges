import test from "node:test";
import assert from "node:assert/strict";
import {knowledgePresentation} from "../../client/src/utils/knowledgePresentation.js";

const paragraph = text => ({type:"paragraph",content:[{type:"text",text}]});
const heading = text => ({type:"heading",attrs:{level:2},content:[{type:"text",text}]});
const image = {type:"image",attrs:{src:"/images/hero.webp",alt:"Ảnh mở đầu",title:"Chú thích gốc",articleWidth:100,width:980,height:253}};
const portrait = {...image,attrs:{...image.attrs,width:300,height:300}};
const term = (name, englishName, kind, blocks) => ({name,englishName,kind,descriptionContent:{type:"doc",content:blocks}});

test("a bilingual group title and its leading English heading become one header; article and image details remain",()=>{
  const original=term("Cam Chanh (Citrus)","Citrus","group",[image,heading("Citrus"),paragraph("Giới thiệu."),heading("Nguồn gốc"),paragraph("Nội dung đầy đủ.")]);
  const before=structuredClone(original),view=knowledgePresentation(original);
  assert.equal(view.title,"Cam Chanh");assert.equal(view.secondaryTitle,"Citrus");assert.equal(view.mergedHeading,true);
  assert.deepEqual(view.hero,image);assert.deepEqual(view.body.content,original.descriptionContent.content.slice(2));assert.deepEqual(view.intro.content,[]);assert.deepEqual(original,before);
});
test("English-first combined titles and Vietnamese-first article headings normalize to the same bilingual header",()=>{
  for(const title of ["Citrus (Cam Chanh)","Cam Chanh (Citrus)"]){
    const view=knowledgePresentation(term(title,"Citrus","group",[image,heading("Cam Chanh"),paragraph("Văn bản.")]));
    assert.equal(view.title,"Cam Chanh");assert.equal(view.secondaryTitle,"Citrus");assert.equal(view.mergedHeading,true);
  }
  const reversed=knowledgePresentation(term("Vetiver","Vetiver","note",[image,heading("Cỏ Hương Bài"),paragraph("Giới thiệu.")]));
  assert.equal(reversed.title,"Cỏ Hương Bài");assert.equal(reversed.secondaryTitle,"Vetiver");assert.equal(reversed.mergedHeading,true);
});
test("an imported translation without metadata is retained in the unified header; spelling variants do not duplicate it",()=>{
  const cloves=knowledgePresentation(term("Đinh hương","","note",[image,heading("Cloves"),paragraph("Nhóm: Gia vị"),paragraph("Nội dung.")]));
  assert.equal(cloves.label,"Đinh hương (Cloves)");assert.equal(cloves.mergedHeading,true);
  const cola=knowledgePresentation(term("Coca Cola","Coca-cola","accord",[image,heading("Coca-cola"),paragraph("Nội dung.")]));
  assert.equal(cola.title,"Coca Cola");assert.equal(cola.secondaryTitle,"");assert.equal(cola.mergedHeading,true);
});
test("portrait introductions move intact beside the image; later headings, links and content remain in order",()=>{
  const intro=paragraph("Nội dung có liên kết.");intro.content[0].marks=[{type:"link",attrs:{href:"/knowledge/note/hoa-hong",target:"_blank",rel:"noopener noreferrer nofollow"}}];
  const blocks=[portrait,heading("Rose"),paragraph("Nhóm: Hoa"),intro,heading("Lịch sử"),paragraph("Thông tin khác.")];
  const view=knowledgePresentation(term("Hoa Hồng","Rose","note",blocks));
  assert.equal(view.layout,"portrait");
  assert.deepEqual(view.intro.content,blocks.slice(2,4));assert.deepEqual(view.body.content,blocks.slice(4));
});
test("landscape note images remain full-width banners; old dimensionless covers use the known library format",()=>{
  const view=knowledgePresentation(term("Hoa Hồng","Rose","note",[image,heading("Rose"),paragraph("Nhóm: Hoa"),paragraph("Giới thiệu.")]));
  assert.equal(view.layout,"banner");assert.equal(view.intro.content.length,0);assert.equal(view.body.content.length,2);
  const dimensionless={...image,attrs:{src:image.attrs.src,alt:image.attrs.alt,articleWidth:100}};
  for(const kind of ['group','note','accord']){
    const result=knowledgePresentation(term("Hoa Hồng","Rose",kind,[dimensionless,heading("Rose"),paragraph("Giới thiệu.")]));
    assert.equal(result.layout,kind==='accord'?'accord':'banner');
  }
});
test("generic or unrelated headings, linked titles, plain-text entries and missing images do not lose content",()=>{
  for(const title of ["Introduction","Giới thiệu","Lịch sử hoa hồng"]){
    const blocks=[image,heading(title),paragraph("Nội dung đầy đủ.")],view=knowledgePresentation(term("Hoa Hồng","Rose","note",blocks));
    assert.equal(view.mergedHeading,false);assert.deepEqual(view.body.content,blocks.slice(1));assert.equal(view.title,"Hoa Hồng");
  }
  const linked=heading("Rose");linked.content[0].marks=[{type:"link",attrs:{href:"/knowledge/note/hoa-hong",target:"_blank",rel:"noopener noreferrer nofollow"}}];
  const view=knowledgePresentation(term("Hoa Hồng","Rose","note",[image,linked,paragraph("Nội dung.")]));
  assert.equal(view.mergedHeading,false);assert.deepEqual(view.body.content[0],linked);
  const plain=knowledgePresentation({name:"Hoa Hồng",kind:"note",description:"Văn bản thường."});
  assert.equal(plain.hero,null);assert.equal(plain.body.content[0].content[0].text,"Văn bản thường.");
});

const categoryCards = {type:"libraryCards",attrs:{columns:3,items:["Nước hoa nam","Nước hoa nữ","Nước hoa unisex"].map(name=>({name,href:"/collection?"+new URLSearchParams({category:name}),image:"/images/category.webp"}))}};

test("gender-navigation heading and cards are removed while article content, product recommendations and stored data survive",()=>{
  const productCards={type:"libraryCards",attrs:{columns:3,items:[{name:"Sản phẩm tiêu biểu",href:"/collection/6a0000000000000000000001",image:"/images/product.webp",description:"Mô tả giữ nguyên."}]}};
  const original=term("Cam Chanh","Citrus","group",[image,heading("Citrus"),paragraph("Thông tin về nguyên liệu."),productCards,heading("Khám phá nước hoa theo giới tính"),categoryCards,heading("Thông tin bổ sung"),paragraph("Nội dung tiếp theo.")]);
  const before=structuredClone(original),view=knowledgePresentation(original);
  assert.equal(view.removedNavigation.length,2);
  assert.deepEqual(view.body.content.map(node=>node.type),["paragraph","libraryCards","heading","paragraph"]);
  assert.equal(view.body.content[1].attrs.items[0].href,productCards.attrs.items[0].href);
  assert.equal(view.body.content[1].attrs.items[0].description,"Mô tả giữ nguyên.");
  assert.equal(view.body.content.at(-1).content[0].text,"Nội dung tiếp theo.");
  assert.deepEqual(original,before);
});

test("a heading without category navigation and ordinary shopping links remain part of the article",()=>{
  const linked=paragraph("Nước hoa nam");linked.content[0].marks=[{type:"link",attrs:{href:"/collection?category=N%C6%B0%E1%BB%9Bc+hoa+nam",target:"_blank",rel:"noopener noreferrer nofollow"}}];
  const view=knowledgePresentation(term("Hoa Hồng","Rose","note",[heading("Khám phá nước hoa theo giới tính"),linked,paragraph("Giới thiệu nguyên liệu.")]));
  assert.equal(view.removedNavigation.length,0);
  assert.equal(view.body.content.length,3);
  assert.equal(view.body.content[1].content[0].marks[0].attrs.href,linked.content[0].marks[0].attrs.href);
  for(const kind of ["group","accord","note"]){
    const result=knowledgePresentation(term("Tên","Name",kind,[paragraph("Nội dung."),categoryCards]));
    assert.equal(result.removedNavigation.length,1);assert.equal(result.body.content.length,1);
  }
});
