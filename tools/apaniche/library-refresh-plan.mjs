import {sanitizeArticle} from '../../client/src/utils/productArticle.js';
import {mentionsSourceStore} from './library-parser.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validateRefreshEntry(current,entry){
 if(!entry.id||!entry.name||mentionsSourceStore(entry.description)||entry.description.length>5000)throw Error('Invalid content');
 if(entry.descriptionContent&&!same(sanitizeArticle(entry.descriptionContent),entry.descriptionContent))throw Error('Unsafe article');
 if(entry.image&&!/^\/images\/library\/[a-f0-9]+-thumb\.webp$/.test(entry.image))throw Error('Unexpected asset');
 if(entry.isNew){if(current)throw Error('New term already exists');return;}
 if(!current||current.kind!==entry.kind||current.key!==entry.key||current.name!==entry.name||current.sourceUrl!==entry.sourceUrl||new Date(current.updatedAt).toISOString()!==entry.expectedUpdatedAt)throw Error(`Concurrent or identity change: ${entry.name}`);
}
