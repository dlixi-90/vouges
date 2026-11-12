import express from "express";
import authUser, { requireOwner } from "../middleware/authMiddleware.js";
import { listNotifications, streamNotifications, markNotificationRead, markAllNotificationsRead } from "../controllers/notificationController.js";

const router = express.Router();
router.use(authUser, requireOwner);
router.get("/", listNotifications);
router.get("/events", streamNotifications);
router.post("/read", markNotificationRead);
router.post("/read-all", markAllNotificationsRead);
export default router;
