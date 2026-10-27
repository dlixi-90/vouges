import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    ingredients: { type: String, default: "" },
    price: { type: Object, required: true },
    sizes: { type: [String], required: true },
    stockBySize: { type: Object, default: {} },
    inStockBySize: { type: Object, default: {} },
    images: { type: [String], required: true },
    sizeImages: { type: Object, default: {} },
    imageProcessing: { type: Object, default: {} },
    category: { type: String, required: true },
    type: { type: String, required: true },
    popular: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    inStock: { type: Boolean, default: true },
    inventoryMode: { type: String, enum: ["tracked", "source"], default: "tracked" },
    isPublished: { type: Boolean, default: true, index: true },
    brand: { type: String, default: "", index: true },
    origin: { type: String, default: "" },
    concentration: { type: String, default: "", index: true },
    gender: { type: String, default: "" },
    catalogScope: { type: String, enum: ["perfume", "other"], default: "perfume", index: true },
    fragrance: { type: Object, default: {} },
    variantMetadata: { type: Object, default: {} },
    source: { type: Object, default: {} },
    qualityIssues: { type: [String], default: [] },
  },
  { timestamps: true },
);
productSchema.index({ "source.provider": 1, "source.id": 1 }, { unique: true, partialFilterExpression: { "source.provider": { $type: "string" }, "source.id": { $type: "number" } } });

const Product = mongoose.model("Product", productSchema);

export default Product;
