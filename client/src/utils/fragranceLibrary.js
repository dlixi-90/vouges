export const LIBRARY_KINDS = {
  brand: { title: "Thương hiệu", intro: "Câu chuyện phía sau những nhà hương trong bộ sưu tập Velours." },
  group: { title: "Nhóm hương", intro: "Khám phá các họ hương và cách chúng tạo nên bản sắc của nước hoa." },
  accord: { title: "Kiểu mùi", intro: "Tìm hiểu các sắc thái tạo nên cảm nhận tổng thể của một mùi hương." },
  note: { title: "Note hương", intro: "Làm quen với nguyên liệu, các hợp hương và những liên tưởng trong điều hương." },
};

export const librarySlug = term => {
  try {
    const value = new URL(term.key).pathname.split("/").filter(Boolean).pop();
    if (/^[a-z0-9-]+$/i.test(value)) return value.replace(/^(?:nuoc-hoa-|nhom-huong-|mui-huong-|note-huong-)/, "");
  } catch { /* Owner-created terms may have a plain key. */ }
  return String(term.name || term.key || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
};
export const libraryPath = term => `/knowledge/${term.kind}/${encodeURIComponent(term.slug || librarySlug(term))}`;
export const libraryNamePath = (kind, name) => `/knowledge/${kind}?name=${encodeURIComponent(name)}`;
