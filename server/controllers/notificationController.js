import Notification from "../models/AdminNotification.js";
import { markAllAdminNotificationsRead, readAdminNotifications } from "../services/adminNotifications.js";
import { streamSnapshots } from "../services/supportStream.js";

const action = handler => async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  try { await handler(req, res); } catch (error) { next(error); }
};
export const listNotifications = action(async (req, res) => res.json({ success: true, ...await readAdminNotifications(req.user._id) }));
export const streamNotifications = action(async (req, res) => {
  await streamSnapshots(req, res, () => readAdminNotifications(req.user._id), { intervalMs: 3000 });
});
export const markNotificationRead = action(async (req, res) => {
  const id = req.body?.id;
  if (typeof id !== "string" || id.length > 200 || !/^(order|review):/u.test(id)) {
    return res.status(400).json({ success: false, message: "Thông báo không hợp lệ." });
  }
  await Notification.updateOne({ _id: id }, { $addToSet: { readBy: String(req.user._id) } });
  res.json({ success: true, ...await readAdminNotifications(req.user._id) });
});
export const markAllNotificationsRead = action(async (req, res) => {
  const value = req.body?.before;
  const before = typeof value === "string" ? new Date(value) : new Date(NaN);
  if (!Number.isFinite(before.getTime()) || before.getTime() > Date.now()) {
    return res.status(400).json({ success: false, message: "Mốc đọc thông báo không hợp lệ." });
  }
  await markAllAdminNotificationsRead(req.user._id, before);
  res.json({ success: true, ...await readAdminNotifications(req.user._id) });
});
