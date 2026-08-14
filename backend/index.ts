import cors from "cors";
import express, { Request, Response } from "express";
import http from "http";
import { initializeAllConnections, TypeORMService } from "./src/database/connection";
//import startSchedulers from "./src/scheduler/startSchedulers";
import { tenantContextMiddleware } from "./src/middleware/tenantContext.middleware";
import passport from "passport";
import { initSupportRealtime } from "./src/services/supportRealtime.service";

const app = express();
console.log("index.ts loaded");

app.use(cors());

app.use(express.json({ limit: '50mb' }));

app.use(express.urlencoded({limit: '50mb', extended: true }));

// passport strategies will be initialized after TypeORM is ready (see startServer)
export const withTenantContext = () => [
  passport.authenticate("jwt", { session: false }),
  tenantContextMiddleware,
];

import constants from "./src/helpers/constants";
import authRoutes from "./src/routes/auth.routes";
import fileRoutes from "./src/routes/files.routes";
import logRoutes from "./src/routes/notification.routes";
import secRoutes from "./src/routes/secuity.routes";
import editLangrouter from "./src/routes/user/user.routes";

import supportRoutes from "./src/routes/support.routes";

//----------------routes-------------

app.use("/api/files", fileRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/security", secRoutes);

app.use("/api/notification", logRoutes);

// app.use("/api/attendance", attendanceRoutes);

app.use("/api/user", editLangrouter);

app.use("/api/support", supportRoutes);

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Tenant Status Diagnostic Endpoint
app.get("/api/diagnostics/tenants", (req: Request, res: Response) => {
  const { TenantManager } = require("./src/database/TenantManager");
  const registeredTenants = TenantManager.getTenants();
  
  res.status(200).json({
    success: true,
    message: "Tenant Status",
    registered_tenants: registeredTenants,
    total_registered: registeredTenants.length,
    note: "Check server logs for connection attempts and failures",
    timestamp: new Date().toISOString(),
  });
});

// Database Status Endpoint
app.get("/api/diagnostics/database", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Database Status",
    connections: {
      central: "CUSTOMERS schema (Active)",
      tenants: "Check /api/diagnostics/tenants"
    },
    connection_string: process.env.MYSQL_CONNECTION_STRING || process.env.DATABASE_URL || `${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || 3306}`,
    note: "Single-tenant MySQL connection; tenant schemas removed",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3500;
const server = http.createServer(app);

async function startServer() {
  try {
    console.log("Starting server...");
    console.log("Initializing database connections...");
    await initializeAllConnections();
    // await AttendanceEventScheduler.initializeScheduler();
    console.log(" All database connections initialized");

    console.log("Initializing TypeORM service...");
    await TypeORMService.initialize();
    console.log("TypeORM initialized successfully");

    try {
      console.log("Initializing passport strategies...");
      require("./src/utils/passport");
      app.use(passport.initialize());
      console.log("Passport initialized");
    } catch (err) {
      console.error("Failed to initialize passport strategies:", err);
      throw err;
    }
    try {
      // Start background schedulers (email sender, attendance, etc.)
      //await startSchedulers();
    } catch (schedErr) {
      console.error("Failed to start schedulers:", schedErr);
      // Non-fatal: continue running server even if schedulers fail
    }
    console.log(`Listening on port ${PORT}...`);
    initSupportRealtime(server);
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log("Health check: http://localhost:" + PORT + "/health");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer().catch(err => {
  console.error("Uncaught error in startServer:", err);
  process.exit(1);
});
