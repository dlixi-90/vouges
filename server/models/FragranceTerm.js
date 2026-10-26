import mongoose from "mongoose";
const schema = new mongoose.Schema({
  kind: { type: String, enum: ["brand", "group", "accord", "note"], required: true, index: true },
  key: { type: String, required: true },
  name: { type: String, default: "" },
  sourceUrl: { type: String, default: "" },
  description: { type: String, default: "", maxlength: 5000 },
  image: { type: String, default: "" },
  contentStatus: { type: String, enum: ["linked", "complete"], default: "linked" },
  productCount: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ kind: 1, key: 1 }, { unique: true });
export default mongoose.model("FragranceTerm", schema);
