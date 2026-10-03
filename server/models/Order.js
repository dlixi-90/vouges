import mongoose from "mongoose";
import { MAX_ORDER_NOTE_LENGTH } from "../utils/orderNote.js";

const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, ref: "User" },
    items: [
      {
        product: { type: String, required: true, ref: "Product" },
        quantity: { type: Number, required: true },
        size: { type: String, required: true },
        title: { type: String },
        image: { type: String },
        unitPrice: { type: Number },
      },
    ],
    amount: { type: Number, required: true },
    subtotal: { type: Number },
    shipping: { type: Number },
    shippingMethod: { type: String, enum: ["standard", "express"], default: "standard" },
    discount: { type: Number, default: 0 },
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", default: null },
    voucherCode: { type: String, default: "" },
    note: { type: String, default: "", maxlength: MAX_ORDER_NOTE_LENGTH },
    address: { type: String, required: true, ref: "Address" },
    status: {
      type: String,
      enum: [
        "Awaiting Payment",
        "Payment Expired",
        "Payment Cancelled",
        "Payment Review",
        "Order Placed",
        "Packing",
        "Shipping",
        "Delivery",
      ],
      default: "Order Placed",
    },
    paymentMethod: { type: String, enum: ["COD", "QR"], required: true },
    isPaid: { type: Boolean, required: true, default: false },
    paymentCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    qrAmount: {
      type: Number,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paidAt: {
      type: Date,
    },
    paymentExpiresAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

orderSchema.index({
  paymentMethod: 1,
  isPaid: 1,
  status: 1,
  paymentExpiresAt: 1,
});

orderSchema.index({ createdAt: -1, _id: -1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
