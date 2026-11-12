import Notification from "../models/AdminNotification.js";
import Conversation from "../models/SupportConversation.js";

export const supportNotification = conversation => ({
  id: `support:${conversation._id}`, type: "message", count: conversation.unreadStaff,
  title: `${conversation.customerName || "Khách hàng"} cần hỗ trợ`,
  body: conversation.lastMessage || "Có yêu cầu hỗ trợ mới.",
  href: `/owner/messages?conversation=${conversation._id}`,
  createdAt: conversation.lastMessageAt,
});

export const readAdminNotifications = async userId => {
  const asOf = new Date().toISOString();
  const [events, support] = await Promise.all([
    Notification.aggregate([
      { $match: { readBy: { $ne: String(userId) } } },
      { $facet: { total: [{ $count: "count" }], items: [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 30 }, { $project: { readBy: 0 } }] } },
    ]),
    Conversation.aggregate([
      { $match: { unreadStaff: { $gt: 0 } } },
      { $facet: {
        total: [{ $group: { _id: null, count: { $sum: "$unreadStaff" } } }],
        items: [{ $sort: { lastMessageAt: -1, _id: -1 } }, { $limit: 30 },
          { $project: { customerName: 1, unreadStaff: 1, lastMessage: 1, lastMessageAt: 1 } }],
      } },
    ]),
  ]);
  const unreadMessages = support[0]?.total[0]?.count || 0;
  const unreadActivities = events[0]?.total[0]?.count || 0;
  const items = [
    ...(support[0]?.items || []).map(supportNotification),
    ...(events[0]?.items || []).map(event => ({ id: event._id, type: event.type, title: event.title, body: event.body, href: event.href, createdAt: event.createdAt, count: 1 })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id.localeCompare(a.id)).slice(0, 40);
  return { asOf, items, unreadMessages, unreadActivities, unreadCount: unreadMessages + unreadActivities };
};

export const markAllAdminNotificationsRead = async (userId, before) => {
  // Never clear messages received after the snapshot the administrator saw.
  const conversations = await Conversation.find({ unreadStaff: { $gt: 0 }, lastMessageAt: { $lte: before } }).select("_id sequence").lean();
  if (conversations.length) await Conversation.bulkWrite(conversations.map(conversation => ({ updateOne: {
    filter: { _id: conversation._id, sequence: conversation.sequence, lastMessageAt: { $lte: before } },
    update: { $set: { unreadStaff: 0 } },
  } })));
  await Notification.updateMany({ createdAt: { $lte: before }, readBy: { $ne: String(userId) } }, { $addToSet: { readBy: String(userId) } });
};
