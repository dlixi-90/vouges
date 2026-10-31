import {parseTree,text} from './product-parser.mjs';
import {mentionsSourceStore} from './library-parser.mjs';
const walk=n=>[n,...(n.children||[]).filter(c=>typeof c==='object').flatMap(walk)];
const commercial=s=>/hotline|liên hệ|giao hàng|bảo hành|miễn phí|giá (?:bán|rẻ|tốt)|mua.{0,60}(?:ở đâu|chính hãng)|đặt hàng|có nên mua|địa chỉ mua|cam kết chính hãng|\d[\d.\s]{7,}\d/u.test(s.toLowerCase());
export function parseProductDescription(html){
 const nodes=walk(parseTree(String(html||'').replace(/<\?php[\s\S]*?\?>/gi,''))),blocks=[],excluded=[];
 let section='',skip=false;
 for(const node of nodes.filter(n=>/^(p|li|h[2-4])$/.test(n.tag)&&!walk(n).slice(1).some(c=>c.tag==='p'))){
  const value=text(node).replace(/\[[^\]]*\]/g,'').replace(/\s+/g,' ').trim();if(!value)continue;
  const heading=/^h[2-4]$/.test(node.tag);
  if(heading){section=value;skip=mentionsSourceStore(value)||commercial(value);}
  if(skip||mentionsSourceStore(value)||commercial(value)||/^(?:đang cập nhật|xem thêm|thu gọn|nội dung chính)[.!…\s]*$/iu.test(value)){excluded.push(value);continue;}
  if(!heading&&(value.length>=35||/^(?:tầng\s+)?hương\s+(đầu|giữa|cuối|nền)\s*[:：]/iu.test(value))&&!blocks.some(b=>b.text===value))blocks.push({section,text:value});
 }
 return{blocks,excludedCount:excluded.length,characters:blocks.reduce((n,b)=>n+b.text.length,0)};
}

const designs=[
 ['thân chai trong suốt',/thủy tinh trong suốt|chai trong suốt|thân.{0,20}trong suốt/iu],
 ['thân chai mờ',/thủy tinh mờ|thân chai.{0,20}mờ|chai mờ/iu],
 ['thân chai dạng trụ',/hình trụ|dạng trụ/iu],['đường nét hình chữ nhật',/hình chữ nhật/iu],['hình khối vuông',/hình vuông|vuông vức/iu],
 ['nắp lấy cảm hứng từ kim cương',/nắp.{0,90}kim cương|kim cương.{0,50}nắp/iu],
 ['chi tiết nơ',/chiếc nơ|hình nơ|thắt nơ/iu],['họa tiết hoa',/họa tiết hoa|hoa văn.{0,25}hoa/iu],
 ['các đường gân trên bề mặt',/đường gân|gân nổi/iu],['nắp kim loại',/nắp.{0,35}kim loại/iu],['chi tiết ánh vàng',/mạ vàng|ánh vàng|chi tiết.{0,20}vàng/iu],
 ['nắp màu đen',/nắp(?: chai)?(?: có)? màu đen/iu],['nhãn màu trắng',/nhãn(?: màu)? trắng/iu],['phong cách giản lược',/tối giản|đơn giản/iu],
];
export function productDescriptionFacts(parsed){
 const full=parsed.blocks.map(b=>b.text).join(' ');
 const designText=parsed.blocks.filter(b=>/thiết kế|chai|bao bì|nắp/iu.test(b.section)&&!/mùi|hương/iu.test(b.section.replace(/nước hoa|nước hương/giu,''))).map(b=>b.text).join(' ');
 const design=designs.filter(([,pattern])=>pattern.test(designText)).slice(0,4).map(([label])=>label);
 const releaseText=full.split(/(?<=[.!?])\s+/u).filter(s=>!/thành lập|thương hiệu\s+(?:được\s+)?(?:chính thức\s+)?(?:ra mắt|trình làng)|công ty|nhãn hiệu\s+(?:được\s+)?ra mắt/iu.test(s)).join(' ');
 const years=[...releaseText.matchAll(/(?:ra mắt|trình làng|phát hành)(?:[^.!?\d]{0,45})\b((?:19|20)\d{2})\b/giu)].map(m=>Number(m[1])).filter(y=>y<=2026);
 const names=[...full.matchAll(/(?:nhà (?:pha chế|điều hương|chế tác)|chuyên gia (?:mùi hương|nước hoa))\s+(?:nổi tiếng\s+|tài ba\s+)?([A-ZÀ-Ỹ][\p{L}'’-]+(?:\s+[A-ZÀ-Ỹ][\p{L}'’-]+){1,3})/gu)].map(m=>m[1]).filter(s=>!mentionsSourceStore(s));
 const articleNotes={};
 for(const block of parsed.blocks){
  const match=block.text.match(/^(?:[•*\-]\s*)?(?:tầng\s+)?hương\s+(đầu|giữa|cuối|nền)\s*[:：]\s*(.{2,500})$/iu);
  if(match){const phase={đầu:'top',giữa:'middle',cuối:'base',nền:'base'}[match[1].toLowerCase()];articleNotes[phase]=match[2].replace(/\.$/,'').split(/[,;]+/u).map(s=>s.trim()).filter(Boolean);}
 }
 const inspirationMatch=full.match(/lấy cảm hứng từ\s+([^.!?;]+)/iu),idea=inspirationMatch?.[1].split(',')[0].trim();
 const inspiration=idea&&idea.split(/\s+/u).length<=14&&!commercial(idea)&&!mentionsSourceStore(idea)?idea:null;
 return{design,launchYear:new Set(years).size===1?years[0]:null,perfumers:[...new Set(names)].slice(0,2),articleNotes,inspiration,scentBlocks:parsed.blocks.filter(b=>/mùi hương|hương thơm|tầng hương|cảm nhận/iu.test(b.section))};
}
