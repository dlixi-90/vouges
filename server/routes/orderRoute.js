import express from "express";
import {
  allOrders,
  placeOrderCOD,
  updateStatus,
  placeOrderQr,
  userOrders,
  getOrderStatus,
  getPendingQrOrder,
  cancelQrOrder,
  sepayWebhook,
} from "../controllers/orderController.js";
import authUser, { requireOwner } from "../middleware/authMiddleware.js";
import { dashboard } from "../controllers/dashboardController.js";

const orderRouter = express.Router();

// For Admin
orderRouter.post("/sepay-webhook", sepayWebhook);
orderRouter.get("/", authUser, requireOwner, allOrders);
orderRouter.get("/dashboard", authUser, requireOwner, dashboard);
orderRouter.post("/status", authUser, requireOwner, updateStatus);

// For Payment
orderRouter.post("/cod", authUser, placeOrderCOD);
orderRouter.post("/qr", authUser, placeOrderQr);
orderRouter.get("/pending-payment", authUser, getPendingQrOrder);
orderRouter.post("/:orderId/cancel", authUser, cancelQrOrder);
orderRouter.get("/:orderId", authUser, getOrderStatus);

// For User
orderRouter.post("/userorders", authUser, userOrders);

export default orderRouter;
