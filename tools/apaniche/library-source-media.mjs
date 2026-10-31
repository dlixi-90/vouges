import {parseTree,text} from './product-parser.mjs';
import {parseLibraryPage,mentionsSourceStore} from './library-parser.mjs';
export const walk=node=>[node,...(node.children||[]).filter(c=>typeof c==='object').flatMap(walk)];
const cls=(n,c)=>(n.attrs?.class||'').split(/\s+/).includes(c);
const mainTree=html=>{const start=html.search(/<main\b/i),end=html.indexOf('</main>',start);return parseTree(start>=0?html.slice(start,end>=0?end+7:undefined):html);};
export const imageInfo=(node,base)=>{
 const raw=node.attrs?.['data-lazy-src']||node.attrs?.['data-src']||node.attrs?.src||'';
 try{const url=new URL(raw,base);if(url.protocol!=='https:'||url.hostname!=='apaniche.vn'||!url.pathname.includes('/uploads/')||/\.svg$/i.test(url.pathname))return null;
  const alt=node.attrs.alt||'',caption=walk(node.parent||node).find(n=>n.tag==='figcaption'||cls(n,'wp-caption-text'));
  return{sourceUrl:url.href,alt:mentionsSourceStore(alt)?'':alt,caption:caption&&!mentionsSourceStore(text(caption))?text(caption):'',width:Number(node.attrs.width)||null,height:Number(node.attrs.height)||null};
 }catch{return null;}
};
const images=(root,url)=>walk(root).filter(n=>n.tag==='img').map(n=>imageInfo(n,url)).filter(Boolean);
const dedupe=items=>[...new Map(items.map(i=>[i.sourceUrl,i])).values()];
export function parseLibraryDirectory(html,kind,url){
 const root=mainTree(html),nodes=walk(root),cards=[];
 const brandItems=nodes.filter(n=>cls(n,'brand-item'));
 if(kind==='brand')for(const item of brandItems){const a=walk(item).find(n=>n.tag==='a'&&n.attrs.href);if(a)cards.push({kind,name:text(a),url:new URL(a.attrs.href,url).href,media:images(item,url)});}
 else for(const a of nodes.filter(n=>n.tag==='a'&&new RegExp(`/(?:${{group:'nhom-huong',accord:'mui-huong',note:'note-huong'}[kind]})-`).test(n.attrs.href||''))){
  cards.push({kind,name:text(a),url:new URL(a.attrs.href,url).href,media:images(a,url)});
 }
 const intro=nodes.find(n=>cls(n,'page-description'));
 const origins=kind==='note'?nodes.filter(n=>cls(n,'origin-desc')).map(n=>{
  const container=n.parent,heading=walk(container).find(c=>c.tag==='h2'),media=images(container,url).slice(0,1);
  const noteUrls=walk(container).filter(c=>c.tag==='a'&&/\/note-huong-/.test(c.attrs.href||'')).map(c=>new URL(c.attrs.href,url).href);
  return{name:text(heading),text:text(n),media,noteUrls:[...new Set(noteUrls)]};
 }):[];
 return{kind,url,cards:[...new Map(cards.filter(c=>c.name).map(c=>[c.url,c])).values()],introText:intro?text(intro):'',introMedia:intro?images(intro,url):[],origins};
}
export function parseLibraryArticle(html,kind,url){
 const root=mainTree(html),nodes=walk(root),content=parseLibraryPage(html,kind);
 const roots=nodes.filter(n=>({brand:['term-description'],group:['nhom-huong-left','nhom-huong-right','nhom_huong_role','nhom_huong_reason','nhom_huong_object','thu-vien-extra'],accord:['mui-huong-left','mui-huong-right','thu-vien-extra'],note:['des-noteh','note-huong-banner','note-huong-left','note-image','img-noteh']}[kind]||[]).some(c=>cls(n,c)));
 const media=dedupe(roots.flatMap(n=>images(n,url))).filter(m=>!/logo-apa|apa-niche-logo|banner-quang-cao|zalo|hotline/i.test(m.sourceUrl));
 return{...content,media};
}
