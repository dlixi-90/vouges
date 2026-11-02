import test from "node:test";
import assert from "node:assert/strict";
import {accordOpening} from "../../client/src/utils/accordOpening.js";
import {articleToPlainText} from "../../client/src/utils/productArticle.js";

const text=(value,marks)=>({type:"text",text:value,...(marks?{marks}:{})});
const paragraph=content=>({type:"paragraph",content});
const normalize=value=>value.replace(/\s+/gu," ").trim();
const readable=view=>[...view.intro.map(articleToPlainText),...view.facts.flatMap(section=>[section.title,...section.fields.flatMap(field=>[field.label,articleToPlainText(field.content)])])].join(" ");
const metadata=[text("Dữ liệu mùi hương ",[{type:"bold"}]),text(" Loại: Nguyên liệu tổng hợp "),text("Nhóm hương chính: Tự nhiên và tổng hợp "),text("Bộ phận sử dụng: Hợp chất tổng hợp "),text("Kết hợp ấn tượng với: Cam chanh (Citruses), Xạ hương (Musk).")];

test("merged accord data becomes labeled facts without changing any source words or stored nodes",()=>{
  const nodes=[paragraph([text("Mùi biển mang sắc thái trong lành. "),...metadata])],before=structuredClone(nodes),view=accordOpening(nodes);
  assert.equal(view.intro.length,1);assert.equal(articleToPlainText(view.intro[0]),"Mùi biển mang sắc thái trong lành.");
  assert.deepEqual(view.facts[0].fields.map(field=>field.label),["Loại:","Nhóm hương chính:","Bộ phận sử dụng:","Kết hợp ấn tượng với:"]);
  assert.equal(articleToPlainText(view.facts[0].fields[0].content),"Nguyên liệu tổng hợp");
  assert.equal(articleToPlainText(view.facts[0].fields.at(-1).content),"Cam chanh (Citruses), Xạ hương (Musk).");
  assert.equal(view.facts[0].fields.at(-1).wide,true);
  assert.equal(normalize(readable(view)),normalize(nodes.map(articleToPlainText).join(" ")));assert.deepEqual(nodes,before);
});

test("alternate group labels and an omitted source-part field remain accurate without invented information",()=>{
  for(const group of ["Nhóm hương:","Nhóm hương chính:"]){
    const source=paragraph([text(`Giới thiệu. Dữ liệu mùi hương: Loại: Hợp chất tổng hợp ${group} Đồ uống (Beverages) Kết hợp ấn tượng với: Vani (Vanilla).`)]);
    const view=accordOpening([source]);assert.equal(view.facts[0].fields.length,3);assert.equal(view.facts[0].fields[1].label,group);
    assert.equal(normalize(readable(view)),normalize(articleToPlainText(source)));
  }
});

test("links, emphasis and line breaks survive splits across text-node boundaries",()=>{
  const marks=[{type:"link",attrs:{href:"/knowledge/note/hoa-hong",target:"_blank",rel:"noopener noreferrer nofollow"}}];
  const source=paragraph([text("Giới thiệu. Dữ liệu mùi hương Lo"),text("ại: Tự nhiên Nhóm hương: Hoa Bộ phận sử dụng: Cánh hoa Kết hợp ấn tượng với: "),text("Hoa Hồng",marks),{type:"hardBreak"},text("Vani",[{type:"italic"}])]);
  const field=accordOpening([source]).facts[0].fields.at(-1).content.content[0];
  assert.deepEqual(field.content[0].marks,marks);assert.equal(field.content[1].type,"hardBreak");assert.deepEqual(field.content[2].marks,[{type:"italic"}]);
  assert.equal(normalize(readable(accordOpening([source]))),normalize(articleToPlainText(source)));
});

test("sentence-separated imported paragraphs regain breaks while incomplete data stays untouched",()=>{
  const first="Một đoạn giới thiệu dài về sắc thái mùi hương và cách cảm nhận, được giữ nguyên lời văn để khách hàng có thể đọc trọn vẹn những thông tin trong bài.";
  const source=paragraph([text(first),text(" "),text("Đoạn tiếp theo mô tả chi tiết khác. "),...metadata]);
  const view=accordOpening([source]);assert.equal(view.intro.length,2);assert.equal(articleToPlainText(view.intro[0]),first);
  for(const value of ["Đây là một đoạn văn thường.","Dữ liệu mùi hương chưa đầy đủ.","Dữ liệu mùi hương Loại: Tự nhiên Kết hợp ấn tượng với: "]){
    const node=paragraph([text(value)]),result=accordOpening([node]);assert.deepEqual(result.intro,[node]);assert.deepEqual(result.facts,[]);
  }
});
