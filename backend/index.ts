import "dotenv/config";
import cors from "cors";
import express, { Request, Response } from "express";
import http from "http";
import passport from "passport";
import { initializeDatabase } from "./src/database/connection";
import authRoutes from "./src/routes/auth.routes";
import supportRoutes from "./src/routes/support.routes";
import { initSupportRealtime } from "./src/services/supportRealtime.service";

const app = express();
const server = http.createServer(app);
app.disable("x-powered-by");
app.use(cors({ origin: process.env.FRONTEND_URL?.split(",").map((value) => value.trim()) || true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

require("./src/utils/passport");
app.use(passport.initialize());
app.use("/api/auth", authRoutes);
app.use("/api/support", supportRoutes);
app.get("/health", (_req: Request, res: Response) => {
  res.json({ success: true, service: "support-chat", database: "single", timestamp: new Date().toISOString() });
});

const port = Number(process.env.PORT || 3500);
async function start() {
  await initializeDatabase();
  initSupportRealtime(server);
  server.listen(port, () => console.log(`Support chat API listening on port ${port}`));
}
start().catch((error) => {
  console.error("Unable to start support chat API", error);
  process.exit(1);
});
