import express from "express";
import authUser, { requireOwner } from "../middleware/authMiddleware.js";
import { listMyVouchers, listVouchers, createVoucher, setVoucherActive } from "../controllers/voucherController.js";
const router = express.Router();
router.get("/mine", authUser, listMyVouchers);
router.get("/", authUser, requireOwner, listVouchers);
router.post("/", authUser, requireOwner, createVoucher);
router.patch("/:id", authUser, requireOwner, setVoucherActive);
export default router;
