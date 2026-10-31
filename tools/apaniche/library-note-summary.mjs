const concepts=[
 ['gỗ khô',/gỗ khô|dry woody/giu],['gỗ',/hương gỗ|mùi gỗ|nốt gỗ|woody/giu],['nhựa thơm',/nhựa thơm|ngọt nhựa|resinous|balsamic/giu],
 ['rêu',/rêu(?: sồi)?|mossy/giu],['đất ẩm',/đất ẩm|đất sau mưa|earthy/giu],['khói',/khói|smoky/giu],['da thuộc',/da thuộc|da thú|leathery/giu],
 ['xạ hương',/xạ hương|musky/giu],['hổ phách',/hổ phách|ambery/giu],['phấn',/phấn(?: mịn| thơm)?|powdery/giu],['kem sữa',/kem sữa|sữa béo|béo sữa|lactonic|creamy/giu],
 ['kem',/kem|ngậy/giu],['bơ',/bơ|buttery/giu],['sáp',/sáp/giu],['mật ong',/mật ong|thoảng mật|phấn mật|honeyed/giu],['vani',/vani(?:lla)?/giu],
 ['caramel',/caramel|caramen|đường cháy/giu],['ca cao',/ca ?cao|cacao|cocoa/giu],['chocolate',/chocolate|sô cô la|socola/giu],['cà phê',/cà ?phê|café|coffee/giu],
 ['hạnh nhân',/hạnh nhân|almond/giu],['hạt bùi',/ngọt bùi|béo bùi|nutty/giu],['dừa',/dừa|coconut/giu],['trái cây',/trái cây|fruity/giu],
 ['cam chanh',/cam chanh|cam quýt|citrus/giu],['chanh',/hương chanh|mùi chanh|sắc chanh|lemony/giu],['quả mọng',/quả mọng|berry/giu],['đào',/hương đào|mùi đào/giu],
 ['dứa',/hương dứa|mùi dứa/giu],['táo',/hương táo|mùi táo/giu],['hoa',/hương hoa|mùi hoa|floral/giu],['hoa trắng',/hoa trắng/giu],
 ['hoa hồng',/hoa hồng|rosy/giu],['hoa nhài',/hoa nhài|jasmine/giu],['hoa cam',/hoa cam/giu],['diên vĩ',/diên vĩ|orris/giu],['violet',/violet/giu],
 ['thảo mộc',/thảo mộc|herbal/giu],['bạc hà',/bạc hà|minty/giu],['hồi và cam thảo',/cam thảo|anise/giu],['tiêu',/tiêu cay|tiêu đen|peppery/giu],
 ['quế',/hương quế|mùi quế/giu],['gia vị',/gia vị|spicy/giu],['muối biển',/muối biển|hơi mặn|mằn mặn|salty/giu],['biển',/hương biển|mùi biển|marine/giu],
 ['ozon',/ozon/giu],['khoáng',/khoáng|mineral/giu],['kim loại',/kim loại|metallic/giu],['long não',/long não|camphor/giu],['thuốc lá',/thuốc lá|tobacco/giu],
 ['rượu',/mùi rượu|hương rượu|rum|whisky|whiskey|boozy/giu],['lên men',/lên men|fermented/giu],['động vật',/animalic|mùi động vật|hương động vật/giu],
 ['xanh',/xanh(?: tươi| mát| thảo| lá)?|green/giu],['chua thanh',/chua(?: thanh| nhẹ)?/giu],['đắng nhẹ',/đắng(?: nhẹ)?|bitter/giu],
 ['ngọt nhẹ',/ngọt nhẹ|ngọt dịu|ngọt thanh|ngọt mảnh/giu],['ngọt',/ngọt|sweet/giu],['ấm',/ấm(?: áp)?|warm/giu],['mát',/mát(?: lạnh| lành)?|the lạnh|cooling/giu],
 ['sạch',/sạch(?: sẽ)?|clean/giu],['mịn',/mịn(?: màng)?|mềm mượt/giu],['khô',/khô(?: ráo)?|dry/giu],['ẩm',/ẩm(?: ướt)?|damp/giu],
];
const normalize=s=>s.normalize('NFC').toLocaleLowerCase('vi-VN');
const negated=(sentence,index)=>/(?:không|không hề|không quá|chẳng|không cần)(?:\s+[\p{L}]+){0,4}\s*$/u.test(sentence.slice(Math.max(0,index-48),index));

export function summarizeNote(content,name){
 const sentences=content.blocks.filter(b=>b.type==='paragraph').flatMap(b=>b.text.split(/(?<=[.!?])\s+/u)).map(normalize);
 const scent=sentences.filter(s=>/mùi|hương|cảm giác|hiệu ứng|thơm|sắc thái|tỏa ra|note này/u.test(s)&&!/^khác với\b/u.test(s));
 const neutral=sentences.some(s=>/gần như không mùi|gần như không có mùi|không mùi hoặc|mùi rất trung tính|gần như vô mùi/u.test(s));
 const found=[];
 for(const[label,pattern]of concepts){
  if(neutral&&!['mát','sạch'].includes(label))continue;
  const bounded=new RegExp(`(?<![\\p{L}])(?:${pattern.source})(?![\\p{L}])`,'giu');
  for(const sentence of scent){
   bounded.lastIndex=0;
   if([...sentence.matchAll(bounded)].some(m=>!negated(sentence,m.index))){found.push(label);break;}
  }
 }
 const specific=new Map([['gỗ','gỗ khô'],['kem','kem sữa'],['ngọt','ngọt nhẹ']]);
 const descriptors=found.filter(x=>!specific.has(x)||!found.includes(specific.get(x))).slice(0,7);
 const paragraphs=[];
 const english=content.englishName&&normalize(content.englishName)!==normalize(name)?` (${content.englishName})`:'';
 paragraphs.push(`${name}${english}${content.group?` được xếp trong nhóm ${content.group}`:' là một note hương được ghi nhận trong thư viện nguyên liệu'}.`);
 if(neutral)paragraphs.push('Đặc trưng được ghi nhận là mùi riêng rất nhẹ hoặc gần như trung tính.');
 else if(descriptors.length)paragraphs.push(`Các sắc thái mùi được ghi nhận: ${descriptors.join(', ')}.`);
 const full=content.blocks.map(b=>b.text).join(' ');
 const botanical=full.match(/\(([A-Z][a-z]{2,}\s[a-z]{3,}(?:\s[a-z]{3,})?)\)/)?.[1];
 if(botanical)paragraphs.push(`Tên thực vật được đề cập: ${botanical}.`);
 if(/mô phỏng|tái tạo|được tổng hợp|hợp hương/i.test(full))paragraphs.push('Trong điều hương, sắc thái này có thể được tái hiện bằng hợp hương hoặc các phân tử hương.');
 const role=[];
 if(/(?:tầng|hương) (?:đầu|mở đầu)/i.test(full))role.push('phần mở đầu');
 if(/(?:tầng|hương) giữa/i.test(full))role.push('phần giữa');
 if(/(?:tầng|hương) cuối|làm nền|định hương|nền hương/i.test(full))role.push('phần nền');
 if(role.length)paragraphs.push(`Vị trí được nhắc đến trong cấu trúc nước hoa: ${role.join(', ')}.`);
 return{paragraphs,descriptors,botanical:botanical||null,needsReview:!neutral&&!descriptors.length};
}
