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
    assert.equal(result.layout,kind==='accord'?'portrait':'banner');
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
