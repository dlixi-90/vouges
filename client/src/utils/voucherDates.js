const DAY_MS = 24 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit", month: "2-digit", year: "numeric",
});

export const getVoucherValidityPeriod = (startsOn, expiresOn) => {
  const parseDay = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error("Ngày voucher không hợp lệ.");
    }
    const day = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) {
      throw new Error("Ngày voucher không hợp lệ.");
    }
    return new Date(`${value}T00:00:00+07:00`);
  };
  const start = parseDay(startsOn);
  const lastDay = parseDay(expiresOn);
  if (lastDay < start) throw new Error("Ngày hết hạn phải từ ngày bắt đầu trở đi.");
  return {
    startsAt: start.toISOString(),
    // Expiry is exclusive, so use the start of the following Vietnam day.
    expiresAt: new Date(lastDay.getTime() + DAY_MS).toISOString(),
  };
};

export const formatVoucherDate = (value) => dateFormatter.format(new Date(value));

// Show the last usable day, including for existing vouchers ending at midnight.
export const formatVoucherExpiryDate = (value) =>
  dateFormatter.format(new Date(new Date(value).getTime() - 1));
