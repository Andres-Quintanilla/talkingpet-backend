// src/routes/customerAddress.routes.js
import { Router } from "express";
import {
  getMyServiceAddress,
  upsertMyServiceAddress,
} from "../controllers/customerAddress.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js"; // ajusta el path/nombre si tu middleware se llama distinto

const router = Router();

router.get("/service-address", requireAuth, getMyServiceAddress);
router.post("/service-address", requireAuth, upsertMyServiceAddress);

export default router;
