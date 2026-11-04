import mongoose from "mongoose";
const schema = new mongoose.Schema({
  kind: { type: String, enum: ["brand", "group", "accord", "note"], required: true, index: true },
  key: { type: String, required: true },
  name: { type: String, default: "" },
  nameKey: { type: String },
  slug: { type: String },
  sourceUrl: { type: String, default: "" },
  description: { type: String, default: "", maxlength: 5000 },
  descriptionContent: { type: Object, default: null },
  contentImport: { type: Object, default: null },
  image: { type: String, default: "" },
  contentStatus: { type: String, enum: ["linked", "complete"], default: "linked" },
  productCount: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ kind: 1, key: 1 }, { unique: true });
schema.index({ kind: 1, name: 1, _id: 1 });
schema.index({ kind: 1, contentStatus: 1, name: 1, _id: 1 });
schema.index({ kind: 1, nameKey: 1 }, { unique: true, partialFilterExpression: { nameKey: { $type: "string" } } });
schema.index({ kind: 1, slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });
export default mongoose.model("FragranceTerm", schema);
