import crypto from "node:crypto";
import Voucher from "../models/Voucher.js";
import VoucherUse from "../models/VoucherUse.js";
import User from "../models/User.js";
import { issueBirthdayVoucher } from "../services/voucherService.js";
import { vietnamDate } from "../utils/membership.js";
import { customerProfile } from "../utils/customerProfile.js";

export const listMyVouchers = async (req, res, next) => {
  try {
    const [, uses] = await Promise.all([
      issueBirthdayVoucher(req.user),
      VoucherUse.find({ userId: req.user._id }).select("voucherId -_id").lean(),
    ]);
    const now = new Date();
    const vouchers = await Voucher.find({ active: true, deletedAt: null,
      _id: { $nin: uses.map((use) => use.voucherId) },
      $or: [{ userId: req.user._id }, { userId: null }],
      $and: [{ $or: [
        { allowedUserIds: { $exists: false } },
        { allowedUserIds: { $size: 0 } },
        { allowedUserIds: req.user._id },
      ] }],
      startsAt: { $lte: now }, expiresAt: { $gt: now },
      $expr: { $lt: ["$usedCount", "$maxUses"] },
    }).select("code kind type value maxDiscount minSubtotal expiresAt").sort({ expiresAt: 1 }).limit(100).lean();
    res.set("Cache-Control", "private, no-store");
    res.json({ success: true, vouchers, profile: {
      username: customerProfile(req.user).fullName, phone: customerProfile(req.user).phone,
      email: req.user.email, birthday: req.user.birthday || "",
    } });
  } catch (error) { next(error); }
};

export const listVouchers = async (_req, res, next) => {
  try {
    res.set("Cache-Control", "private, no-store");
    res.json({ success: true, vouchers: await Voucher.find({ kind: "general", deletedAt: null }).sort({ createdAt: -1 }).limit(100).lean() });
  } catch (error) { next(error); }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const searchVoucherCustomers = async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 3 || q.length > 120 || (req.query.q != null && typeof req.query.q !== "string"))
    return res.status(400).json({ success: false, message: "Nhập ít nhất 3 ký tự email hoặc số điện thoại." });
  try {
    const digitVariants = new Set([q.replace(/\D/g, "")]);
    for (const digits of [...digitVariants]) {
      if (digits.startsWith("0")) digitVariants.add(digits.slice(1));
      if (digits.startsWith("84")) digitVariants.add(digits.slice(2));
    }
    const phonePatterns = [...digitVariants]
      .filter((digits) => digits.length >= 3)
      .map((digits) => new RegExp(digits.split("").map(escapeRegex).join("[\\s()+.-]*")));
    const users = await User.find({ role: { $ne: "owner" }, $or: [
      { email: { $regex: escapeRegex(q), $options: "i" } },
      ...phonePatterns.map((pattern) => ({ phone: pattern })),
    ] }).select("username email phone").sort({ username: 1, _id: 1 }).limit(10).lean();
    return res.json({ success: true, customers: users.map(({ _id, username, email, phone }) => ({ _id, name: username, email, phone })) });
  } catch (error) { next(error); }
};

export const createVoucher = async (req, res, next) => {
  try {
    const { code, type, value, minSubtotal = 0, maxDiscount = null, maxUses, startsAt, expiresAt } = req.body;
    const allowedUserIds = req.body.allowedUserIds ?? [];
    const start = new Date(startsAt);
    const end = new Date(expiresAt);
    if (typeof code !== "string" || !/^[A-Z0-9-]{3,40}$/i.test(code.trim()) || code.toUpperCase().startsWith("BDAY-")
      || !["percent", "fixed"].includes(type)
      || typeof value !== "number" || !Number.isFinite(value) || value <= 0 || (type === "percent" && value > 100)
      || !Number.isSafeInteger(minSubtotal) || minSubtotal < 0
      || (maxDiscount !== null && (!Number.isSafeInteger(maxDiscount) || maxDiscount <= 0))
      || (type === "fixed" && !Number.isSafeInteger(value))
      || !Number.isSafeInteger(maxUses) || maxUses < 1
      || !Array.isArray(allowedUserIds) || allowedUserIds.length > 100
      || allowedUserIds.some((id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,150}$/.test(id))
      || new Set(allowedUserIds).size !== allowedUserIds.length
      || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end <= new Date())
      return res.status(400).json({ success: false, message: "Thông tin mã giảm giá không hợp lệ." });
    if (allowedUserIds.length) {
      const eligibleUsers = await User.find({ _id: { $in: allowedUserIds }, role: { $ne: "owner" } })
        .select("_id").lean();
      if (eligibleUsers.length !== allowedUserIds.length)
        return res.status(400).json({ success: false, message: "Danh sách khách hàng có tài khoản không hợp lệ." });
    }
    const voucher = await Voucher.create({ code: code.trim().toUpperCase(), type, value,
      minSubtotal, maxDiscount, maxUses, startsAt: start, expiresAt: end, allowedUserIds });
    res.status(201).json({ success: true, voucher });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "mã giảm giá đã tồn tại." });
    next(error);
  }
};

export const setVoucherActive = async (req, res, next) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id) || typeof req.body.active !== "boolean")
      return res.status(400).json({ success: false, message: "Yêu cầu không hợp lệ." });
    const voucher = await Voucher.findOneAndUpdate({ _id: req.params.id, kind: "general", deletedAt: null },
      { active: req.body.active }, { new: true });
    if (!voucher) return res.status(404).json({ success: false, message: "Không tìm thấy mã giảm giá." });
    res.json({ success: true, voucher });
  } catch (error) { next(error); }
};

export const deleteVoucher = async (req, res, next) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id))
      return res.status(400).json({ success: false, message: "Yêu cầu không hợp lệ." });
    // Keep the original voucher and its code for order history and use records.
    const voucher = await Voucher.findOneAndUpdate(
      { _id: req.params.id, kind: "general", deletedAt: null },
      { $set: { active: false, deletedAt: new Date() } },
      { new: true },
    );
    if (!voucher) return res.status(404).json({ success: false, message: "Không tìm thấy mã giảm giá." });
    res.json({ success: true, message: "Đã xóa mã giảm giá." });
  } catch (error) { next(error); }
};

export const awardBirthdays = async (req, res, next) => {
  const expected = Buffer.from(process.env.CRON_SECRET || "");
  const received = Buffer.from(req.get("authorization") || "");
  const bearer = Buffer.from(`Bearer ${expected.toString()}`);
  if (!expected.length || received.length !== bearer.length || !crypto.timingSafeEqual(received, bearer))
    return res.status(401).json({ success: false, message: "Bạn chưa được xác thực" });
  try {
    const now = new Date();
    const today = new Date(`${vietnamDate(now)}T00:00:00+07:00`);
    const days = Array.from({ length: 7 }, (_, index) =>
      vietnamDate(new Date(today.getTime() - index * 86400000)).slice(5));
    if (days.includes("02-28")) days.push("02-29");
    let awarded = 0;
    const cursor = User.find({ birthdayMonthDay: { $in: days } }).cursor();
    try {
      for await (const user of cursor) {
        if (await issueBirthdayVoucher(user, now)) awarded += 1;
      }
    } finally { await cursor.close(); }
    res.json({ success: true, eligibleMembers: awarded });
  } catch (error) { next(error); }
};
