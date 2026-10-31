import {isDeepStrictEqual} from 'node:util';
import {sanitizeArticle,articleToPlainText} from '../../client/src/utils/productArticle.js';
import {mentionsSourceStore} from './library-parser.mjs';
export function productDescriptionUpdate(current,entry,at){
 if(!current||current.isDeleted||String(current._id)!==entry.id||current.source?.id!==entry.sourceId||current.source?.url!==entry.evidence.originalUrl)throw Error('Product identity changed');
 if(current.description===entry.description&&isDeepStrictEqual(current.descriptionContent,entry.descriptionContent))return null;
 if(new Date(current.updatedAt).toISOString()!==entry.expectedUpdatedAt)throw Error(`Product changed during research: ${current.title}`);
 const content=sanitizeArticle(entry.descriptionContent),text=articleToPlainText(content).trim();
 if(text!==entry.description||text.length<180||text.length>5000||mentionsSourceStore(text)||text.split(/\s+/u).length>200)throw Error('Invalid new description');
 // Owner-authored descriptions are replaced, as explicitly requested.
 return{description:text,descriptionContent:content,updatedAt:at};
}
