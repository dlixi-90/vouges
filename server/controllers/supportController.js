import Conversation from "../models/SupportConversation.js";
import { conversationView, conversationSnapshot, findConversation, isStaff, normalizeContext, readMessages, sendSupportMessage, supportSnapshot, SupportError } from "../services/supportService.js";
import { streamSnapshots } from "../services/supportStream.js";

const action = (handler) => async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof SupportError) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};
export const getMySupport = action(async (req, res) => {
  const conversation = await Conversation.findOne({ userId: req.user._id }).lean();
  res.json({ success: true, ...(conversation ? await conversationSnapshot(conversation) : { conversation: null, messages: [] }) });
});
export const startSupport = action(async (req, res) => {
  const context = normalizeContext(req.body?.context);
  const update = { $setOnInsert: { userId: req.user._id }, $set: {
    customerName: req.user.username || "Khách hàng", customerEmail: req.user.email || "",
    lastMessageAt: new Date(),
    ...(context.length ? { context } : {}),
  }, $max: { unreadStaff: 1 } };
  let conversation;
  try { conversation = await Conversation.findOneAndUpdate({ userId: req.user._id }, update, { new: true, upsert: true, setDefaultsOnInsert: true }).lean(); }
  catch (error) {
    if (error.code !== 11000) throw error;
    conversation = await Conversation.findOne({ userId: req.user._id }).lean();
  }
  if (conversation.status === "resolved") await Conversation.updateOne({ _id: conversation._id, status: "resolved" }, { $set: { status: "waiting", lastMessageAt: new Date() } });
  res.json({ success: true, ...await supportSnapshot(conversation._id, req.user) });
});
export const getSupportMessages = action(async (req, res) => {
  const conversation = await findConversation(req.params.id, req.user);
  if (req.query.before !== undefined) {
    const before = Number(req.query.before);
    if (!Number.isSafeInteger(before) || before < 1) throw new SupportError("Trang tin nhắn không hợp lệ.");
    return res.json({ success: true, conversation: conversationView(conversation), messages: await readMessages(conversation._id, before) });
  }
  res.json({ success: true, ...await conversationSnapshot(conversation) });
});
export const postSupportMessage = action(async (req, res) => {
  res.json({ success: true, ...await sendSupportMessage(req.params.id, req.user, req.body) });
});
export const markSupportRead = action(async (req, res) => {
  const conversation = await findConversation(req.params.id, req.user);
  const sequence = req.body?.sequence;
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > conversation.sequence) throw new SupportError("Mốc đã đọc không hợp lệ.");
  const unread = isStaff(req.user) ? "unreadStaff" : "unreadCustomer";
  // A message arriving after this snapshot must retain its unread badge.
  await Conversation.updateOne({ _id: conversation._id, sequence: { $lte: sequence }, [unread]: { $gt: 0 } }, { $set: { [unread]: 0 } });
  res.json({ success: true });
});
export const setSupportStatus = action(async (req, res) => {
  if (!["waiting", "active", "resolved"].includes(req.body?.status)) throw new SupportError("Trạng thái không hợp lệ.");
  const conversation = await findConversation(req.params.id, req.user);
  const updated = await Conversation.findOneAndUpdate({ _id: conversation._id }, { $set: { status: req.body.status } }, { new: true }).lean();
  res.json({ success: true, conversation: conversationView(updated) });
});
const inboxQuery = (req) => {
  const status = req.query.status || "all";
  if (!["all", "waiting", "active", "resolved", "unread"].includes(status)) throw new SupportError("Bộ lọc không hợp lệ.");
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const filter = status === "unread" ? { unreadStaff: { $gt: 0 } } : status === "all" ? {} : { status };
  if (search) {
    const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ customerName: expression }, { customerEmail: expression }];
  }
  const page = Math.max(1, Math.min(1000, Math.floor(Number(req.query.page) || 1)));
  return { filter, page };
};
const readInbox = async ({ filter, page }) => {
  const [items, total, unread] = await Promise.all([
    Conversation.find(filter).select("-context -userId").sort({ lastMessageAt: -1, _id: -1 }).skip((page - 1) * 30).limit(30).lean(),
    Conversation.countDocuments(filter), Conversation.countDocuments({ unreadStaff: { $gt: 0 } }),
  ]);
  return { conversations: items.map((item) => conversationView(item, false)), total, unread, page };
};
export const getSupportInbox = action(async (req, res) => res.json({ success: true, ...await readInbox(inboxQuery(req)) }));
export const streamSupportInbox = action(async (req, res) => {
  const query = inboxQuery(req);
  await streamSnapshots(req, res, () => readInbox(query), { intervalMs: 2000 });
});
export const streamSupportConversation = action(async (req, res) => {
  let initial = await findConversation(req.params.id, req.user);
  let version;
  await streamSnapshots(req, res, async () => {
    const conversation = initial || await findConversation(req.params.id, req.user);
    initial = null;
    const next = `${conversation.updatedAt?.toISOString()}:${conversation.sequence}:${conversation.unreadStaff}:${conversation.unreadCustomer}:${conversation.status}`;
    if (version === next) return null;
    const snapshot = await conversationSnapshot(conversation);
    version = next;
    return snapshot;
  });
});
