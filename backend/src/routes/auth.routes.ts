import * as express from "express";
import passport from "passport";
import {
  login,
  me,
  resetPassword,
  forgotPassword,
  changePasswordByEmail,
} from "../controllers/auth.controller";

// Create a new Express router
const router = express.Router();

router.post("/login", login);
router.post("/forgotPassword", forgotPassword);
router.post("/change-password", changePasswordByEmail);
router.post("/resetPassword", resetPassword);


router.get("/me", 
  passport.authenticate("jwt", { session: false }), 
  me
);

// Export the router
export default router;
