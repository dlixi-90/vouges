import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  type: { type: String, enum: ["order_created", "order_status", "review"], required: true },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  href: { type: String, required: true },
  readBy: { type: [String], default: [] },
}, { timestamps: true });
schema.index({ createdAt: -1, _id: -1 });
schema.index({ readBy: 1, createdAt: -1 });
export default mongoose.model("AdminNotification", schema);
