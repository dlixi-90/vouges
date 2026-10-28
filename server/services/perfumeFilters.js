import { PERFUME_FILTERS } from "../../client/src/data/perfumeFilters.js";
import { isSizeAvailable } from "../utils/productStock.js";

export const filterKey = value => typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi-VN") : "";
const labels = values => [...new Set(values.filter(value => typeof value === "string" && value.trim()).map(value => value.normalize("NFC").trim()))];
const dominant = rows => {
  const valid = (rows || []).filter(row => Number.isSafeInteger(row.displayedCount) && row.displayedCount > 0);
  const maximum = Math.max(0, ...valid.map(row => row.displayedCount));
  return valid.filter(row => row.displayedCount === maximum).map(row => row.label);
};
export const productFilterValues = product => {
  const fragrance = product.fragrance || {};
  const gender = ["Nam", "Nữ", "Unisex"].find(value => filterKey(value) === filterKey(product.gender))
    || ({ "Nước hoa nam": "Nam", "Nước hoa nữ": "Nữ", "Nước hoa unisex": "Unisex" })[product.category];
  return Object.fromEntries(Object.entries({
    gender: [gender],
    brands: [product.brand], sizes: (product.sizes || []).filter(size => isSizeAvailable(product, size)),
    longevity: dominant(fragrance.longevity), sillage: dominant(fragrance.sillage),
    suitability: (fragrance.suitability || []).filter(row => Number.isFinite(row.displayedPercent) && row.displayedPercent >= 50 && row.displayedPercent <= 100).map(row => row.label),
    notes: ["top", "middle", "base"].flatMap(tier => (fragrance.notes?.[tier] || []).map(note => typeof note === "string" ? note : note.name)),
    accords: (fragrance.accords || []).map(row => row.label),
    styles: (fragrance.style || "").split(/[,;\n]+/).map(value => value.trim().replace(/\.$/, "")),
    concentrations: [product.concentration || product.type], origins: [product.origin],
  }).map(([field, values]) => [field, labels(values)]));
};
export const parsePerfumeFilters = raw => {
  if (raw === undefined) return {};
  if (typeof raw !== "string" || raw.length > 16000) throw Object.assign(new Error("Bộ lọc không hợp lệ"), { statusCode: 400 });
  let data;
  try { data = JSON.parse(raw); } catch { throw Object.assign(new Error("Bộ lọc không hợp lệ"), { statusCode: 400 }); }
  const allowed = new Set(PERFUME_FILTERS.map(field => field.id));
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.entries(data).some(([field, values]) => !allowed.has(field)
    || !Array.isArray(values) || values.length > 30 || values.some(value => typeof value !== "string" || value.length > 200 || !value.trim()))) {
    throw Object.assign(new Error("Bộ lọc không hợp lệ"), { statusCode: 400 });
  }
  return data;
};
export const matchesPerfumeFilters = (values, filters) => Object.entries(filters).every(([field, selected]) => !selected.length
  || selected.some(value => (values[field] || []).some(option => filterKey(option) === filterKey(value))));
export const collectPerfumeFilters = catalog => {
  const options = Object.fromEntries(PERFUME_FILTERS.map(({ id }) => [id, new Map()]));
  for (const product of catalog) {
    const values = product._filters || productFilterValues(product);
    for (const [field, rows] of Object.entries(values)) for (const value of rows) options[field].set(filterKey(value), value);
  }
  return Object.fromEntries(Object.entries(options).map(([field, values]) => [field,
    [...values.values()].sort((a, b) => a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" }))]));
};
