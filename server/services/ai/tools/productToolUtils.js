import { getSizeQuantity, getPurchaseLimit, isSourceInventory, isSizeAvailable } from "../../../utils/productStock.js";
import { scentPhases } from "../../../../client/src/utils/scentNotes.js";

export const getProductOptions = (product) => {
  const currency = "VND";

  return (product.sizes || [])
    .map((size) => ({
      size,
      amount: Number(product.price?.[size]),
      currency,
      isAvailable: isSizeAvailable(product, size),
      stockQuantity: isSourceInventory(product) ? null : getSizeQuantity(product, size),
      purchaseLimit: isSizeAvailable(product, size) ? getPurchaseLimit(product, size) : 0,
    }))
    .filter((option) => Number.isFinite(option.amount));
};

export const getPerfumeProfile = (product) => {
  const fragrance = product.fragrance || {};
  const percent = value => Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  const assessment = rows => (Array.isArray(rows) ? rows : []).slice(0, 30).map(row => ({
    label: String(row.label || "").slice(0, 160),
    displayedCount: Number.isSafeInteger(row.displayedCount) && row.displayedCount >= 0 ? row.displayedCount : null,
    displayedPercent: percent(row.displayedPercent),
  }));
  const notes = profile => Object.fromEntries(scentPhases.map(([phase]) => [phase, (profile?.notes?.[phase] || []).slice(0, 60).map(note => ({ name: String(note.name || '').slice(0, 160) }))]));
  return {
    brand: product.brand || null, origin: product.origin || null,
    concentration: product.concentration || null, gender: product.gender || null,
    fragrance: {
      group: fragrance.group || null, style: fragrance.style || null,
      notes: notes(fragrance),
      ...(fragrance.profileKind ? { profileKind: fragrance.profileKind } : {}),
      ...(fragrance.components?.length ? { components: fragrance.components.slice(0, 30).map(component => ({ name: component.name, concentration: component.concentration || null, group: component.group || null, notes: notes(component),
        ...(component.variantKey ? { variantKey: component.variantKey, optionName: component.optionName, contents: component.contents || null } : {}),
      })) } : {}),
      accords: (fragrance.accords || []).slice(0, 30).map(row => row.label),
      accordPercentages: assessment(fragrance.accords),
      longevity: assessment(fragrance.longevity), sillage: assessment(fragrance.sillage), suitability: assessment(fragrance.suitability),
    },
  };
};

export const getAvailableProductOptions = (product) => {
  return getProductOptions(product)
    .filter((option) => option.isAvailable)
    .map(({ isAvailable, ...option }) => option);
};

export const getProductPriceRange = (availableOptions) => {
  if (availableOptions.length === 0) return null;

  const prices = availableOptions.map((option) => option.amount);

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    currency: availableOptions[0].currency,
  };
};
