import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  kind: { type: String, enum: ["general", "birthday"], default: "general" },
  userId: { type: String, ref: "User", default: null },
  birthdayYear: { type: Number },
  type: { type: String, enum: ["percent", "fixed"], required: true },
  value: { type: Number, required: true, min: 0 },
  maxDiscount: { type: Number, default: null },
  minSubtotal: { type: Number, default: 0, min: 0 },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  maxUses: { type: Number, required: true, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });
voucherSchema.index({ userId: 1, birthdayYear: 1 }, {
  unique: true, partialFilterExpression: { kind: "birthday" },
});
export default mongoose.model("Voucher", voucherSchema);
