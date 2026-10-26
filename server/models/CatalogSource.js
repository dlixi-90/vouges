import mongoose from "mongoose";
const schema = new mongoose.Schema({
  provider: { type: String, required: true },
  sourceId: { type: Number, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  sourceUrl: { type: String, required: true },
  fetchedAt: Date,
  data: { type: Object, required: true },
}, { timestamps: true });
schema.index({ provider: 1, sourceId: 1 }, { unique: true });
export default mongoose.model("CatalogSource", schema);
