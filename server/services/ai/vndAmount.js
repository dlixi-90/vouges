const GROUPED_AMOUNT = String.raw`(?:\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)`;
const AMOUNT = new RegExp(`^(?:\\d+|${GROUPED_AMOUNT})$`, "u");
const GROUPED_IN_TEXT = new RegExp(`(?<![\\p{L}\\p{N}_./@])(${GROUPED_AMOUNT})([ \\u00a0\\u202f]*(?:₫|đồng|vnđ|vnd|đ))?(?![\\p{L}\\p{N}_/@]|[.,]\\d|[ \\u00a0\\u202f]\\d{3}(?!\\d))`, "giu");

// Never use parseFloat/Number directly on formatted prices or coerce objects/booleans.
export const parseVndAmount = value => {
  let amount = value;
  if (typeof value === "string") {
    if (value.length > 64) return null;
    const text = value.trim().replace(/(?:₫|đồng|vnđ|vnd|đ)$/iu, "").trim();
    if (!AMOUNT.test(text)) return null;
    amount = Number(text.replace(/[., \u00a0\u202f]/gu, ""));
  }
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
};

// Only the model input changes; the customer's original message stays in the UI.
export const normalizeVndAmountsInText = text => text.replace(GROUPED_IN_TEXT, (match, number, suffix = "") => {
  const amount = parseVndAmount(number);
  return amount === null ? match : `${amount}${suffix}`;
});
