const present = value => typeof value === 'string' && value.trim().length > 0;
export const hasScentNotes = notes => notes && typeof notes === 'object'
  && ['top', 'middle', 'base', 'general'].some(phase => Array.isArray(notes[phase]) && notes[phase].some(note => present(note?.name)));

// Recompute actual missing fields; retain unrelated review flags.
export function productQualityIssues(product) {
  const managed = ['missing_brand', 'missing_concentration', 'missing_scent_group', 'missing_images', 'missing_scent_notes', 'missing_sizes', 'zero_source_price', 'source_assessment_anomaly'];
  const issues = new Set((product.qualityIssues || []).filter(issue => !managed.includes(issue)));
  const fragrance = product.fragrance || {};
  const exempt = field => fragrance.profileKind === 'accessory'
    && fragrance.notApplicable?.[field]?.reason && /^https:\/\//.test(fragrance.notApplicable[field].sourceUrl || '');
  if (!present(product.brand)) issues.add('missing_brand');
  if (!present(product.concentration) && !exempt('concentration')) issues.add('missing_concentration');
  if (!present(fragrance.group) && !exempt('group')) issues.add('missing_scent_group');
  if (!Array.isArray(product.images) || !product.images.some(present)) issues.add('missing_images');
  const components = fragrance.components;
  const componentNotes = Array.isArray(components) && components.length > 0 && components.every(component => hasScentNotes(component.notes));
  const assortmentComplete = fragrance.profileKind !== 'assortment' || componentNotes
    && (product.sizes || []).every(size => components.some(component => component.variantKey === size))
    && components.every(component => (product.sizes || []).includes(component.variantKey));
  if ((!hasScentNotes(fragrance.notes) && !componentNotes && !exempt('notes')) || !assortmentComplete) issues.add('missing_scent_notes');
  if (!Array.isArray(product.sizes) || !product.sizes.length) issues.add('missing_sizes');
  if ((product.sizes || []).some(size => !Number.isSafeInteger(product.price?.[size]) || product.price[size] <= 0)) issues.add('zero_source_price');
  for (const row of [...(fragrance.longevity || []), ...(fragrance.sillage || []), ...(fragrance.suitability || [])]) {
    if (row.sourceValueIssue || row.sourceCountIssue
      || row.displayedCount != null && (!Number.isSafeInteger(row.displayedCount) || row.displayedCount < 0)
      || row.displayedPercent != null && (!Number.isFinite(row.displayedPercent) || row.displayedPercent < 0 || row.displayedPercent > 100)) issues.add('source_assessment_anomaly');
  }
  return [...issues];
}
