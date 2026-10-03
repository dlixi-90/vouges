import crypto from "node:crypto";
import Voucher from "../models/Voucher.js";
import VoucherUse from "../models/VoucherUse.js";
import { birthdayWindow } from "../utils/membership.js";

export class VoucherError extends Error {
  constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}
export const issueBirthdayVoucher = async (user, now = new Date()) => {
  const window = birthdayWindow(user.birthday, now);
  if (!window) return null;
  const filter = { userId: user._id, kind: "birthday", birthdayYear: window.year };
  try {
    return await Voucher.findOneAndUpdate(filter, { $setOnInsert: {
      ...filter, code: `BDAY-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
      type: "percent", value: 10, maxDiscount: 100, minSubtotal: 300,
      startsAt: window.startsAt, expiresAt: window.expiresAt, maxUses: 1,
    } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error.code === 11000) return Voucher.findOne(filter);
    throw error;
  }
};

export const calculateDiscount = (voucher, subtotal) => {
  let discount = voucher.type === "percent" ? subtotal * voucher.value / 100 : voucher.value;
  if (voucher.maxDiscount != null) discount = Math.min(discount, voucher.maxDiscount);
  // Amounts in this project use thousands of VND; round to one VND.
  return Math.round(Math.max(0, Math.min(subtotal, discount)) * 1000) / 1000;
};

export const validateVoucher = async (code, userId, subtotal, session, now = new Date()) => {
  if (!code) return null;
  if (typeof code !== "string" || !/^[A-Z0-9-]{3,40}$/i.test(code.trim()))
    throw new VoucherError("Mã voucher không hợp lệ.");
  const query = Voucher.findOne({ code: code.trim().toUpperCase(), active: true });
  const voucher = await (session ? query.session(session) : query);
  if (!voucher || (voucher.userId && voucher.userId !== userId))
    throw new VoucherError("Voucher không tồn tại hoặc không dành cho tài khoản này.");
  if (now < voucher.startsAt || now >= voucher.expiresAt)
    throw new VoucherError("Voucher chưa có hiệu lực hoặc đã hết hạn.");
  if (subtotal < voucher.minSubtotal) throw new VoucherError("Đơn hàng chưa đạt giá trị tối thiểu của voucher.");
  if (voucher.usedCount >= voucher.maxUses) throw new VoucherError("Voucher đã hết lượt sử dụng.");
  const usedQuery = VoucherUse.exists({ voucherId: voucher._id, userId });
  if (await (session ? usedQuery.session(session) : usedQuery))
    throw new VoucherError("Bạn đã sử dụng voucher này.");
  return voucher;
};

export const reserveVoucher = async (voucher, userId, orderId, session) => {
  if (!voucher) return;
  const result = await Voucher.updateOne({ _id: voucher._id,
    active: true, usedCount: { $lt: voucher.maxUses },
  }, { $inc: { usedCount: 1 } }, { session });
  if (result.modifiedCount !== 1) throw new VoucherError("Voucher đã hết lượt sử dụng.", 409);
  try {
    await VoucherUse.create([{ voucherId: voucher._id, userId, orderId }], { session });
  } catch (error) {
    if (error.code === 11000) throw new VoucherError("Bạn đã sử dụng voucher này.", 409);
    throw error;
  }
};

export const releaseVoucher = async (order, session) => {
  if (!order.voucherId) return;
  const use = await VoucherUse.findOneAndDelete({ orderId: order._id }, { session });
  if (use) await Voucher.updateOne({ _id: order.voucherId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } }, { session });
};
