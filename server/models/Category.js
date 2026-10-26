import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameKey: { type: String, required: true, unique: true },
    storefrontVisible: { type: Boolean, default: true },
    types: [{
      name: { type: String, required: true, trim: true, maxlength: 100 },
      nameKey: { type: String, required: true },
    }],
  },
  { timestamps: true },
);

export default mongoose.model("Category", categorySchema);
