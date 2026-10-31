export const normalizeLibraryName=value=>typeof value==='string'?value.normalize('NFC').trim().replace(/\s+/gu,' '):'';
export const libraryNameKey=value=>normalizeLibraryName(value).toLocaleLowerCase('vi-VN');
export const libraryNamePattern=value=>new RegExp(`^\\s*${normalizeLibraryName(value).split(/\s+/u).map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+')}\\s*$`,'iu');
export const notePhases=['top','middle','base','general'];
export function libraryProductRelation(term){
 const value=libraryNamePattern(term.name);
 if(term.kind==='brand')return {brand:value};
 if(term.kind==='group')return {$or:[{'fragrance.group':value},{'fragrance.components.group':value}]};
 if(term.kind==='accord')return {$or:[{'fragrance.accords.label':value},{'fragrance.components.accords.label':value}]};
 return {$or:notePhases.flatMap(phase=>[`fragrance.notes.${phase}`,`fragrance.components.notes.${phase}`]).flatMap(field=>term.sourceUrl?[
  {[`${field}.url`]:term.sourceUrl},...(term.matchNameWithoutUrl===false?[]:[{[field]:{$elemMatch:{name:value,$or:[{url:null},{url:''}]}}}]),
 ]:[{[`${field}.name`]:value}])};
}
export const activeLibraryProducts=term=>({isDeleted:{$ne:true},...libraryProductRelation(term)});

export function renamedLibraryFields(product,term,name){
 const matches=value=>typeof value==='string'&&libraryNamePattern(term.name).test(value);
 if(term.kind==='brand')return matches(product.brand)?{brand:name}:null;
 const fragrance=product.fragrance||{};
 const renameProfile=profile=>{
  let updated=profile;
  if(term.kind==='group'&&matches(profile.group))updated={...updated,group:name};
  if(term.kind==='accord'&&Array.isArray(profile.accords)&&profile.accords.some(row=>matches(row.label)))updated={...updated,accords:profile.accords.map(row=>matches(row.label)?{...row,label:name}:row)};
  if(term.kind==='note')for(const phase of notePhases){
   const matchesNote=row=>term.sourceUrl?row.url===term.sourceUrl||term.matchNameWithoutUrl!==false&&!row.url&&matches(row.name):matches(row.name);
   if(Array.isArray(profile.notes?.[phase])&&profile.notes[phase].some(matchesNote))updated={...updated,notes:{...updated.notes,[phase]:profile.notes[phase].map(row=>matchesNote(row)?{...row,name}:row)}};
  }
  return updated;
 };
 let updated=renameProfile(fragrance);
 if(Array.isArray(fragrance.components)){
  const components=fragrance.components.map(renameProfile);
  if(components.some((component,index)=>component!==fragrance.components[index]))updated={...updated,components};
 }
 return updated!==fragrance?{fragrance:updated}:null;
}
