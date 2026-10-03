export const MAX_ORDER_NOTE_LENGTH = 500;

export const normalizeOrderNote = (value) => {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > MAX_ORDER_NOTE_LENGTH) {
    const error = new Error(`Lời nhắn cho cửa hàng phải là văn bản tối đa ${MAX_ORDER_NOTE_LENGTH} ký tự.`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
};
