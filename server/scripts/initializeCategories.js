import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";
import { initializeCategories } from "../services/categoryService.js";

// Run once when importing a legacy catalog, not on every serverless cold start.
try {
  await connectDB();
  await initializeCategories();
  console.log("Catalog categories initialized");
} finally {
  await mongoose.disconnect();
}
