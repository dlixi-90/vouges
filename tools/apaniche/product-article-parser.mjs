import {parseTree,text} from './product-parser.mjs';
import {parseProductDescription,productDescriptionFacts} from './product-description-parser.mjs';
export const walk=node=>[node,...(node.children||[]).filter(child=>typeof child==='object').flatMap(walk)];
export const articleSection=value=>/thiết kế|bao bì|ngoại hình|kiểu dáng/iu.test(value)?'design':/mùi hương|hương thơm|tầng hương|cảm nhận|review/iu.test(value)?'scent':'intro';
export function parseProductArticle(html,base){
 const tree=parseTree(String(html||'').replace(/<\?php[\s\S]*?\?>/gi,''));
 const nodes=walk(tree),parsed=parseProductDescription(html),facts=productDescriptionFacts(parsed),images=[],rejected=[];
 let section='intro';
 for(const node of nodes){
  if(/^h[2-4]$/.test(node.tag))section=articleSection(text(node));
  if(node.tag!=='img')continue;
  const raw=node.attrs['data-lazy-src']||node.attrs['data-src']||node.attrs.src||'';
  try{
   const url=new URL(raw,base);
   if(url.hostname==='apaniche.vn'&&url.protocol==='http:')url.protocol='https:';
   const allowed=url.hostname==='apaniche.vn'&&url.pathname.includes('/uploads/')||url.hostname==='i.ytimg.com'&&url.pathname.startsWith('/vi/')||url.hostname==='lh3.googleusercontent.com';
   if(url.protocol!=='https:'||!allowed||url.username||url.password||/\.svg$/iu.test(url.pathname)||/logo-apa|apa-niche-logo|banner-quang-cao|banner-khuyen-mai/iu.test(url.pathname))throw Error('Unrelated or unsupported image');
   const sourceUrl=url.href;if(images.some(image=>image.sourceUrl===sourceUrl))continue;
   images.push({sourceUrl,section,width:Number(node.attrs.width)||null,height:Number(node.attrs.height)||null});
  }catch(error){rejected.push({raw,reason:error.message});}
 }
 return {...parsed,facts,images,rejected};
}
