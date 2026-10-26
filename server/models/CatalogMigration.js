import mongoose from "mongoose";
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  currency: { type: String, default: "VND" },
  moneyUnitVersion: { type: Number, default: 2 },
  source: String,
  sourceCollectedAt: Date,
  appliedAt: Date,
  totals: Object,
  backupPath: String,
}, { timestamps: true });
export default mongoose.model("CatalogMigration", schema);
