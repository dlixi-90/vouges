import express from "express";
import { upload } from "../middleware/multer.js";
import authUser, { requireOwner } from "../middleware/authMiddleware.js";
import { listReviews, myReview, saveReview } from "../controllers/reviewController.js";
import { listBrands } from "../controllers/brandController.js";
import {
  createProduct,
  deleteProduct,
  listProduct,
  listPopularProducts,
  singleProduct,
  toggleStock,
  updateProduct,
} from "../controllers/productController.js";

const productRouter = express.Router();

productRouter.post(
  "/",
  authUser,
  requireOwner,
  upload.fields([{ name: "images", maxCount: 4 }, { name: "sizeImages", maxCount: 50 }]),
  createProduct,
);
productRouter.get("/", listProduct);
productRouter.get("/brands", listBrands);
productRouter.get("/popular", listPopularProducts);
productRouter.get("/single", singleProduct);
productRouter.get("/:productId/reviews", listReviews);
productRouter.get("/:productId/reviews/mine", authUser, myReview);
productRouter.put("/:productId/reviews/mine", authUser, saveReview);
productRouter.post("/toggle-stock", authUser, requireOwner, toggleStock);
productRouter.put(
  "/:productId",
  authUser,
  requireOwner,
  upload.fields([{ name: "images", maxCount: 4 }, { name: "sizeImages", maxCount: 50 }]),
  updateProduct,
);
productRouter.delete("/:productId", authUser, requireOwner, deleteProduct);

export default productRouter;
