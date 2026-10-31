import {parseTree,text} from './product-parser.mjs';

export const mentionsSourceStore = value => /apa[\W_]*niche/i.test(String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,''));
const walk=node=>[node,...(node.children||[]).filter(child=>typeof child==='object').flatMap(walk)];
const hasClass=(node,name)=>(node.attrs?.class||'').split(/\s+/).includes(name);
const normalized=value=>value.replace(/\s+/g,' ').trim();
const noise=value=>/mua.{0,50}(?:ở đâu|chính hãng)|liên hệ|hotline|địa chỉ cửa hàng|giao hàng|miễn phí vận chuyển|giá (?:bán|rẻ|tốt)|cam kết chính hãng|bảo hành|đặt hàng/i.test(value);

// Only first-party editorial containers, never navigation, product grids or footer text.
export function parseLibraryPage(html,kind){
 const tree=parseTree(html.replace(/<\?php[\s\S]*?\?>/gi,''));
 const all=walk(tree),main=all.find(n=>n.tag==='main'||n.attrs?.id==='main');
 if(!main)return{title:'',englishName:'',group:'',blocks:[],excluded:[],reason:'missing-main'};
 const nodes=walk(main),title=text(nodes.find(n=>n.tag==='h1'));
 const rootClasses=kind==='brand'?['term-description']:kind==='note'?['des-noteh']:kind==='group'
  ?['nhom-huong-right','nhom_huong_role','nhom_huong_reason','nhom_huong_object','thu-vien-extra']
  :['mui-huong-right','thu-vien-extra'];
 const roots=nodes.filter(n=>rootClasses.some(name=>hasClass(n,name)));
 const blocks=[],excluded=[],seen=new Set();
 for(const root of roots){
  let candidates=walk(root).filter(n=>/^(p|li|h[2-4])$/.test(n.tag)&&!walk(n).slice(1).some(c=>c.tag==='p'));
  if(!candidates.length)candidates=[root];
  let skipSection=false;
  for(const node of candidates){
   const value=normalized(text(node));if(!value||/^(?:đang cập nhật|nội dung đang cập nhật|chưa có nội dung)[.!…\s]*$/iu.test(value))continue;
   const heading=/^h[2-4]$/.test(node.tag);
   if(heading)skipSection=noise(value)||mentionsSourceStore(value);
   if(skipSection||mentionsSourceStore(value)||noise(value)){excluded.push({reason:mentionsSourceStore(value)?'source-store-mention':'commercial-section',characters:value.length});continue;}
   const key=value.toLocaleLowerCase('vi-VN');if(seen.has(key))continue;seen.add(key);
   blocks.push({type:heading?'heading':'paragraph',text:value});
  }
 }
 const englishName=text(nodes.find(n=>hasClass(n,'note-huong-english'))||nodes.find(n=>n.tag==='h4'));
 const group=text(nodes.find(n=>hasClass(n,'group-noteh'))).replace(/^Nhóm:\s*/i,'');
 const relatedNotes=nodes.find(n=>n.attrs?.id==='list-nhdt');
 const noteNames=relatedNotes?walk(relatedNotes).filter(n=>n.tag==='a'&&/\/note-huong-/.test(n.attrs?.href||'')).map(text).filter(Boolean):[];
 return{title,englishName,group,noteNames:[...new Set(noteNames)],blocks,excluded,reason:blocks.length?'content-found':roots.length?'no-eligible-description':'no-description-container'};
}
