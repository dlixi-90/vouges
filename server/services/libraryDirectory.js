import directories from '../data/libraryDirectory.json' with {type:'json'};
import {isArticleUrl} from '../../client/src/utils/productArticle.js';

export const libraryImage=value=>typeof value==='string'&&isArticleUrl(value,true)?value:'';
export function libraryReference(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='apaniche.vn'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export const libraryDirectory=kind=>directories[kind]||{text:'',images:[],origins:[]};
export function publicDirectoryOverview(kind){
 const {text,images,origins,referenceUrl}=libraryDirectory(kind);
 return {text,referenceUrl,images,origins:origins.map(({termIds,...origin})=>({...origin,total:termIds.length}))};
}
export function libraryOriginIds(kind,origin){
 return libraryDirectory(kind).origins.find(row=>row.id===origin)?.termIds;
}
