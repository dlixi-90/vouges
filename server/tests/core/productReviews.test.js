import test from "node:test";
import assert from "node:assert/strict";
import Product from "../../models/Product.js";
import Order from "../../models/Order.js";
import Review from "../../models/Review.js";
import { listReviews, saveReview, myReview } from "../../controllers/reviewController.js";

const productId = "507f1f77bcf86cd799439011";
const userId = "user_customer";
const req = (body = {}) => ({ params: { productId }, body, user: { _id: userId, username: "Customer" } });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const next = (error) => { throw error; };

test("invalid scores/comments cannot write reviews or query purchases", async (t) => {
  const exists = t.mock.method(Order, "exists", async () => assert.fail("No purchase read"));
  const write = t.mock.method(Review, "findOneAndUpdate", async () => assert.fail("No review write"));
  for (const body of [{ rating: 0, comment: "Hi" }, { rating: 6, comment: "Hi" }, { rating: 2.5, comment: "Hi" },
    { rating: "5", comment: "Hi" }, { rating: 5, comment: " " }, { rating: 5, comment: "a".repeat(2001) },
    { rating: 5, comment: { $ne: null } }]) {
    const res = response(); await saveReview(req(body), res, next); assert.equal(res.statusCode, 400);
  }
  assert.equal(exists.mock.callCount(), 0); assert.equal(write.mock.callCount(), 0);
});

test("unverified purchases or someone else's orders cannot authorize a review", async (t) => {
  t.mock.method(Product, "exists", async () => ({ _id: productId }));
  t.mock.method(Order, "exists", async (filter) => {
    assert.equal(filter.userId, userId); assert.equal(filter["items.product"], productId);
    assert.equal(filter.status, "Delivery"); assert.deepEqual(filter.$or, [{ paymentMethod: "COD" }, { isPaid: true }]);
    return null;
  });
  const write = t.mock.method(Review, "findOneAndUpdate", async () => assert.fail("No write"));
  const res = response(); await saveReview(req({ rating: 5, comment: "Nice", userId: "someone_else", eligible: true }), res, next);
  assert.equal(res.statusCode, 403); assert.equal(write.mock.callCount(), 0);
});

test("delivered buyer updates one review per product using server identity and plain text", async (t) => {
  t.mock.method(Product, "exists", async () => ({ _id: productId }));
  t.mock.method(Order, "exists", async () => ({ _id: "delivered" }));
  t.mock.method(Review, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { productId, userId }); assert.equal(options.upsert, true); assert.equal(options.runValidators, true);
    assert.deepEqual(update.$set, { rating: 4, comment: "<script>plain text</script>", authorName: "Customer" });
    return { _id: "review", ...filter, ...update.$set };
  });
  const res = response(); await saveReview(req({ rating: 4, comment: " <script>plain text</script> ", userId: "other", authorName: "Fake" }), res, next);
  assert.equal(res.body.success, true); assert.equal(res.body.review.authorName, "Customer");
  assert.equal(res.body.review.userId, undefined);
  assert.equal(Review.schema.indexes().find(([keys]) => keys.productId && keys.userId)[1].unique, true);
});

test("public review pages expose no Clerk user IDs or private customer details", async (t) => {
  const review = { _id: "review", authorName: "Customer", rating: 5, comment: "Nice", userId, email: "private@example.com" };
  t.mock.method(Review, "find", () => ({ sort: () => ({ skip: (skip) => {
    assert.equal(skip, 10); return { limit: (limit) => { assert.equal(limit, 10); return { lean: async () => [review] }; } };
  } }) }));
  t.mock.method(Review, "aggregate", async () => [{ count: 11, average: 4.5 }]);
  const res = response(); await listReviews({ params: { productId }, query: { page: "2" } }, res, next);
  assert.equal(res.body.count, 11); assert.equal(res.body.average, 4.5);
  assert.equal(res.body.reviews[0].userId, undefined); assert.equal(res.body.reviews[0].email, undefined);
});

test("my review endpoint restricts the query to the authenticated customer", async (t) => {
  t.mock.method(Review, "findOne", (filter) => {
    assert.deepEqual(filter, { productId, userId }); return { lean: async () => null };
  });
  t.mock.method(Order, "exists", async () => null);
  const res = response(); await myReview(req(), res, next);
  assert.equal(res.body.eligible, false); assert.equal(res.body.review, null);
});

test("delivered buyers can load their saved score and comment for editing", async (t) => {
  const saved = { _id: "review", productId, userId, authorName: "Customer", rating: 3,
    comment: "Sản phẩm dùng tốt.", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02") };
  t.mock.method(Review, "findOne", (filter) => {
    assert.deepEqual(filter, { productId, userId });
    return { lean: async () => saved };
  });
  t.mock.method(Order, "exists", async (filter) => {
    assert.equal(filter.userId, userId);
    assert.equal(filter["items.product"], productId);
    assert.equal(filter.status, "Delivery");
    assert.deepEqual(filter.$or, [{ paymentMethod: "COD" }, { isPaid: true }]);
    return { _id: "delivered-order" };
  });
  const res = response();
  await myReview(req(), res, next);
  assert.equal(res.body.eligible, true);
  assert.equal(res.body.review.rating, 3);
  assert.equal(res.body.review.comment, saved.comment);
  assert.equal(res.body.review.userId, undefined);
});

test("malformed product IDs are rejected before Mongo queries", async (t) => {
  const find = t.mock.method(Review, "find", () => assert.fail("No query"));
  const res = response(); await listReviews({ params: { productId: "invalid" } }, res, next);
  assert.equal(res.statusCode, 400); assert.equal(find.mock.callCount(), 0);
});
