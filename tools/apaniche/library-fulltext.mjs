import {parseTree,decode,text} from './product-parser.mjs';
import {sanitizeArticle,articleToPlainText,isArticleUrl,LIBRARY_ARTICLE_LIMITS} from '../../client/src/utils/productArticle.js';

const classes=node=>(node.attrs?.class||'').split(/\s+/u);
const has=(node,value)=>classes(node).includes(value);
const walk=node=>[node,...(node.children||[]).filter(child=>typeof child==='object').flatMap(walk)];
export const normalizedArticleText=value=>String(value).replace(/\s+/gu,' ').trim();
const witnessText=node=>typeof node==='string'?decode(node):node.tag==='img'?'\u0000':node.tag==='br'?'\n':(node.children||[]).map(witnessText).join('');
const sourceImage=(node,base)=>{
 const value=node.attrs?.['data-lazy-src']||node.attrs?.['data-src']||node.attrs?.src;
 if(typeof value!=='string'||!value.trim())return null;
 try{const url=new URL(value,base);return url.protocol==='https:'&&url.hostname==='apaniche.vn'?url.href:null;}catch{return null;}
};

export function parseFullLibraryArticle(html,kind,{url,resolveImage=value=>({src:value}),resolveLink=value=>value}={}){
 const clean=html.replace(/<\?php[\s\S]*?\?>/giu,'');
 const start=clean.search(/<main\b/iu),end=clean.indexOf('</main>',start);
 if(start<0)throw Error('Source page has no main article');
 const tree=parseTree(clean.slice(start,end<0?undefined:end+7));
 const main=walk(tree).find(node=>node.tag==='main');
 if(!main)throw Error('Source main could not be parsed');
 const evidence=[],images=[],excluded=[];let relatedHeading='';
 const link=value=>{try{const href=resolveLink(new URL(value,url).href);return isArticleUrl(href)?href:null;}catch{return null;}};
 const image=(node,thumbnail=false)=>{
  const original=sourceImage(node,url);if(!original)return null;
  const resolved=resolveImage(original,{thumbnail}),src=typeof resolved==='string'?resolved:resolved.src;
  if(!isArticleUrl(src,true))throw Error('Unsafe source image');
  images.push(original);
  const attrs={src,alt:decode(node.attrs.alt||''),title:'',articleWidth:100};
  const width=resolved.width||Number(node.attrs.width),height=resolved.height||Number(node.attrs.height);
  if(Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width<=20000&&height<=20000&&width*height<=40000000){attrs.width=width;attrs.height=height;}
  return {type:'image',attrs};
 };
 const inlineTags=new Set(['a','span','strong','b','em','i','u','s','del','strike','code','small','sup','sub','font','br','img']);
 const markTypes={strong:'bold',b:'bold',em:'italic',i:'italic',u:'underline',s:'strike',del:'strike',strike:'strike',code:'code'};
 const inlines=(node,marks=[])=>{
  if(typeof node==='string'){
   const value=decode(node).replace(/\s+/gu,' ');return value?[{type:'text',text:value,...(marks.length?{marks}: {})}]:[];
  }
  if(skip(node))return[];
  if(node.tag==='br')return[{type:'hardBreak'}];
  if(node.tag==='img'){const block=image(node);return block?[block]:[];}
  let next=marks;
  if(markTypes[node.tag])next=[...marks,{type:markTypes[node.tag]}];
  if(node.tag==='a'&&node.attrs.href){const href=link(node.attrs.href);if(href)next=[...marks,{type:'link',attrs:{href}}];}
  return (node.children||[]).flatMap(child=>inlines(child,next));
 };
 const paragraph=(content,type='paragraph',attrs)=>{
  while(content[0]?.type==='text'&&!content[0].text.trim())content.shift();
  while(content.at(-1)?.type==='text'&&!content.at(-1).text.trim())content.pop();
  if(content[0]?.type==='text')content[0]={...content[0],text:content[0].text.trimStart()};
  if(content.at(-1)?.type==='text')content[content.length-1]={...content.at(-1),text:content.at(-1).text.trimEnd()};
  return content.length?[{type,...(attrs?{attrs}:{}),content}]:[];
 };
 const blocksFromInline=(tokens,type='paragraph',attrs)=>{
  const result=[];let buffer=[];
  const flush=()=>{result.push(...paragraph(buffer,type,attrs));buffer=[];};
  for(const token of tokens){if(token.type==='image'){flush();result.push(token);}else buffer.push(token);}flush();return result;
 };
 const remember=node=>{for(const part of witnessText(node).split('\u0000')){const value=normalizedArticleText(part);if(value)evidence.push(value);}};
 const cardItem=node=>{
  const nodes=walk(node),anchor=nodes.find(child=>child.tag==='a'&&child.attrs.href&&/\/(?:note-huong|nhom-huong|mui-huong)-/u.test(child.attrs.href));
  if(!anchor)return null;
  const children=walk(anchor),heading=children.find(child=>/^h[2-6]$/u.test(child.tag)),english=children.find(child=>child.tag==='small'||child.tag==='p');
  const name=heading?text(heading):text(anchor);
  if(!name)return null;
  const href=link(anchor.attrs.href);if(!href)return null;
  const item={name,href};if(english&&text(english)!==name)item.englishName=text(english);
  const picture=children.find(child=>child.tag==='img');if(picture){const block=image(picture,true);if(block){item.image=block.attrs.src;if(block.attrs.width){item.width=block.attrs.width;item.height=block.attrs.height;}}}
  evidence.push(name,...(item.englishName?[item.englishName]:[]));return item;
 };
 const skip=node=>{
  if(['script','style','noscript','svg','button','input','select','form'].includes(node.tag))return true;
  if(node.tag==='nav'||has(node,'breadcrumbs')||has(node,'sub-title'))return true;
  if(has(node,'tt-bk')||/^(?:Sản\s*Phẩm\s*Sử\s*Dụng)/iu.test(text(node))&&['h2','h3','p'].includes(node.tag)){relatedHeading=text(node);return true;}
  if(['scent-product-list','load-more-scent','note-product-list','load-more-note'].includes(node.attrs.id)||has(node,'products')||has(node,'product-small')||has(node,'product-item')){excluded.push({reason:'live-product-list',id:node.attrs.id||'',class:node.attrs.class||''});return true;}
  if(node.tag==='h1')return true; // The page's existing heading names the same term.
  if(node.tag==='p'&&/^(?:Hiện )?(?:chưa có|không có) sản phẩm/iu.test(text(node)))return true;
  return false;
 };
 const childrenBlocks=children=>{
  const result=[];let buffer=[];
  const flush=()=>{if(buffer.length){const tokens=buffer.flatMap(child=>inlines(child));result.push(...blocksFromInline(tokens));remember({children:buffer});buffer=[];}};
  for(const child of children||[]){
   if(typeof child==='object'&&skip(child))continue;
   if(typeof child==='string'||inlineTags.has(child.tag)){buffer.push(child);continue;}
   flush();result.push(...convert(child));
  }
  flush();return result;
 };
 const convert=node=>{
  if(typeof node==='string')return blocksFromInline(inlines(node));
  if(skip(node))return[];
  const children=(node.children||[]).filter(child=>typeof child==='object');
  if(node.attrs.id==='list-spnhd'){
   const result=children.filter(child=>/^h[2-6]$/u.test(child.tag)).flatMap(convert),items=[];
   for(const row of children.filter(child=>has(child,'row'))){
    const nodes=walk(row),anchors=nodes.filter(child=>child.tag==='a'&&child.attrs.href&&text(child));
    const anchor=anchors.sort((a,b)=>text(b).length-text(a).length)[0];if(!anchor)continue;
    const href=link(anchor.attrs.href);if(!href)continue;
    const columns=row.children.filter(child=>typeof child==='object'&&has(child,'col'));
    const item={name:text(anchor),href,description:text(columns.at(-1))};
    const picture=nodes.find(child=>child.tag==='img');if(picture){const block=image(picture,true);if(block){item.image=block.attrs.src;if(block.attrs.width){item.width=block.attrs.width;item.height=block.attrs.height;}}}
    evidence.push(item.name,item.description);items.push(item);
   }
   if(items.length)result.push({type:'libraryCards',attrs:{columns:2,items}});
   return result;
  }
  if(children.length&&children.every(child=>has(child,'col'))){
   const imageStart=images.length,evidenceStart=evidence.length;
   const meaningful=children.filter(child=>text(child)||walk(child).some(node=>node.tag==='img'&&sourceImage(node,url)));
   const items=meaningful.map(cardItem);if(items.length&&items.every(Boolean))return[{type:'libraryCards',attrs:{columns:4,items}}];
   images.length=imageStart;evidence.length=evidenceStart;
  }
  if(node.tag==='img'){const block=image(node);return block?[block]:[];}
  if(node.tag==='figure'){
   const result=childrenBlocks(node.children),caption=walk(node).find(child=>child.tag==='figcaption');
   const picture=result.find(child=>child.type==='image');if(caption&&picture){picture.attrs.title=text(caption);return result.filter(child=>!(child.type==='paragraph'&&articleToPlainText(child)===text(caption)));}
   return result;
  }
  if(node.tag==='p'||/^h[2-6]$/u.test(node.tag)){
   remember(node);return blocksFromInline(inlines(node),node.tag==='p'?'paragraph':'heading',node.tag==='p'?undefined:{level:node.tag==='h2'?2:3});
  }
  if(node.tag==='ul'||node.tag==='ol'){
   const content=children.filter(child=>child.tag==='li').map(child=>{
    const content=childrenBlocks(child.children);if(content[0]?.type!=='paragraph')content.unshift({type:'paragraph',content:[]});return{type:'listItem',content};
   });
   return content.length?[{type:node.tag==='ul'?'bulletList':'orderedList',...(node.tag==='ol'?{attrs:{start:Number(node.attrs.start)||1}}:{}),content}]:[];
  }
  if(node.tag==='blockquote')return[{type:'blockquote',content:childrenBlocks(node.children)}];
  if(node.tag==='hr')return[{type:'horizontalRule'}];
  if(node.tag==='tr'){
   const cells=children.filter(child=>['td','th'].includes(child.tag));for(const cell of cells)remember(cell);
   return paragraph(cells.flatMap((cell,index)=>[...(index?[{type:'text',text:' · '}]:[]),...inlines(cell)]));
  }
  return childrenBlocks(node.children);
 };
 const content=convert(main),document=sanitizeArticle({type:'doc',content},LIBRARY_ARTICLE_LIMITS);
 const plain=normalizedArticleText(articleToPlainText(document));
 const missing=evidence.filter(value=>!plain.includes(normalizedArticleText(value)));
 if(missing.length)throw Error(`Source text omitted (${missing.length} blocks): ${missing[0].slice(0,100)}`);
 const title=text(walk(main).find(node=>node.tag==='h1'));
 return {title,descriptionContent:document,description:articleToPlainText(document).trim().slice(0,5000),relatedHeading,sourceTextBlocks:evidence.length,sourceCharacters:evidence.join('\n').length,images,excluded};
}
