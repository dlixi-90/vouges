// Final storefront navigation is independent of dashboard category requests.
export const STORE_CATEGORIES = ["Nước hoa nam", "Nước hoa nữ", "Nước hoa unisex"];
export const STORE_SHOP_LINKS = [
  { path: "/collection", title: "Bộ sưu tập" },
  ...STORE_CATEGORIES.map(name => ({ path: `/collection?category=${encodeURIComponent(name)}`, title: name, category: name })),
];
