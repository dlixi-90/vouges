import express from "express";
import authUser from "../middleware/authMiddleware.js";
import aiRateLimit from "../middleware/aiRateLimit.js";
import {
  answerLocallyWhenPossible,
  chatWithAI,
} from "../controllers/aiController.js";

const aiRouter = express.Router();

aiRouter.post("/chat", authUser, answerLocallyWhenPossible, aiRateLimit, chatWithAI);

export default aiRouter;
