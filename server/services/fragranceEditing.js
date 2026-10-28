const reject = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
const normalized = label => label.normalize("NFC").trim();

// Creation accepts only catalog fields; source metadata and visibility cannot be supplied.
export const sanitizeNewProductFragrance = (raw = {}) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) reject("Hồ sơ mùi hương không hợp lệ.");
  const result = { assessmentsVisible: true };
  for (const field of ["group", "style"]) {
    const value = raw[field] ?? "";
    if (typeof value !== "string" || value.length > 500) reject("Hồ sơ mùi hương không hợp lệ.");
    result[field] = value.trim();
  }
  const notes = raw.notes ?? {};
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) reject("Tầng hương không hợp lệ.");
  result.notes = Object.fromEntries(["top", "middle", "base"].map(phase => {
    const rows = notes[phase] ?? [];
    if (!Array.isArray(rows) || rows.length > 60) reject("Note hương không hợp lệ (tối đa 60 note mỗi tầng).");
    return [phase, rows.map(row => {
      if (!row || typeof row.name !== "string" || !row.name.trim() || row.name.length > 160) reject("Tên note hương không hợp lệ.");
      if (row.url != null && (typeof row.url !== "string" || row.url.length > 2000 || !/^https?:\/\//i.test(row.url))) reject("Liên kết note hương không hợp lệ.");
      return { name: normalized(row.name), url: row.url ?? null };
    })];
  }));
  for (const field of ["accords", "longevity", "sillage", "suitability"]) result[field] = sanitizeFragranceRows(field, raw[field] ?? []);
  return result;
};

// Source-only metadata is copied from the saved row, never trusted from a request.
export const sanitizeFragranceRows = (field, rows, previous = []) => {
  if (!["accords", "longevity", "sillage", "suitability"].includes(field) || !Array.isArray(rows) || rows.length > 30) reject("Danh sách chỉ số mùi hương không hợp lệ (tối đa 30 mục).");
  const labels = new Set();
  return rows.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.label !== "string" || !row.label.trim() || row.label.length > 160) reject("Tên kiểu mùi hoặc chỉ số không hợp lệ.");
    const label = normalized(row.label), key = label.toLocaleLowerCase("vi-VN");
    if (labels.has(key)) reject("Tên kiểu mùi hoặc chỉ số không được trùng nhau.");
    labels.add(key);
    const displayedPercent = row.displayedPercent ?? null;
    if (displayedPercent !== null && (typeof displayedPercent !== "number" || !Number.isFinite(displayedPercent) || displayedPercent < 0 || displayedPercent > 100)) reject("Tỷ lệ mùi hương phải từ 0 đến 100 hoặc để trống.");
    const old = previous.find(item => typeof item.label === "string" && normalized(item.label).toLocaleLowerCase("vi-VN") === key);
    const result = { ...(old || {}), label, displayedPercent };
    let changed = !old || old.label !== label || (old.displayedPercent ?? null) !== displayedPercent;
    if (["longevity", "sillage"].includes(field)) {
      const displayedCount = row.displayedCount ?? null;
      if (displayedCount !== null && (!Number.isSafeInteger(displayedCount) || displayedCount < 0)) reject("Số lượt đánh giá phải là số nguyên không âm hoặc để trống.");
      result.displayedCount = displayedCount;
      changed ||= (old?.displayedCount ?? null) !== displayedCount;
    }
    if (field === "accords" && row.url !== undefined) {
      if (row.url !== null && (typeof row.url !== "string" || row.url.length > 2000 || !/^https?:\/\//i.test(row.url))) reject("Liên kết kiểu mùi không hợp lệ.");
      result.url = row.url;
      changed ||= (old?.url ?? null) !== row.url;
    }
    if (changed) result.manuallyEdited = true;
    return result;
  });
};
