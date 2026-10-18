import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, ref: "User" },
  customerName: { type: String, required: true },
  customerEmail: { type: String, default: "" },
  status: { type: String, enum: ["waiting", "active", "resolved"], default: "waiting" },
  sequence: { type: Number, default: 0 },
  unreadStaff: { type: Number, default: 0 },
  unreadCustomer: { type: Number, default: 0 },
  lastMessage: { type: String, default: "Khách hàng cần hỗ trợ" },
  lastMessageAt: { type: Date, default: Date.now },
  context: { type: [{ _id: false, role: { type: String, enum: ["user", "assistant"] }, content: String }], default: [] },
}, { timestamps: true });
schema.index({ status: 1, lastMessageAt: -1, _id: -1 });
schema.index({ lastMessageAt: -1, _id: -1 });
export default mongoose.model("SupportConversation", schema);
