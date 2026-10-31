import { productQualityIssues } from './productQuality.js';

const fields = new Set(['brand', 'origin', 'gender', 'concentration', 'type', 'images',
  'fragrance.group', 'fragrance.style', 'fragrance.notes', 'fragrance.components',
  'fragrance.profileKind', 'fragrance.notApplicable', 'fragrance.longevity', 'fragrance.sillage', 'fragrance.suitability', 'fragrance.assessmentReview']);

export const reviewReasons = {
  missing_brand: 'Nguồn chưa xác nhận được thương hiệu.',
  missing_concentration: 'Chưa xác minh được nồng độ chính xác của phiên bản này.',
  missing_scent_group: 'Nguồn chưa công bố nhóm hương hoặc chưa xác định đầy đủ thành phần set.',
  missing_scent_notes: 'Nguồn chưa đủ thông tin để xác nhận các nốt hương cho đúng phiên bản.',
  missing_sizes: 'Nguồn chỉ còn dung tích Test đã xóa; cần dung tích bán thay thế được xác nhận.',
  missing_images: 'Chưa xác minh được ảnh đúng sản phẩm.',
  zero_source_price: 'Còn dung tích chưa có giá bán hợp lệ trong nguồn; cần giá VND được xác nhận.',
  source_assessment_anomaly: 'Nguồn vẫn có số lượt hoặc tỷ lệ đánh giá không hợp lệ. Giữ dữ liệu gốc để đối chiếu, không tự tạo số thay thế.',
  source_profile_conflict: 'Nguồn giới thiệu Santal 33 nhưng phần mô tả lại ghi Another 13; cần xác nhận chai có trong set.',
};

// The completion manifest can never alter sellable variants or warehouse data.
export function prepareProfileCompletion(product, record, runId, reviewedAt) {
  if (String(product._id) !== record.id || product.source?.id !== record.sourceId || product.isDeleted === true) throw new Error(`Product identity changed: ${record.id}`);
  if (new Date(product.updatedAt).getTime() !== new Date(record.expectedUpdatedAt).getTime()) throw new Error(`Product changed since review: ${record.sourceId}`);
  const next = structuredClone(product), set = {};
  for (const [field, value] of Object.entries(record.changes || {})) {
    if (!fields.has(field)) throw new Error(`Completion cannot change ${field}`);
    let target = next;
    const segments = field.split('.');
    for (const segment of segments.slice(0, -1)) target = target[segment] ??= {};
    target[segments.at(-1)] = structuredClone(value);
    set[field] = value;
  }
  next.qualityIssues = [...new Set([...(next.qualityIssues || []), ...(record.additionalIssues || [])])];
  const issues = productQualityIssues(next);
  if (JSON.stringify([...issues].sort()) !== JSON.stringify([...(record.afterIssues || [])].sort())) throw new Error(`Quality outcome changed: ${record.sourceId}`);
  set.qualityIssues = issues;
  const previous = product.source?.profileCompletion || {};
  set['source.profileCompletion'] = {
    runId, reviewedAt, previousRunIds: [...new Set([...(previous.previousRunIds || []), previous.runId].filter(Boolean))],
    fieldsUpdated: [...new Set([...(previous.fieldsUpdated || []), ...Object.keys(record.changes || {})])],
    fieldSources: {...(previous.fieldSources || {}), ...(record.evidence || {})},
    unresolved: issues.map(code => ({ code, reason: reviewReasons[code] || code })),
  };
  return set;
}
