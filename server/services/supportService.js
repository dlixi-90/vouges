import mongoose from "mongoose";
import Conversation from "../models/SupportConversation.js";
import Message from "../models/SupportMessage.js";

export class SupportError extends Error {
  constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}
export const isStaff = (user) => user.role === "owner";
export const conversationView = (item, includeContext = true) => ({
  _id: item._id, customerName: item.customerName, customerEmail: item.customerEmail,
  status: item.status, sequence: item.sequence, unreadStaff: item.unreadStaff,
  unreadCustomer: item.unreadCustomer, lastMessage: item.lastMessage, lastMessageAt: item.lastMessageAt,
  createdAt: item.createdAt, updatedAt: item.updatedAt,
  ...(includeContext ? { context: item.context || [] } : {}),
});
export const messageView = (item) => ({
  _id: item._id, sequence: item.sequence, role: item.role, authorName: item.authorName,
  content: item.content, clientMessageId: item.clientMessageId, createdAt: item.createdAt,
});
export const normalizeContext = (context = []) => {
  if (!Array.isArray(context) || context.length > 12) throw new SupportError("Chỉ chia sẻ tối đa 12 tin nhắn gần nhất.");
  let size = 0;
  return context.map((item) => {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string"
      || !item.content.trim() || item.content.length > 2000) throw new SupportError("Nội dung chia sẻ với CSKH không hợp lệ.");
    const content = item.content.trim();
    size += content.length;
    if (size > 18000) throw new SupportError("Nội dung chia sẻ quá dài. Hãy chọn ít tin nhắn hơn.");
    return { role: item.role, content };
  });
};
export const normalizeSupportMessage = (body) => {
  if (typeof body?.content !== "string" || !body.content.trim() || body.content.length > 3000
    || typeof body.clientMessageId !== "string" || !/^[a-z0-9-]{16,80}$/i.test(body.clientMessageId))
    throw new SupportError("Tin nhắn cần có từ 1 đến 3.000 ký tự.");
  return { content: body.content.trim(), clientMessageId: body.clientMessageId };
};
export const findConversation = async (id, user, session) => {
  if (!mongoose.isObjectIdOrHexString(id)) throw new SupportError("Hội thoại không hợp lệ.");
  const query = Conversation.findOne({ _id: id, ...(!isStaff(user) ? { userId: user._id } : {}) });
  const result = await (session ? query.session(session) : query).lean();
  if (!result) throw new SupportError("Không tìm thấy hội thoại.", 404);
  return result;
};
export const readMessages = async (conversationId, before) => {
  const messages = await Message.find({ conversationId, ...(before ? { sequence: { $lt: before } } : {}) })
    .sort({ sequence: -1 }).limit(50).lean();
  return messages.reverse().map(messageView);
};
export const conversationSnapshot = async (conversation) => {
  // Bound the message read to the metadata revision so a concurrent send is
  // picked up with its matching unread counts on the next stream update.
  const messages = await Message.find({ conversationId: conversation._id, sequence: { $lte: conversation.sequence } })
    .sort({ sequence: -1 }).limit(50).lean();
  return { conversation: conversationView(conversation), messages: messages.reverse().map(messageView) };
};
export const supportSnapshot = async (id, user) => conversationSnapshot(await findConversation(id, user));
export const sendSupportMessage = async (id, user, body) => {
  const { content, clientMessageId } = normalizeSupportMessage(body);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const conversation = await findConversation(id, user, session);
      const duplicate = await Message.findOne({ conversationId: id, senderId: user._id, clientMessageId }).session(session).lean();
      if (duplicate) {
        if (duplicate.content !== content) throw new SupportError("Mã tin nhắn đã được dùng cho nội dung khác.", 409);
        result = { conversation: conversationView(conversation), message: messageView(duplicate) };
        return;
      }
      const staff = isStaff(user);
      const updated = await Conversation.findOneAndUpdate({ _id: id }, {
        $inc: { sequence: 1, [staff ? "unreadCustomer" : "unreadStaff"]: 1 },
        $set: { lastMessage: content.slice(0, 160), lastMessageAt: new Date(),
          status: staff ? "active" : conversation.status === "resolved" ? "waiting" : conversation.status,
          [staff ? "unreadStaff" : "unreadCustomer"]: 0 },
      }, { new: true, session }).lean();
      const [message] = await Message.create([{ conversationId: id, sequence: updated.sequence,
        senderId: user._id, role: staff ? "staff" : "customer", authorName: user.username || (staff ? "Nhân viên CSKH" : "Khách hàng"),
        content, clientMessageId }], { session });
      result = { conversation: conversationView(updated), message: messageView(message) };
    });
    return result;
  } finally { await session.endSession(); }
};
