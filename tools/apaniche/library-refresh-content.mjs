import {summarizeNote} from './library-note-summary.mjs';

const words=value=>String(value).trim().split(/\s+/u).filter(Boolean);
const plain=content=>content.blocks.filter(b=>b.type==='paragraph').map(b=>b.text).join(' ');
const list=values=>[...new Set(values)].join(', ');
const bounded=(source,value)=>new RegExp(`(?<![\\p{L}])${value}(?![\\p{L}])`,'iu').test(source);

export function sourceExcerpt(content){
 const paragraphs=content.blocks.filter(b=>b.type==='paragraph'&&words(b.text).length>25);
 const paragraph=paragraphs.find(b=>/mùi|sắc thái|cảm giác|hương thơm/iu.test(b.text)&&!/(?:chữa|điều trị|sức khỏe|trị liệu|1973|Gerald Ghislain)/iu.test(b.text))||paragraphs[0];
 return paragraph?words(paragraph.text).slice(0,20).join(' ').replace(/[,;:]$/u,'')+'…':'';
}

const places=['Calabria','Sicily','Lorraine','Grasse','Madagascar','Bulgaria','Morocco','Maroc','Tunisia','Brazil','Peru','Indonesia','Malaysia','Australia','Úc','Nhật Bản','Trung Quốc','Ấn Độ','Ai Cập','Thổ Nhĩ Kỳ','Nam Phi','Nam Mỹ','Trung Mỹ','châu Phi','Bắc Mỹ','Địa Trung Hải','Đông Nam Á','Himalaya','Việt Nam'];
const molecules=['linalool','linalyl acetate','citral','geraniol','citronellol','indole','coumarin','eugenol','vanillin','muscone','Ambroxan','Iso E Super','Hedione','Safraleine','Cashmeran','Calone','aldehyde','lactone','ester'];
export function noteIntroduction(content,name,manual){
 const source=plain(content),fact=summarizeNote(content,name),paragraphs=[];
 if(manual)paragraphs.push(manual);
 else {
  const english=content.englishName&&content.englishName.toLowerCase()!==name.toLowerCase()?` (${content.englishName})`:'';
  paragraphs.push(fact.descriptors.length?`${name}${english} gợi những nét ${list(fact.descriptors)} trong cách diễn đạt bằng hương thơm.`:`${name}${english} được mô tả với mùi riêng rất nhẹ, gần với một cảm giác bề mặt hoặc không gian hơn là hương nguyên liệu rõ rệt.`);
 }
 if(manual)return paragraphs;
 if(content.group)paragraphs.push(`Trong thư viện nguyên liệu, note này thuộc ${content.group}.`);
 const geography=places.filter(place=>bounded(source,place)).slice(0,3);
 const botanical=source.match(/\b((?:Citrus|Rosa|Jasminum|Santalum|Cedrus|Vetiveria|Chrysopogon|Pogostemon|Lavandula|Boswellia|Commiphora|Cananga|Prunus|Pyrus|Ficus|Quercus|Iris|Vanilla|Cinnamomum|Mentha|Salvia|Ocimum|Pinus|Abies|Artemisia|Angelica|Piper|Elettaria|Coffea|Theobroma|Ribes|Lilium|Nymphaea|Michelia|Magnolia|Polianthes|Agave|Plumeria|Osmanthus|Styrax|Liquidambar|Aquilaria|Dipteryx|Helichrysum|Mimosa|Acacia|Eucalyptus|Rosmarinus|Laurus|Juniperus|Pelargonium|Vitis|Zingiber|Myristica|Daucus|Ambrette|Abelmoschus|Adansonia) [a-z]{3,})\b/u)?.[1];
 if(botanical)paragraphs.push(`Tên thực vật được bài viết nhắc đến là ${botanical}${geography.length?`; địa danh liên quan gồm ${list(geography)}`:''}.`);
 else if(geography.length)paragraphs.push(`Về nguồn gốc và bối cảnh nguyên liệu, bài viết nhắc đến ${list(geography)}.`);
 const recreated=/mô phỏng|tái tạo|tái hiện|hợp hương|tổng hợp/iu.test(source);
 const difficult=/khó chiết|không (?:thể|có khả năng) chiết|không thu được|không có tinh dầu/iu.test(source);
 if(difficult&&recreated)paragraphs.push('Mùi được tái dựng bằng phối hương; việc nhắc đến tên nguyên liệu không đồng nghĩa có tinh dầu chiết trực tiếp từ nguyên liệu ấy.');
 else if(recreated)paragraphs.push('Bài viết cũng đề cập cách tái hiện sắc thái này bằng các chất hương hoặc một tổ hợp mùi.');
 const chemistry=molecules.filter(m=>bounded(source,m)).slice(0,3);
 if(chemistry.length)paragraphs.push(`Phần giải thích về chất hương có nhắc đến ${list(chemistry)}.`);
 if(/ép lạnh/iu.test(source)&&!difficult)paragraphs.push('Ép lạnh là một phương pháp được đề cập khi nói về việc thu nhận hương của nguyên liệu.');
 else if(/chưng cất(?: bằng)? (?:hơi nước|lôi cuốn)/iu.test(source)&&!difficult)paragraphs.push('Phần chế tác đề cập phương pháp chưng cất với hơi nước để thu nhận phần thơm.');
 const roles=[];
 if(/(?:tầng|hương) (?:đầu|mở đầu)/iu.test(source))roles.push('mở đầu');
 if(/(?:tầng|hương) giữa/iu.test(source))roles.push('phần giữa');
 if(/(?:tầng|hương) cuối|làm nền|nền hương/iu.test(source))roles.push('phần nền');
 if(roles.length)paragraphs.push(`Trong cấu trúc nước hoa, các vị trí được nhắc đến là ${list(roles)}.`);
 return paragraphs;
}

export function articleIntroduction(row,manual){
 const {content,name,kind}=row;
 if(!content.blocks.length)return [];
 if(kind==='note')return noteIntroduction(content,name,manual);
 if(!manual)throw Error(`Missing reviewed introduction: ${kind} ${name}`);
 const paragraphs=[manual],source=plain(content);
 if(kind==='brand'){
  const examples=content.blocks.filter(b=>b.type==='heading'&&b.text.toLowerCase().includes(name.toLowerCase()))
   .map(b=>b.text.replace(/^(?:Nước hoa (?:nam |nữ |unisex |cao cấp |niche )?|Dầu thơm |Nuoc hoa )/iu,''))
   .filter(value=>!/[?:]|thương hiệu|bộ sưu tập|sức hút|đôi nét|lịch sử|đánh giá|top \d|các |những |vì sao|review|giá |phân biệt|bao nhiêu|xuất xứ|thiết kế|mùi hương|được ưa|yêu thích nhất|tại sao|của nước|khám phá|thông tin|giới thiệu|lý giải|tìm hiểu|có thơm/iu.test(value)&&words(value).length<15&&value!==name).slice(0,3);
  if(examples.length&&examples.filter(value=>manual.includes(value.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*`,'iu'),''))).length<2)paragraphs.push(`Các sáng tạo được bài viết giới thiệu gồm ${list(examples)}. Mỗi tên mở ra một hướng khám phá phong cách của nhà hương.`);
  const design=[];
  if(/tối giản/iu.test(source))design.push('cách thể hiện tối giản');
  if(/pha lê/iu.test(source))design.push('chi tiết pha lê trên thiết kế chai');
  if(/thủ công/iu.test(source))design.push('yếu tố thủ công');
  if(/nghệ thuật/iu.test(source))design.push('mối liên hệ với nghệ thuật');
  if(/ký ức|kí ức|kỷ niệm/iu.test(source))design.push('cảm hứng từ ký ức');
  if(design.length)paragraphs.push(`Bên cạnh hương thơm, bài gốc còn đề cập ${list(design.slice(0,3))}.`);
 }else{
  if(content.noteNames.length)paragraphs.push(`Những note được liên kết trong bài gồm ${list(content.noteNames.slice(0,6))}. Chúng giúp minh họa các cách thể hiện của ${name.toLocaleLowerCase('vi-VN')}; mỗi công thức có thể chọn một tổ hợp khác nhau.`);
  const part=content.blocks.find(b=>/^Bộ phận sử dụng:/iu.test(b.text))?.text.split(':').slice(1).join(':').trim();
  if(part&&words(part).length<=12)paragraphs.push(`Về vật liệu tạo mùi, bài viết đề cập ${part.charAt(0).toLocaleLowerCase('vi-VN')+part.slice(1)}.`);
  const chemistry=molecules.filter(m=>bounded(source,m)).slice(0,3);
  if(chemistry.length)paragraphs.push(`Trong phần giải thích về vật liệu hương, bài viết có nhắc đến ${list(chemistry)}.`);
  if(/chiết xuất dung môi/iu.test(source))paragraphs.push('Phần chế tác đề cập chiết xuất bằng dung môi để thu nhận chất thơm, đồng thời phân biệt mùi nguyên liệu với hiệu ứng được tái dựng trong nước hoa.');
  else if(/phân tử tổng hợp|hợp chất tổng hợp|accord tổng hợp/iu.test(source))paragraphs.push('Hiệu ứng này có thể được tạo nên từ phối hợp các chất hương; tên gọi mô tả điều ta cảm nhận khi ngửi.');
  if(kind==='group'){
   const seasons=['xuân','hè','thu','đông'].filter(s=>new RegExp(`mùa ${s}(?![\\p{L}])`,'iu').test(source));
   const occasions=[];
   if(/công sở|văn phòng/iu.test(source))occasions.push('môi trường làm việc');
   if(/buổi tối|tiệc tối|date night/iu.test(source))occasions.push('những dịp buổi tối');
   if(seasons.length||occasions.length)paragraphs.push(`Về bối cảnh sử dụng, bài viết gợi ý ${[seasons.length?`các mùa ${list(seasons)}`:'',...occasions].filter(Boolean).join(' và ')}.`);
  }
 }
 return paragraphs;
}

export function boundParagraphs(paragraphs,budget=155){
 const result=[];let used=0;
 for(const p of paragraphs){const size=words(p).length;if(used+size<=budget){result.push(p);used+=size;}}
 return result;
}
