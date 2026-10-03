import crypto from "node:crypto";
import Voucher from "../models/Voucher.js";
import VoucherUse from "../models/VoucherUse.js";
import User from "../models/User.js";
import { issueBirthdayVoucher } from "../services/voucherService.js";
import { vietnamDate } from "../utils/membership.js";

export const listMyVouchers = async (req, res, next) => {
  try {
    await issueBirthdayVoucher(req.user);
    const uses = await VoucherUse.find({ userId: req.user._id }).select("voucherId").lean();
    const now = new Date();
    const vouchers = await Voucher.find({ active: true,
      _id: { $nin: uses.map((use) => use.voucherId) },
      $or: [{ userId: req.user._id }, { userId: null }],
      startsAt: { $lte: now }, expiresAt: { $gt: now },
      $expr: { $lt: ["$usedCount", "$maxUses"] },
    }).select("code kind type value maxDiscount minSubtotal expiresAt").sort({ expiresAt: 1 }).limit(100).lean();
    res.json({ success: true, vouchers });
  } catch (error) { next(error); }
};

export const listVouchers = async (_req, res, next) => {
  try {
    res.json({ success: true, vouchers: await Voucher.find({ kind: "general" }).sort({ createdAt: -1 }).limit(100).lean() });
  } catch (error) { next(error); }
};

export const createVoucher = async (req, res, next) => {
  try {
    const { code, type, value, minSubtotal = 0, maxDiscount = null, maxUses, startsAt, expiresAt } = req.body;
    const start = new Date(startsAt);
    const end = new Date(expiresAt);
    if (typeof code !== "string" || !/^[A-Z0-9-]{3,40}$/i.test(code.trim()) || code.toUpperCase().startsWith("BDAY-")
      || !["percent", "fixed"].includes(type)
      || typeof value !== "number" || !Number.isFinite(value) || value <= 0 || (type === "percent" && value > 100)
      || typeof minSubtotal !== "number" || !Number.isFinite(minSubtotal) || minSubtotal < 0
      || (maxDiscount !== null && (typeof maxDiscount !== "number" || !Number.isFinite(maxDiscount) || maxDiscount <= 0))
      || !Number.isSafeInteger(maxUses) || maxUses < 1
      || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end <= new Date())
      return res.status(400).json({ success: false, message: "Thông tin voucher không hợp lệ." });
    const voucher = await Voucher.create({ code: code.trim().toUpperCase(), type, value,
      minSubtotal, maxDiscount, maxUses, startsAt: start, expiresAt: end });
    res.status(201).json({ success: true, voucher });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Mã voucher đã tồn tại." });
    next(error);
  }
};

export const setVoucherActive = async (req, res, next) => {
  try {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id) || typeof req.body.active !== "boolean")
      return res.status(400).json({ success: false, message: "Yêu cầu không hợp lệ." });
    const voucher = await Voucher.findOneAndUpdate({ _id: req.params.id, kind: "general" },
      { active: req.body.active }, { new: true });
    if (!voucher) return res.status(404).json({ success: false, message: "Không tìm thấy voucher." });
    res.json({ success: true, voucher });
  } catch (error) { next(error); }
};

export const awardBirthdays = async (req, res, next) => {
  const expected = Buffer.from(process.env.CRON_SECRET || "");
  const received = Buffer.from(req.get("authorization") || "");
  const bearer = Buffer.from(`Bearer ${expected.toString()}`);
  if (!expected.length || received.length !== bearer.length || !crypto.timingSafeEqual(received, bearer))
    return res.status(401).json({ success: false, message: "Unauthorized" });
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
