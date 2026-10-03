import mongoose from "mongoose";
const schema = new mongoose.Schema({
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", required: true },
  userId: { type: String, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
}, { timestamps: true });
schema.index({ voucherId: 1, userId: 1 }, { unique: true });
export default mongoose.model("VoucherUse", schema);
