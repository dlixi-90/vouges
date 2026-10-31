import {sanitizeArticle,articleToPlainText} from '../../client/src/utils/productArticle.js';
import {mentionsSourceStore} from './library-parser.mjs';
const p=text=>({type:'paragraph',content:[{type:'text',text}]});
const h=text=>({type:'heading',attrs:{level:2},content:[{type:'text',text}]});
const clean=value=>String(value||'').replace(/apa[\W_]*niche/gi,'').replace(/\s+/g,' ').trim();
const values=rows=>[...new Set((rows||[]).map(row=>clean(typeof row==='string'?row:row.name||row.label)).filter(Boolean))];
const join=rows=>rows.join(', ');
export function buildProductDescription(product,source,parsed,facts,supplement){
 // Intentionally never read product.description or product.descriptionContent.
 const title=clean(product.title),brand=clean(product.brand),f=product.fragrance||{},kind=f.profileKind||'perfume',nodes=[];
 const add=(heading,paragraphs)=>{if(paragraphs.length)nodes.push(h(heading),...paragraphs.map(p));};
 const categories={accessory:'phụ kiện',diffuser:'sản phẩm tạo hương cho xe',bundle:'bộ nước hoa',assortment:'bộ quà tặng với nhiều lựa chọn'};
 const intro=supplement?[supplement.intro]:[`${title} là ${categories[kind]||'nước hoa'}${brand?` thuộc ${brand}`:''}.`];
 if(!supplement){
  const info=[];
  if(product.origin)info.push(`Xuất xứ được ghi nhận: ${clean(product.origin)}`);
  if(product.gender&&kind!=='accessory')info.push(`đối tượng: ${clean(product.gender)}`);
  if(product.concentration&&!['accessory','bundle','assortment'].includes(kind))info.push(`nồng độ: ${clean(product.concentration)}`);
  if(info.length)intro.push(info.join('; ')+'.');
  if(facts.launchYear)intro.push(`Sản phẩm được giới thiệu năm ${facts.launchYear}.`);
  if(facts.perfumers.length)intro.push(`Người sáng tạo được nhắc đến: ${join(facts.perfumers)}.`);
  if(facts.inspiration)intro.push(`Ý tưởng sáng tạo gắn với ${facts.inspiration.replace(/\.$/,'')}.`);
 }
 add('Giới thiệu',intro);
 if(supplement)add('Mùi hương',[supplement.scent]);
 else if(!['accessory','bundle','assortment'].includes(kind)){
  const profile=[];
  if(f.group)profile.push(`Tổ hợp được xếp vào nhóm ${clean(f.group)}.`);
  const accords=values(f.accords).slice(0,5);if(accords.length)profile.push(`Những sắc thái nổi bật gồm ${join(accords)}.`);
  const style=clean(f.style);if(style)profile.push(`Phong cách được mô tả: ${style.replace(/\.$/,'')}.`);
  add('Đặc trưng mùi',profile);
  const phases=[['top','Lớp mở đầu'],['middle','Phần hương giữa'],['base','Nền hương'],['general','Các note được công bố']];
  const notes=Object.keys(facts.articleNotes||{}).length>=2?facts.articleNotes:f.notes;
  const singlePhase=Object.values(notes||{}).filter(rows=>rows?.length).length===1;
  const layers=phases.flatMap(([key,label])=>{const names=values(notes?.[key]);return names.length?[`${singlePhase?'Các note được công bố':label}: ${join(names)}.`]:[];});
  add('Cấu trúc hương',layers);
 }else if(kind==='accessory'){
  add('Đặc điểm',[product.source?.id===46900?'Vỏ khuếch tán Dr. Vranjes Firenze Chrome dùng để chứa lõi hương dành cho xe. Mùi phát ra phụ thuộc vào lõi được chọn, không phải bản thân lớp vỏ.':product.source?.id===32972?'Thiết bị Jo Malone Car Diffuser dùng cùng lõi hương dành cho xe. Phần vỏ và lõi tạo hương là các thành phần riêng, vì vậy phụ kiện không có một tháp hương cố định.':'Hộp hoa là lựa chọn trình bày quà tặng kèm sản phẩm. Phụ kiện không có nồng độ nước hoa hay tầng hương riêng; mùi và dung tích phụ thuộc vào sản phẩm đi kèm.']);
 }else{
  const components=f.components||[],names=values(components).slice(0,8);
  add('Các sản phẩm trong bộ',names.length?[join(names)+'.']:[]);
  const details=(kind==='assortment'?[]:components).filter((c,i,all)=>all.findIndex(other=>other.name===c.name)===i).slice(0,8).flatMap(component=>{
   const notes=values(Object.values(component.notes||{}).flat()).slice(0,4);
   return notes.length?[`${clean(component.name)}: ${join(notes)}.`]:[];
  });
  add('Đặc trưng từng mùi',details);
  const note=clean(f.compositionNote);if(note)add('Cách chọn bộ',[note]);
  if(kind==='assortment')add('Lựa chọn sản phẩm',['Mỗi lựa chọn dung tích hoặc tên bộ tương ứng với một cấu hình quà tặng riêng. Kiểm tra tên lựa chọn để xác định các chai đi kèm trước khi đặt hàng.']);
 }
 const design=supplement?.design||(facts.design.length?`Các chi tiết được giới thiệu: ${join(facts.design)}.`:'');
 if(design)add('Thiết kế',[design]);
 // Keep source summaries bounded; optional design/metadata never displace scent facts.
 const wordCount=()=>articleToPlainText({content:nodes}).trim().split(/\s+/u).length;
 if(wordCount()>200){const lastHeading=nodes.findLastIndex(n=>n.type==='heading');if(lastHeading>=0&&nodes[lastHeading].content[0].text==='Thiết kế')nodes.splice(lastHeading);}
 if(wordCount()>200){const ideaIndex=nodes.findIndex(n=>n.type==='paragraph'&&n.content[0].text.startsWith('Ý tưởng sáng tạo'));if(ideaIndex>=0)nodes.splice(ideaIndex,1);}
 const document=sanitizeArticle({type:'doc',content:nodes});
 const description=articleToPlainText(document).trim();
 if(mentionsSourceStore(description)||description.length<180||description.length>5000||description.split(/\s+/u).length>200)throw Error(`Invalid description: ${title}`);
 return{description,descriptionContent:document};
}
