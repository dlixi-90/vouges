export const assessmentGroups = [
  { key: "longevity", title: "Lưu hương", labels: ["Yếu 1-3H", "Trung Bình 4-5H", "Khá 6-8H", "Lâu 9-12H", "Rất Lâu Trên 12H"], counts: true },
  { key: "sillage", title: "Tỏa hương", labels: ["Gần", "Vừa Phải", "Xa", "Rất Xa"], counts: true },
  { key: "suitability", title: "Mùa và thời điểm", labels: ["Xuân", "Hạ", "Thu", "Đông", "Đêm", "Ngày"], counts: false },
];

// Missing data remains unknown, not an invented zero rating.
export const getAssessmentRows = (fragrance, key) => {
  const group = assessmentGroups.find(item => item.key === key);
  const rows = fragrance?.[key] || [];
  if (!group) return rows;
  const normalize = value => value.normalize("NFC").trim().toLocaleLowerCase("vi-VN");
  const known = new Set(group.labels.map(normalize));
  return [
    ...group.labels.map(label => rows.find(row => normalize(row.label) === normalize(label)) || { label, displayedPercent: null, ...(group.counts ? { displayedCount: null } : {}) }),
    ...rows.filter(row => !known.has(normalize(row.label))),
  ];
};

export const editableFragrance = (fragrance = {}) => ({
  ...fragrance,
  accords: fragrance.accords || [],
  ...Object.fromEntries(assessmentGroups.map(group => [group.key, getAssessmentRows(fragrance, group.key)])),
});
