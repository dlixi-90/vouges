import {isDeepStrictEqual} from 'node:util';
import {sanitizeArticle,articleToPlainText} from '../../client/src/utils/productArticle.js';
import {articleWords} from './build-product-article.mjs';
import {mentionsSourceStore} from './library-parser.mjs';
export function productArticleUpdate(current,entry,at){
 if(!current||current.isDeleted||String(current._id)!==entry.id||current.source?.id!==entry.sourceId||current.source?.url!==entry.evidence.originalUrl)throw Error('Product identity changed');
 if(current.description===entry.description&&isDeepStrictEqual(current.descriptionContent,entry.descriptionContent))return null;
 if(new Date(current.updatedAt).toISOString()!==entry.expectedUpdatedAt)throw Error(`Product changed during research: ${current.title}`);
 const content=sanitizeArticle(entry.descriptionContent),description=articleToPlainText(content).trim();
 if(description!==entry.description||description.length>5000||articleWords(content)<20||articleWords(content)>200||mentionsSourceStore(description))throw Error('Invalid new description');
 const images=content.content.filter(node=>node.type==='image');
 if(images.length!==entry.imageCount||images.some(node=>!/^\/images\/(?:product-articles|library)\/[a-f0-9]+\.webp$/u.test(node.attrs.src)))throw Error('Unexpected article illustrations');
 return {description,descriptionContent:content,updatedAt:at};
}
