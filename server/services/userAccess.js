import { createHash } from "node:crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import UserAccessAudit from "../models/UserAccessAudit.js";

export const rootAdminEmails = () => new Set((process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
  .split(",").map(email => email.trim().toLowerCase()).filter(Boolean));
export const isRootAdmin = user => Boolean(user?.email && rootAdminEmails().has(user.email.trim().toLowerCase()));
export const userAccess = user => ({
  role: isRootAdmin(user) || user?.adminAccess?.enabled === true ? "owner" : "user",
  isRootAdmin: isRootAdmin(user),
  accessVersion: user?.adminAccess?.version || 0,
});
export const accessStore = { ready: () => UserAccessAudit.init() };
export class AccessError extends Error {
  constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}
export const validUserId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,150}$/.test(value);

export const validateRoleChange = value => {
  if (!value || !["owner", "user"].includes(value.role)
    || !Number.isSafeInteger(value.version) || value.version < 0
    || typeof value.reason !== "string" || value.reason.trim().length < 5 || value.reason.trim().length > 500
    || typeof value.requestId !== "string" || !/^[a-zA-Z0-9_-]{12,100}$/.test(value.requestId)) {
    throw new AccessError("Chọn vai trò hợp lệ và nhập lý do từ 5 đến 500 ký tự. Vui lòng tải lại nếu yêu cầu đã cũ.");
  }
  return { role: value.role, version: value.version, reason: value.reason.trim(), requestId: value.requestId };
};

// Every privilege change and its audit commit together; retries keep the same request key.
export const changeUserRole = async (actorId, targetId, input) => {
  if (!validUserId(actorId) || !validUserId(targetId)) throw new AccessError("Mã người dùng không hợp lệ.");
  const value = validateRoleChange(input);
  const id = createHash("sha256").update(JSON.stringify([actorId, value.requestId])).digest("hex");
  await accessStore.ready();
  for (let attempt = 0; ; attempt++) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const actor = await User.findById(actorId).session(session).lean();
        if (!isRootAdmin(actor)) throw new AccessError("Chỉ quản trị gốc được cấp hoặc thu hồi quyền Admin.", 403);
        const previous = await UserAccessAudit.findById(id).session(session).lean();
        if (previous) {
          if (previous.targetId !== targetId || previous.toRole !== value.role
            || previous.reason !== value.reason || previous.fromVersion !== value.version) {
            throw new AccessError("Mã yêu cầu đã được dùng cho một thay đổi khác.", 409);
          }
          const current = await User.findById(targetId).session(session).lean();
          result = { user: current ? { _id: current._id, ...userAccess(current) } : null, replayed: true };
          return;
        }
        const target = await User.findById(targetId).session(session).lean();
        if (!target) throw new AccessError("Không tìm thấy người dùng.", 404);
        if (actorId === targetId || isRootAdmin(target)) throw new AccessError("Tài khoản quản trị gốc được bảo vệ, không thể thay đổi quyền trên website.", 403);
        const access = userAccess(target);
        if (access.accessVersion !== value.version) throw new AccessError("Quyền tài khoản vừa thay đổi. Hãy tải lại trước khi xác nhận.", 409);
        if (access.role === value.role) throw new AccessError("Người dùng đã có vai trò này. Hãy tải lại danh sách.", 409);
        if (value.role === "owner" && !target.email?.trim()) throw new AccessError("Tài khoản cần có email đã xác minh trước khi được cấp quyền Admin.");
        const at = new Date();
        const versionFilter = value.version === 0
          ? { $or: [{ "adminAccess.version": 0 }, { "adminAccess.version": { $exists: false } }] }
          : { "adminAccess.version": value.version };
        const updated = await User.findOneAndUpdate({ _id: targetId, email: target.email, ...versionFilter }, { $set: {
          role: value.role, adminAccess: { enabled: value.role === "owner", version: value.version + 1, changedBy: actorId, changedAt: at },
        } }, { session, new: true, runValidators: true });
        if (!updated) throw new AccessError("Người dùng vừa thay đổi. Hãy tải lại danh sách.", 409);
        await UserAccessAudit.create([{ _id: id, actorId, actorEmail: actor.email, targetId, targetEmail: target.email,
          fromRole: access.role, toRole: value.role, fromVersion: value.version, toVersion: value.version + 1,
          reason: value.reason, at }], { session });
        result = { user: { _id: updated._id, ...userAccess(updated) }, replayed: false };
      });
      return result;
    } catch (error) {
      if (error.code !== 11000 || attempt >= 2) throw error;
    } finally { await session.endSession(); }
  }
};
