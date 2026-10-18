import mongoose from "mongoose";

const schema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "SupportConversation" },
  sequence: { type: Number, required: true },
  senderId: { type: String, required: true },
  role: { type: String, enum: ["customer", "staff"], required: true },
  authorName: { type: String, required: true },
  clientMessageId: { type: String, required: true },
  content: { type: String, required: true, maxlength: 3000 },
}, { timestamps: true });
schema.index({ conversationId: 1, sequence: 1 }, { unique: true });
schema.index({ conversationId: 1, senderId: 1, clientMessageId: 1 }, { unique: true });
export default mongoose.model("SupportMessage", schema);
