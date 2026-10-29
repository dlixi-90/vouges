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
  quoteOrder,
} from "../controllers/orderController.js";
import authUser, { requireOwner, requireCustomerProfile } from "../middleware/authMiddleware.js";
import { dashboard, customerOrdersPage } from "../controllers/dashboardController.js";

const orderRouter = express.Router();

// For Admin
orderRouter.post("/sepay-webhook", sepayWebhook);
orderRouter.get("/", authUser, requireOwner, allOrders);
orderRouter.get("/dashboard", authUser, requireOwner, dashboard);
orderRouter.get("/mine", authUser, customerOrdersPage);
orderRouter.post("/status", authUser, requireOwner, updateStatus);

// For Payment
orderRouter.post("/cod", authUser, requireCustomerProfile, placeOrderCOD);
orderRouter.post("/quote", authUser, quoteOrder);
orderRouter.post("/qr", authUser, requireCustomerProfile, placeOrderQr);
orderRouter.get("/pending-payment", authUser, getPendingQrOrder);
orderRouter.post("/:orderId/cancel", authUser, cancelQrOrder);
orderRouter.get("/:orderId", authUser, getOrderStatus);

// For User
orderRouter.post("/userorders", authUser, userOrders);

export default orderRouter;
