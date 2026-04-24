import { Router } from "express";
import { changePassword, deleteAccount, login, logoutAll, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.post("/change-password", requireAuth, asyncHandler(changePassword));
router.post("/logout-all", requireAuth, asyncHandler(logoutAll));
router.delete("/delete-account", requireAuth, asyncHandler(deleteAccount));

export default router;
