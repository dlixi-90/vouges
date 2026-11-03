import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  actorId: { type: String, required: true },
  actorEmail: { type: String, required: true },
  targetId: { type: String, required: true },
  targetEmail: { type: String, default: "" },
  fromRole: { type: String, enum: ["user", "owner"], required: true },
  toRole: { type: String, enum: ["user", "owner"], required: true },
  fromVersion: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  toVersion: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  reason: { type: String, required: true, minlength: 5, maxlength: 500 },
  at: { type: Date, required: true },
}, { versionKey: false });
schema.index({ at: -1, _id: -1 });
schema.index({ targetId: 1, at: -1, _id: -1 });
for (const hook of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"]) {
  schema.pre(hook, function () { throw Error("User access audit is append-only"); });
}
schema.pre("save", function () { if (!this.isNew) throw Error("User access audit is append-only"); });
schema.pre("bulkWrite", function (operations) { if (operations.some(operation => !operation.insertOne)) throw Error("User access audit is append-only"); });
export default mongoose.model("UserAccessAudit", schema);
