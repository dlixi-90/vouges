import {sanitizeArticle,articleToPlainText} from '../../client/src/utils/productArticle.js';
import {summarizeNote} from './library-note-summary.mjs';
import {mentionsSourceStore} from './library-parser.mjs';
import {articleSection} from './product-article-parser.mjs';
const p=text=>({type:'paragraph',content:[{type:'text',text}]}),h=text=>({type:'heading',attrs:{level:2},content:[{type:'text',text}]});
const clean=value=>String(value||'').replace(/apa[\W_]*niche/giu,'').replace(/\s+/gu,' ').trim();
const names=rows=>[...new Set((rows||[]).map(row=>clean(typeof row==='string'?row:row.name||row.label)).filter(Boolean))];
export const articleWords=node=>node?.type==='image'?0:node?.type==='text'?node.text.trim().split(/\s+/u).filter(Boolean).length:(node?.content||[]).reduce((n,child)=>n+articleWords(child),0);
export function designDetails(article){
 const source=article.blocks.filter(b=>/thiết kế|bao bì|ngoại hình|kiểu dáng/iu.test(b.section)).map(b=>b.text).join(' ');
 const labels=[...article.facts.design];
 const extra=[
  ['thân chai phủ vàng',/thân chai[^.!?]{0,15}(?:phủ|mạ|sơn)[^.!?]{0,15}vàng/iu],
  ['nắp dạng cầu',/nắp[^.!?]{0,18}(?:hình cầu|tròn)/iu],
  ['nắp có vân tối màu',/nắp[^.!?]{0,45}đen[^.!?]{0,15}(?:vân|loang)/iu],
  ['nắp bằng gỗ',/nắp[^.!?]{0,18}(?:bằng |chất liệu )?gỗ/iu],
  ['nắp gốm hoặc sứ',/nắp[^.!?]{0,28}(?:gốm|sứ)/iu],
  ['chi tiết chế tác thủ công',/thủ công/iu],
  ['tạo hình gợi cơ thể',/thân (?:người|hình|thể)|hình (?:cơ thể|bán thân)/iu],
  ['bề mặt có gân dọc',/sọc dọc|gân dọc/iu],
  ['tạo hình ngôi sao',/hình ngôi sao|hình sao/iu],
  ['bề mặt đen bóng',/lớp ngoài đen bóng|thân chai[^.!?]{0,20}đen bóng/iu],
  ['cổ chai màu trắng',/cổ chai[^.!?]{0,14}trắng/iu],
  ['đường viền ánh vàng',/viền vàng|viền mạ vàng/iu],
  ['tạo hình hộp có cạnh rõ',/hộp vuông|hộp chữ nhật|sắc cạnh/iu],
 ];
 for(const[label,pattern]of extra)if(pattern.test(source)&&!labels.includes(label))labels.push(label);
 return labels.slice(0,5);
}
const inspirations=[
 ['Aphrodite','Adonis','câu chuyện Aphrodite và Adonis trong thần thoại Hy Lạp'],
 ['Pompeii',null,'di sản nghệ thuật Pompeii'],
 ['Địa Trung Hải',null,'cảnh quan Địa Trung Hải'],
 ['vườn Nhật',null,'không gian vườn Nhật Bản'],
 ['sa mạc',null,'cảnh quan sa mạc'],
 ['biển cả',null,'không gian biển và gió'],
 ['cognac',null,'thế giới rượu cognac'],
];
export function productArticleSections(product,article,fallback,override){
 if(override)return Object.entries(override).map(([key,paragraphs])=>({key,heading:{intro:'Giới thiệu',design:'Thiết kế',scent:'Mùi hương'}[key],paragraphs}));
 const kind=product.fragrance?.profileKind||'perfume';
 if(article.characters<120||!['perfume','diffuser'].includes(kind)){
  const sections=[];
  for(const node of fallback.descriptionContent.content){
   if(node.type==='heading')sections.push({key:/thiết kế/iu.test(node.content[0].text)?'design':/hương|mùi/iu.test(node.content[0].text)?'scent':'intro',heading:node.content[0].text,paragraphs:[]});
   else if(node.type==='paragraph')sections.at(-1)?.paragraphs.push(node.content.map(n=>n.text||'').join(''));
  }
  return sections;
 }
 const title=clean(product.title),brand=clean(product.brand),facts=article.facts;
 const full=article.blocks.map(b=>b.text).join(' '),intro=[],scent=[],design=[],usage=[];
 const opening=[`${title}${facts.launchYear?` được giới thiệu năm ${facts.launchYear}`:` là ${kind==='diffuser'?'sản phẩm tạo hương':'nước hoa'}${brand?` của ${brand}`:''}`}.`];
 if(facts.perfumers.length)opening.push(`Sáng tạo gắn với nhà điều hương ${facts.perfumers.join(' và ')}.`);
 intro.push(opening.join(' '));
 const ideaSentences=full.split(/(?<=[.!?])\s+/u).filter(sentence=>/cảm hứng|thần thoại|câu chuyện/iu.test(sentence));
 const idea=inspirations.find(([a,b])=>ideaSentences.some(sentence=>sentence.toLocaleLowerCase('vi-VN').includes(a.toLocaleLowerCase('vi-VN'))&&(!b||sentence.includes(b))));
 if(idea)intro.push(`Ý tưởng của sản phẩm gắn với ${idea[2]}.`);
 else if(facts.inspiration)intro.push(`Nguồn cảm hứng của sáng tạo là ${facts.inspiration.replace(/\.$/u,'')}.`);
 const heritage=[['đá mặt trăng','đá mặt trăng'],['Sardinia','vùng Sardinia'],['Marly','di sản Marly'],['đảo Pantelleria','đảo Pantelleria'],['vịnh Hạ Long','vịnh Hạ Long']].find(([key])=>full.includes(key)&&/cảm hứng|gợi nhớ|tên gọi/iu.test(full));
 if(heritage&&!idea&&!facts.inspiration)intro.push(`Câu chuyện của sáng tạo có liên hệ với ${heritage[1]}.`);
 const details=designDetails(article);
 if(details.length)design.push(`Thiết kế được nhận diện qua ${details.join(', ')}. Những chi tiết này tạo nên diện mạo riêng của chai, bên cạnh tính cách của hương thơm.`);
 const explicitScent=article.blocks.filter(b=>articleSection(b.section)==='scent');
 const scentBlocks=explicitScent.length?explicitScent:article.blocks.filter(b=>articleSection(b.section)!=='design'&&/mùi|hương/iu.test(b.text));
 const descriptors=summarizeNote({blocks:scentBlocks.map(b=>({type:'paragraph',text:b.text}))},title).descriptors;
 const specific=descriptors.filter(label=>label!=='hoa'||!descriptors.some(v=>/^hoa /u.test(v))).slice(0,6);
 if(specific.length)scent.push(`Hương phát triển theo hướng ${specific.join(', ')}, tạo những lớp cảm nhận khác nhau từ lúc mở đầu đến khi lắng trên da.`);
 const phases=Object.keys(facts.articleNotes).length>=2?facts.articleNotes:product.fragrance?.notes;
 const nonempty=Object.entries(phases||{}).filter(([,rows])=>names(rows).length);
 if(nonempty.length===1||nonempty.length>1&&nonempty.every(([,rows])=>names(rows).length===1))scent.push(`Các note được ghi nhận gồm ${names(nonempty.flatMap(([,rows])=>rows)).slice(0,7).join(', ')}.`);
 else {
  const notes=[['top','Phần mở đầu'],['middle','Lớp giữa'],['base','Phần nền'],['general','Những note khác']].flatMap(([phase,label])=>{
   const values=names(phases?.[phase]).slice(0,4);return values.length?[`${label} có ${values.join(', ')}.`]:[];
  });
  if(notes.length)scent.push(notes.join(' '));
 }
 if(!scent.length&&fallback.descriptionContent){
  const paragraphs=fallback.descriptionContent.content.filter(n=>n.type==='paragraph').map(node=>node.content.map(n=>n.text||'').join(''));
  scent.push(...paragraphs.slice(-2));
 }
 const suggestions=article.blocks.flatMap(block=>block.text.split(/(?<=[.!?])\s+/u)).filter(sentence=>/phù hợp|thích hợp|lý tưởng|lựa chọn/iu.test(sentence)&&!/không|tránh|hạn chế|thay vì/iu.test(sentence)).join(' ');
 const settings=[['công sở|văn phòng','môi trường làm việc'],['hẹn hò|lãng mạn','những dịp hẹn hò'],['tiệc tối|buổi tối|ban đêm','các buổi tối'],['ngày hè|mùa hè','mùa hè'],['mùa đông|ngày lạnh|mùa lạnh','thời tiết lạnh'],['mùa thu','mùa thu'],['hằng ngày|hàng ngày','sinh hoạt thường ngày']].filter(([pattern])=>new RegExp(pattern,'iu').test(suggestions)).map(([,label])=>label).slice(0,2);
 if(settings.length)usage.push(`Về bối cảnh sử dụng, hương thơm được gợi ý cho ${settings.join(' và ')}.`);
 return [{key:'intro',heading:'Giới thiệu',paragraphs:intro},{key:'design',heading:'Thiết kế',paragraphs:design},{key:'scent',heading:'Mùi hương',paragraphs:scent},{key:'usage',heading:'Phong cách sử dụng',paragraphs:usage}].filter(section=>section.paragraphs.length);
}

export function buildProductArticle(product,article,assets,fallback,override){
 const sections=productArticleSections(product,article,fallback,override),nodes=[],used=new Set();let budget=0;
 const addImages=key=>{
  for(const image of article.images.filter(image=>image.section===key)){
   const asset=assets.get(image.sourceUrl);if(!asset)continue;
   if(used.has(asset.src))continue;used.add(asset.src);
   nodes.push({type:'image',attrs:{src:asset.src,alt:`${clean(product.title)} — ${key==='design'?'thiết kế':key==='scent'?'minh họa hương thơm':'hình ảnh sản phẩm'}`,title:'',articleWidth:100,...(asset.width&&asset.height?{width:asset.width,height:asset.height}:{})}});
  }
 };
 for(const section of sections){
  const content=[];
  for(const text of section.paragraphs){const size=text.split(/\s+/u).length;if(budget+size+section.heading.split(/\s+/u).length<=200){content.push(p(text));budget+=size;}}
  if(content.length){nodes.push(h(section.heading),...content);budget+=section.heading.split(/\s+/u).length;}
  addImages(section.key);
 }
 // Preserve every distinct editorial illustration even when its original section
 // was purely commercial or did not contain an eligible paragraph.
 for(const key of ['intro','design','scent'])addImages(key);
 const document=sanitizeArticle({type:'doc',content:nodes});
 const description=articleToPlainText(document).trim();
 if(articleWords(document)>200||description.length>5000||mentionsSourceStore(description)||nodes.filter(n=>n.type==='paragraph').length===0)throw Error(`Invalid article: ${product.title}`);
 return {description,descriptionContent:document,imageCount:used.size,sourceWords:articleWords(document)};
}
