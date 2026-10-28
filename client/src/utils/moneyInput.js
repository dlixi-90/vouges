// Input formatting is separate from numeric integer-VND storage and API payloads.
export const formatVndInput = value => {
  if (value === "" || value == null) return "";
  return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString("vi-VN") : "";
};

export const parseVndInput = text => {
  const input = text.trim().replace(/(?:₫|đ|vnd)$/i, "").trim();
  if (!/^[\d.\s]*$/.test(input)) return null;
  const digits = input.replace(/[.\s]/g, "");
  if (!digits) return "";
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
};

export const vndCaretPosition = (formatted, digitsBeforeCaret) => {
  if (digitsBeforeCaret <= 0) return 0;
  let digits = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (/\d/.test(formatted[index]) && ++digits === digitsBeforeCaret) return index + 1;
  }
  return formatted.length;
};
