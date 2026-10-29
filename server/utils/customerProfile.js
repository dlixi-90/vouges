import { validateDeliveryPhone } from "./deliveryPhone.js";

export const profileDate = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = type => parts.find(entry => entry.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const realDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
export const latestAdultBirthday = (now = new Date()) => {
  const today = profileDate(now);
  const cutoff = `${Number(today.slice(0, 4)) - 18}${today.slice(4)}`;
  return realDate(cutoff) ? cutoff : `${Number(today.slice(0, 4)) - 18}-02-28`;
};
export const validateCustomerProfile = (raw = {}, now = new Date()) => {
  const errors = {};
  const fullName = typeof raw?.fullName === "string" ? raw.fullName.normalize("NFC").trim().replace(/\s+/g, " ") : "";
  if (fullName.length < 2 || fullName.length > 120 || !/^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u.test(fullName)) {
    errors.fullName = "Vui lòng nhập họ tên hợp lệ, từ 2 đến 120 ký tự.";
  }
  const phone = validateDeliveryPhone(typeof raw?.phone === "string" ? raw.phone : "");
  if (!phone.valid) errors.phone = phone.error;
  const birthday = raw?.birthday;
  if (!realDate(birthday) || birthday < "1900-01-01" || birthday > profileDate(now)) {
    errors.birthday = "Vui lòng nhập đầy đủ ngày, tháng, năm sinh hợp lệ.";
  } else if (birthday > latestAdultBirthday(now)) {
    errors.birthday = "Bạn phải đủ 18 tuổi để đăng ký thông tin khách hàng.";
  }
  return { errors, value: { fullName, phone: phone.normalized, birthday } };
};

export const customerProfile = user => ({
  fullName: user.customerProfile?.fullName || user.username || "",
  username: user.customerProfile?.fullName || user.username || "",
  phone: user.customerProfile?.phone || user.phone || "",
  email: user.email || "",
  birthday: user.birthday || "",
  completedAt: user.customerProfile?.completedAt || null,
  needsCompletion: Boolean(user.role !== "owner" && user.profileOnboardingRequired && !user.customerProfile?.completedAt),
});
