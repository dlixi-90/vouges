const collator = new Intl.Collator("vi-VN", { numeric: true, sensitivity: "base" });

export const filterOptionSearchKey = value => String(value).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi-VN").trim().replace(/\s+/g, " ");

const millilitres = value => {
  const match = String(value).trim().match(/^(\d+(?:[.,]\d+)?)\s*(ml|l)\b/i);
  return match ? Number(match[1].replace(",", ".")) * (match[2].toLowerCase() === "l" ? 1000 : 1) : Infinity;
};

// Sort display labels without changing the exact variant keys sent to checkout.
export const sortFilterOptions = (field, values) => [...new Set(values)].sort((a, b) =>
  (field === "sizes" ? millilitres(a) - millilitres(b) : 0) || collator.compare(a, b));
