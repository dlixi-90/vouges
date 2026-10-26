export const toVndAmount = (value) => {
  const amount = Number(value);

  return Number.isFinite(amount) ? Math.round(amount) : 0;
};

export const formatVnd = (value, currency = "₫") =>
  `${toVndAmount(value).toLocaleString("vi-VN")} ${currency || ""}`.trim();
