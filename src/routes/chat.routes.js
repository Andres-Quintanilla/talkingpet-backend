import { Router } from "express";
import * as chatCtrl from "../controllers/chat.controller.js";
import { saveFeedback } from "../services/feedback.service.js"; 
import { requireAuth } from '../middleware/auth.js';
import { optionalAuth } from "../middleware/optionalAuth.js"; 

const router = Router();

router.post("/", optionalAuth, chatCtrl.sendMessage);

router.get("/history/:sessionId", chatCtrl.getHistory);

router.post("/notify", requireAuth, chatCtrl.sendNotification);

router.post("/feedback", async (req, res) => {
  const { messageId, isUseful, comment } = req.body;
  if (messageId == null) {
     return res.status(400).json({ success: false, error: "messageId is required" });
  }
  const result = await saveFeedback(messageId, isUseful, comment); 
  res.json(result);
});

export default router;