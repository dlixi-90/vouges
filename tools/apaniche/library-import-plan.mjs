import {sanitizeArticle,articleToPlainText} from '../../client/src/utils/productArticle.js';
import {mentionsSourceStore} from './library-parser.mjs';

export function planLibraryImport(current,entry,runId,at){
 if(!current||String(current._id)!==entry.id||current.kind!==entry.kind||current.key!==entry.key||current.sourceUrl!==entry.evidence.url)throw Error('Library identity changed');
 if(current.contentImport?.runId===runId&&current.description===entry.description)return null;
 if(new Date(current.updatedAt).toISOString()!==entry.expectedUpdatedAt||current.description?.trim()||current.descriptionContent)throw Error(`Preserving edited content: ${entry.name}`);
 const document=sanitizeArticle(entry.descriptionContent),description=articleToPlainText(document).trim();
 if(description!==entry.description||description.length<50||description.length>5000||mentionsSourceStore(description)||mentionsSourceStore(entry.name))throw Error('Invalid imported content');
 return{description,descriptionContent:document,contentStatus:'complete',...(!current.name?.trim()?{name:entry.name}:{}),
  contentImport:{runId,importedAt:at,...entry.evidence},updatedAt:at};
}
