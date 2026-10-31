import test from 'node:test';
import assert from 'node:assert/strict';
import { productQualityIssues } from '../../services/productQuality.js';
import { prepareProfileCompletion } from '../../services/productProfileCompletion.js';
import { productFilterValues } from '../../services/perfumeFilters.js';
import { getPerfumeProfile } from '../../services/ai/tools/productToolUtils.js';
import { sanitizeNewProductFragrance } from '../../services/fragranceEditing.js';
import { reviewSourceAssessments } from '../../services/reviewSourceAssessments.js';

const product = () => ({ _id:'123456789012345678901234', updatedAt:new Date('2026-10-31T00:00:00Z'), source:{id:1}, brand:'Example', concentration:'EDP', images:['https://example.com/image.png'], sizes:['50ml'], price:{'50ml':1000000}, stockBySize:{'50ml':5}, inStockBySize:{'50ml':true}, inStock:true, inventoryMode:'tracked', fragrance:{group:'Woody',notes:{top:[{name:'Bergamot'}]}}, qualityIssues:[] });
test('general notes and component notes remain distinct and participate in collection filters', () => {
  const p=product();p.fragrance.notes={general:[{name:'Guaiac'}]};
  p.fragrance.components=[{name:'Other scent',notes:{base:[{name:'Vanilla'}]}}];
  assert.deepEqual(productQualityIssues(p),[]);
  assert.deepEqual(productFilterValues(p).notes,['Guaiac','Vanilla']);
  const profile=getPerfumeProfile(p);
  assert.deepEqual(profile.fragrance.notes.top,[]);
  assert.equal(profile.fragrance.notes.general[0].name,'Guaiac');
  assert.equal(profile.fragrance.components[0].notes.base[0].name,'Vanilla');
});
test('an incomplete bundle cannot pass quality review using the notes of only one component', () => {
  const p=product();p.fragrance.notes={};p.fragrance.components=[{notes:{general:[{name:'Rose'}]}},{notes:{}}];
  assert.ok(productQualityIssues(p).includes('missing_scent_notes'));
  p.fragrance.components[1].notes={general:[{name:'Wood'}]};
  assert.deepEqual(productQualityIssues(p),[]);
});
test('blank notes and unsupported phase names do not count as a complete scent profile', () => {
  const p=product();p.fragrance.notes={top:[{name:' '}],other:[{name:'Rose'}]};
  assert.ok(productQualityIssues(p).includes('missing_scent_notes'));
});
test('only documented accessories qualify for fields that do not apply', () => {
  const p=product();p.concentration='';p.fragrance={profileKind:'accessory',notes:{}};
  assert.equal(productQualityIssues(p).length,3);
  p.fragrance.notApplicable=Object.fromEntries(['concentration','group','notes'].map(field=>[field,{reason:'Empty case; refill sold separately',sourceUrl:'https://example.com/case'}]));
  assert.deepEqual(productQualityIssues(p),[]);
  p.fragrance.profileKind='perfume';
  assert.equal(productQualityIssues(p).length,3);
});
test('missing variants, zero prices, source anomalies and unrelated review flags stay visible', () => {
  const p=product();p.price['50ml']=0;p.qualityIssues=['source_profile_conflict'];
  p.fragrance.sillage=[{label:'Near',displayedCount:null,sourceCountIssue:'invalid',sourceRawCount:-1}];
  assert.deepEqual(new Set(productQualityIssues(p)),new Set(['zero_source_price','source_assessment_anomaly','source_profile_conflict']));
  p.sizes=[];assert.ok(productQualityIssues(p).includes('missing_sizes'));
});
test('creation accepts general notes without inventing a pyramid or accepting forged profile exemptions', () => {
  const profile=sanitizeNewProductFragrance({notes:{general:[{name:' Rose ',url:null}]},profileKind:'accessory',notApplicable:{notes:{reason:'forged'}}});
  assert.deepEqual(profile.notes.general,[{name:'Rose',url:null}]);
  assert.deepEqual(profile.notes.base,[]);
  assert.equal(profile.notApplicable,undefined);
});
const record = p => ({id:String(p._id),sourceId:1,expectedUpdatedAt:p.updatedAt,changes:{'fragrance.notes':{general:[{name:'Guaiac'}]}},afterIssues:[]});
test('completion applies scent facts and provenance without changing stock, prices or article content', () => {
  const p=product(),before=structuredClone(p);
  const update=prepareProfileCompletion(p,record(p),'review-1',new Date());
  assert.deepEqual(p,before);
  assert.deepEqual(update['fragrance.notes'],{general:[{name:'Guaiac'}]});
  assert.equal(update.price,undefined);assert.equal(update.stockBySize,undefined);assert.equal(update.description,undefined);
  assert.equal(update['source.profileCompletion'].runId,'review-1');
});
test('completion rejects commerce mutations and stale or mismatched product identities', () => {
  const p=product();
  for(const changes of [{price:{'50ml':1}},{sizes:['100ml']},{stockBySize:{'50ml':100}},{isPublished:false},{source:{id:2}},{'fragrance.__proto__':{}}]){
    assert.throws(()=>prepareProfileCompletion(p,{...record(p),changes},'review-1',new Date()),/cannot change/);
  }
  assert.throws(()=>prepareProfileCompletion({...p,updatedAt:new Date()},record(p),'review-1',new Date()),/changed since review/);
  assert.throws(()=>prepareProfileCompletion({...p,source:{id:2}},record(p),'review-1',new Date()),/identity/);
});
test('completion cannot clear a genuine unresolved field by altering the manifest outcome', () => {
  const p=product();p.price['50ml']=0;
  assert.throws(()=>prepareProfileCompletion(p,record(p),'review-1',new Date()),/Quality outcome changed/);
  const result=prepareProfileCompletion(p,{...record(p),afterIssues:['zero_source_price']},'review-1',new Date());
  assert.match(result['source.profileCompletion'].unresolved[0].reason,/VND/);
});

test('source review removes only invalid measurements, keeps independent valid values and archives exact evidence', () => {
  const fragrance={longevity:[{label:'Long',displayedCount:null,sourceRawCount:-5,sourceCountIssue:'invalid',displayedPercent:75},{label:'Short',displayedCount:4,displayedPercent:20}],sillage:[{label:'Far',displayedCount:8,displayedPercent:null,sourceRawPercent:140,sourceValueIssue:'invalid'}]};
  const before=structuredClone(fragrance),changes=reviewSourceAssessments(fragrance,'2026-10-31');
  assert.deepEqual(fragrance,before);
  assert.equal(changes['fragrance.longevity'][0].displayedCount,null);
  assert.equal(changes['fragrance.longevity'][0].displayedPercent,75);
  assert.deepEqual(changes['fragrance.longevity'][1],fragrance.longevity[1]);
  assert.equal(changes['fragrance.sillage'][0].displayedCount,8);
  assert.equal(changes['fragrance.sillage'][0].displayedPercent,null);
  assert.equal(changes['fragrance.assessmentReview'].excluded[0].row.sourceRawCount,-5);
  assert.equal(changes['fragrance.assessmentReview'].excluded.length,2);
  const p=product();p.fragrance={...p.fragrance,longevity:changes['fragrance.longevity'],sillage:changes['fragrance.sillage'],assessmentReview:changes['fragrance.assessmentReview']};
  assert.deepEqual(productQualityIssues(p),[]);
  assert.deepEqual(reviewSourceAssessments(p.fragrance,'2026-10-31'),{});
});
