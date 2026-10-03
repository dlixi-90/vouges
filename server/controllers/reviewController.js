import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Review from "../models/Review.js";

const validId = (req, res) => {
  if (mongoose.isObjectIdOrHexString(req.params.productId)) return true;
  res.status(400).json({ success: false, message: "Sản phẩm không hợp lệ." });
  return false;
};
const purchasedFilter = (productId, userId) => ({
  userId, "items.product": productId, status: "Delivery",
  $or: [{ paymentMethod: "COD" }, { isPaid: true }],
});
const publicReview = (review) => ({
  _id: review._id, authorName: review.authorName, rating: review.rating,
  comment: review.comment, createdAt: review.createdAt, updatedAt: review.updatedAt,
});

export const listReviews = async (req, res, next) => {
  if (!validId(req, res)) return;
  try {
    const productId = new mongoose.Types.ObjectId(req.params.productId);
    const page = Math.max(1, Math.min(1000, Math.floor(Number(req.query.page) || 1)));
    const [reviews, stats] = await Promise.all([
      Review.find({ productId }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(10).lean(),
      Review.aggregate([{ $match: { productId } }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } }]),
    ]);
    res.json({ success: true, reviews: reviews.map(publicReview), page,
      count: stats[0]?.count || 0, average: stats[0]?.average || 0 });
  } catch (error) { next(error); }
};

export const myReview = async (req, res, next) => {
  if (!validId(req, res)) return;
  try {
    const productId = req.params.productId;
    const [review, eligible] = await Promise.all([
      Review.findOne({ productId, userId: req.user._id }).lean(),
      Order.exists(purchasedFilter(productId, req.user._id)),
    ]);
    res.json({ success: true, review: review ? publicReview(review) : null, eligible: Boolean(eligible) });
  } catch (error) { next(error); }
};

export const saveReview = async (req, res, next) => {
  if (!validId(req, res)) return;
  try {
    const { rating, comment } = req.body;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== "string"
      || !comment.trim() || comment.trim().length > 2000)
      return res.status(400).json({ success: false, message: "Chọn 1–5 sao và viết nhận xét từ 1 đến 2.000 ký tự." });
    const productId = req.params.productId;
    if (!await Product.exists({ _id: productId, isDeleted: { $ne: true } }))
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm." });
    if (!await Order.exists(purchasedFilter(productId, req.user._id)))
      return res.status(403).json({ success: false, message: "Bạn chỉ có thể đánh giá sản phẩm trong đơn đã giao." });
    const review = await Review.findOneAndUpdate({ productId, userId: req.user._id },
      { $set: { rating, comment: comment.trim(), authorName: req.user.username } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    res.json({ success: true, review: publicReview(review) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Đánh giá đang được cập nhật. Vui lòng thử lại." });
    next(error);
  }
};
