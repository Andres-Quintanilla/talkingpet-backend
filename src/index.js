import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import courseRoutes from "./routes/course.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import seoRoutes from "./routes/seo.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import schedulerRoutes from "./routes/scheduler.routes.js";
import medicalRoutes from "./routes/medical.routes.js";
import cryptoPaymentRoutes from "./routes/crypto-payment.routes.js";

import { seoHeaders, gzipCompression } from "./middleware/seo-headers.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { iniciarScheduler } from "./services/scheduler.service.js";

const app = express();
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

console.log("CORS_ORIGIN usado por el backend:", ORIGIN);

app.use(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" })
);

app.use(
  "/api/payments/crypto/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body.toString("utf8");
    next();
  }
);

app.use((req, res, next) => {
  const p = req.path;
  if (
    p.startsWith("/api/payments/stripe/webhook") ||
    p.startsWith("/api/payments/crypto/webhook") ||
    p.startsWith("/uploads") ||
    p.startsWith("/static")
  )
    return next();

  const url = req.originalUrl;
  if (url.length > 1 && url.endsWith("/")) {
    return res.redirect(301, url.slice(0, -1));
  }

  next();
});

app.use(helmet());

app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  })
);

app.use(morgan("dev"));

app.use(gzipCompression);
app.use(seoHeaders());

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/static", express.static(path.join(__dirname, "..", "static")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/uploads", uploadRoutes);

app.use("/api/chat", chatRoutes);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/medical", medicalRoutes);
app.use("/api/payments/crypto", cryptoPaymentRoutes);

app.use("/", seoRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  iniciarScheduler();
  console.log("🤖 Sistema de recordatorios automáticos activado\n");
});
