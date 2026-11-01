import directories from '../data/libraryDirectory.json' with {type:'json'};
import presentation from '../data/libraryPresentation.json' with {type:'json'};
import {isArticleUrl} from '../../client/src/utils/productArticle.js';
import {librarySlug} from '../../client/src/utils/fragranceLibrary.js';

const originsByTerm=new Map();
for(const origin of directories.note.origins)for(const id of origin.termIds){
 const memberships=originsByTerm.get(id)||[];memberships.push(origin.id);originsByTerm.set(id,memberships);
}
export const libraryTermOrigins=(kind,id)=>kind==='note'?(originsByTerm.get(id)||[]):[];
export const libraryEnglishName=term=>presentation.labels[term.kind]?.[librarySlug(term)]||term.name?.match(/\(([^()]+)\)\s*$/u)?.[1]||'';

export const libraryImage=value=>typeof value==='string'&&isArticleUrl(value,true)?value:'';
export function libraryReference(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='apaniche.vn'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export const libraryDirectory=kind=>directories[kind]||{text:'',images:[],origins:[]};
export function publicDirectoryOverview(kind){
 const {text,images,origins,referenceUrl}=libraryDirectory(kind);
 return {text,referenceUrl,images,origins:origins.map(({termIds,...origin})=>({...origin,banner:libraryImage(presentation.originBanners[origin.id]||origin.image),total:termIds.length}))};
}
export function libraryOriginIds(kind,origin){
 return libraryDirectory(kind).origins.find(row=>row.id===origin)?.termIds;
}
