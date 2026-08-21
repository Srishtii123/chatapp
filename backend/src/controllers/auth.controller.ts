import { Request, Response, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { AuthService } from "../services/auth.service";

const secret = () => process.env.APP_SECRET || "BAYANAT";
const adminIds = () => new Set((process.env.SUPPORT_ADMIN_LOGINIDS || "ADMIN,BTADMIN,SUPERADMIN").split(",").map((id) => id.trim().toUpperCase()));

function publicUser(user: any) {
  const loginid = String(user.LOGINID || user.loginid || "");
  return {
    loginid,
    username: user.USERNAME || user.username || loginid,
    email_id: user.EMAIL_ID || user.email_id || user.CONTACT_EMAIL || "",
    company_code: user.COMPANY_CODE || user.company_code || "",
    support_role: adminIds().has(loginid.toUpperCase()) ? "ADMIN" : "USER",
  };
}

function signUser(user: any) {
  return jwt.sign(publicUser(user), secret(), { expiresIn: "24h" });
}

function validPassword(password: unknown) {
  return typeof password === "string" && password.length >= 8;
}

export const login: RequestHandler = async (req, res) => {
  try {
    const identifier = String(req.body.email || req.body.identifier || "").trim();
    const password = String(req.body.password || "");
    if (!identifier || !password) return void res.status(400).json({ success: false, message: "Login ID and password are required." });
    const user = await AuthService.findUser(identifier);
    if (!user || !(await AuthService.verifyPassword(password, user))) {
      return void res.status(401).json({ success: false, message: "Invalid login ID or password." });
    }
    res.json({ success: true, data: { token: signUser(user), user: publicUser(user) } });
  } catch (error) {
    console.error("Login failed", error);
    res.status(500).json({ success: false, message: "Unable to sign in." });
  }
};

export const me = async (req: Request, res: Response) => {
  res.json({ success: true, data: { user: req.user, permissionBasedMenuTree: [], permissions: {}, user_permission: {} } });
};

export const forgotPassword: RequestHandler = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim();
    const user = await AuthService.findUser(email);
    if (user && process.env.SMTP_HOST) {
      const token = jwt.sign({ identifier: user.LOGINID, purpose: "PASSWORD_RESET" }, secret(), { expiresIn: "15m" });
      const base = (process.env.FRONTEND_URL || "http://localhost:3101").split(",")[0].replace(/\/$/, "");
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined });
      await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: user.EMAIL_ID || user.CONTACT_EMAIL, subject: "Support chat password reset", text: `Reset your password: ${base}/reset-password?token=${encodeURIComponent(token)}` });
    }
    res.json({ success: true, message: "If the account exists, password reset instructions have been sent." });
  } catch (error) {
    console.error("Forgot-password failed", error);
    res.status(500).json({ success: false, message: "Unable to send password reset instructions." });
  }
};

export const resetPassword: RequestHandler = async (req, res) => {
  try {
    if (!validPassword(req.body.password)) return void res.status(400).json({ success: false, message: "Password must contain at least 8 characters." });
    let identifier = String(req.body.email || "").trim();
    if (req.body.token) {
      const payload = jwt.verify(String(req.body.token), secret()) as any;
      if (payload.purpose !== "PASSWORD_RESET") throw new Error("Invalid reset token");
      identifier = payload.identifier;
    }
    if (!identifier || !(await AuthService.updatePassword(identifier, req.body.password))) return void res.status(400).json({ success: false, message: "Unable to reset password." });
    res.json({ success: true, message: "Password updated successfully." });
  } catch {
    res.status(400).json({ success: false, message: "The password reset link is invalid or expired." });
  }
};

export const changePasswordByEmail = resetPassword;
