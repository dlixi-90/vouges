import mongoose from "mongoose";
const schema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  userId: { type: String, ref: "User", required: true },
  authorName: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true, validate: Number.isInteger },
  comment: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });
schema.index({ productId: 1, userId: 1 }, { unique: true });
schema.index({ productId: 1, createdAt: -1 });
export default mongoose.model("Review", schema);
