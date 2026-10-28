export const PERFUME_FILTERS = [
  { id: "gender", label: "Giới tính" },
  { id: "brands", label: "Thương hiệu", searchable: true },
  { id: "sizes", label: "Dung tích", searchable: true },
  { id: "longevity", label: "Lưu hương", hint: "Theo mức có nhiều lượt đánh giá nhất. Nếu bằng nhau, sản phẩm có thể thuộc nhiều mức." },
  { id: "sillage", label: "Tỏa hương", hint: "Theo mức có nhiều lượt đánh giá nhất. Nếu bằng nhau, sản phẩm có thể thuộc nhiều mức." },
  { id: "suitability", label: "Thời điểm khuyên dùng", hint: "Các mùa và thời điểm có mức phù hợp từ 50% trở lên trong hồ sơ sản phẩm." },
  { id: "notes", label: "Note hương", searchable: true, hint: "Tìm trong cả hương đầu, hương giữa và hương cuối." },
  { id: "accords", label: "Kiểu mùi hương", searchable: true },
  { id: "styles", label: "Phong cách", searchable: true },
  { id: "concentrations", label: "Nồng độ" },
  { id: "origins", label: "Xuất xứ", searchable: true },
];
export const emptyPerfumeFilters = () => Object.fromEntries(PERFUME_FILTERS.map(({ id }) => [id, []]));
