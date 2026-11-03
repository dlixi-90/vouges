import User from "../models/User.js";
import UserAccessAudit from "../models/UserAccessAudit.js";
import { customerProfile } from "../utils/customerProfile.js";
import { AccessError, changeUserRole, isRootAdmin, rootAdminEmails, userAccess, validUserId } from "../services/userAccess.js";

const handle = operation => async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  try { return res.json({ success: true, ...await operation(req) }); }
  catch (error) {
    if (error instanceof AccessError) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};
const pagination = (query, allowed = [10, 25, 50]) => {
  const page = Number(query.page ?? 1), pageSize = Number(query.pageSize ?? 25);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !allowed.includes(pageSize)) throw new AccessError("Phân trang không hợp lệ.");
  return { page, pageSize };
};
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listUsers = handle(async req => {
  const { page, pageSize } = pagination(req.query);
  const q = req.query.q ?? "", role = req.query.role ?? "all";
  if (typeof q !== "string" || q.length > 120 || !["all", "user", "owner"].includes(role)) throw new AccessError("Bộ lọc người dùng không hợp lệ.");
  const roots = [...rootAdminEmails()];
  const rootMatch = { email: { $in: roots.map(email => new RegExp(`^${escaped(email)}$`, "i")) } };
  const ownerMatch = { $or: [rootMatch, { "adminAccess.enabled": true }] };
  const clauses = role === "all" ? [] : [role === "owner" ? ownerMatch : { $nor: [ownerMatch] }];
  if (q.trim()) {
    const literal = { $regex: escaped(q.trim()), $options: "i" };
    const search = ["customerProfile.fullName", "username", "email", "phone", "customerProfile.phone"].map(field => ({ [field]: literal }));
    const digits = q.replace(/\D/g, "").replace(/^(84|0)/, "");
    if (digits && /^[+()\d\s-]+$/.test(q.trim())) {
      const phone = { $regex: digits.split("").join("[\\s()-]*") };
      search.push({ phone }, { "customerProfile.phone": phone });
    }
    clauses.push({ $or: search });
  }
  const filter = clauses.length > 1 ? { $and: clauses } : clauses[0] || {};
  const [users, total] = await Promise.all([
    User.find(filter).select("username email phone birthday customerProfile profileOnboardingRequired role adminAccess createdAt")
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    User.countDocuments(filter),
  ]);
  const canManageRoles = isRootAdmin(req.user);
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), canManageRoles,
    users: users.map(user => {
      const access = userAccess(user);
      return { _id: user._id, ...customerProfile(user), ...access, createdAt: user.createdAt,
        canChangeRole: canManageRoles && !access.isRootAdmin && user._id !== req.user._id,
        canEditProfile: canManageRoles || access.role === "user" };
    }) };
});
export const setUserRole = handle(req => changeUserRole(req.user._id, req.params.id, req.body));
export const myAccess = handle(req => userAccess(req.user));
export const listAccessAudit = handle(async req => {
  const { page, pageSize } = pagination(req.query);
  if (req.query.userId != null && !validUserId(req.query.userId)) throw new AccessError("Mã người dùng không hợp lệ.");
  const filter = req.query.userId ? { targetId: req.query.userId } : {};
  const [entries, total] = await Promise.all([
    UserAccessAudit.find(filter).sort({ at: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    UserAccessAudit.countDocuments(filter),
  ]);
  return { entries, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
});
