import { Router } from "express";
import { changePassword, deleteAccount, forgotPassword, login, logoutAll, me, register, resetPassword } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", rateLimit({ windowMs: 60_000, max: 10, label: "login" }), asyncHandler(login));
router.post("/forgot-password", rateLimit({ windowMs: 60_000, max: 5, label: "forgot-password" }), asyncHandler(forgotPassword));
router.post("/reset-password", rateLimit({ windowMs: 60_000, max: 5, label: "reset-password" }), asyncHandler(resetPassword));
router.get("/me", requireAuth, asyncHandler(me));
router.post("/change-password", requireAuth, asyncHandler(changePassword));
router.post("/logout-all", requireAuth, asyncHandler(logoutAll));
router.delete("/delete-account", requireAuth, asyncHandler(deleteAccount));

export default router;
