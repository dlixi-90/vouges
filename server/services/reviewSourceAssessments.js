// Invalid observations become unknown. Valid counts/percentages are independent
// and remain untouched; the complete original row is archived for comparison.
export function reviewSourceAssessments(fragrance, reviewedAt) {
  const changes = {}, excluded = [];
  for (const field of ['longevity', 'sillage', 'suitability']) {
    let changed = false;
    const rows = (fragrance[field] || []).map(row => {
      const invalidCount = Boolean(row.sourceCountIssue) || row.displayedCount != null && (!Number.isSafeInteger(row.displayedCount) || row.displayedCount < 0);
      const invalidPercent = Boolean(row.sourceValueIssue) || row.displayedPercent != null && (!Number.isFinite(row.displayedPercent) || row.displayedPercent < 0 || row.displayedPercent > 100);
      if (!invalidCount && !invalidPercent) return row;
      changed = true;
      excluded.push({ field, row: structuredClone(row), invalidCount, invalidPercent });
      const cleaned = { ...row };
      if (invalidCount) {
        cleaned.displayedCount = null;
        delete cleaned.sourceRawCount; delete cleaned.sourceCountIssue;
      }
      if (invalidPercent) {
        cleaned.displayedPercent = null;
        delete cleaned.sourceRawPercent; delete cleaned.sourceValueIssue;
      }
      return cleaned;
    });
    if (changed) changes[`fragrance.${field}`] = rows;
  }
  if (excluded.length) changes['fragrance.assessmentReview'] = {
    reviewedAt, decision: 'exclude_invalid_measurements',
    explanation: 'Chỉ số không hợp lệ được loại khỏi dữ liệu hiển thị và để là chưa biết. Bản ghi gốc được lưu để đối chiếu, không tạo số thay thế.',
    excluded,
  };
  return changes;
}
