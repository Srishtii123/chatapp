import express from "express";
import passport from "passport";
import { Request, Response, NextFunction } from "express";
import { isSupportAdminUser } from "../services/supportRealtime.service";
import {
  addSupportMessage,
  assignSupportDeveloper,
  createSupportTicket,
  deleteSupportMessage,
  getSupportAssistantSuggestion,
  getDeveloperSupportTickets,
  getSupportActiveUsers,
  getSupportDevelopers,
  getSupportMessages,
  getSupportTickets,
  markSupportRead,
  saveSupportDeveloper,
  updateDeveloperSupportStatus,
  supportHeartbeat,
  updateSupportTicket,
} from "../controllers/supportChat.controller";

const router = express.Router();
const requireSupportAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!isSupportAdminUser(req.user)) return void res.status(403).json({ success: false, message: "Support administrator access is required." });
  next();
};

router.use(passport.authenticate("jwt", { session: false }));

router.post("/heartbeat", supportHeartbeat);
router.post("/assist/suggest", getSupportAssistantSuggestion);
router.get("/active-users", requireSupportAdmin, getSupportActiveUsers);
router.get("/developers", requireSupportAdmin, getSupportDevelopers);
router.post("/developers", requireSupportAdmin, saveSupportDeveloper);
router.get("/developer/tickets", getDeveloperSupportTickets);
router.get("/tickets", getSupportTickets);
router.post("/tickets", createSupportTicket);
router.get("/tickets/:ticketId/messages", getSupportMessages);
router.post("/tickets/:ticketId/messages", addSupportMessage);
router.delete("/tickets/:ticketId/messages/:messageId", deleteSupportMessage);
router.post("/tickets/:ticketId/assign-developer", requireSupportAdmin, assignSupportDeveloper);
router.patch("/tickets/:ticketId/developer-status", updateDeveloperSupportStatus);
router.patch("/tickets/:ticketId", updateSupportTicket);
router.post("/tickets/:ticketId/read", markSupportRead);

export default router;
