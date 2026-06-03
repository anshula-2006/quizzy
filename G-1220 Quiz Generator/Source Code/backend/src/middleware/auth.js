import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email || "",
      parentPhone: user.parentPhone || "",
      userId: user.userId || "",
      name: user.name,
      userType: user.userType || "student",
      tv: user.tokenVersion || 0
    },
    env.jwtSecret,
    { expiresIn: "7d" }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) throw new AppError("Missing auth token", 401);

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).select("name email parentPhone userId userType grade tokenVersion passwordHash stats");
    if (!user) throw new AppError("Invalid auth token", 401);
    if ((payload.tv || 0) !== (user.tokenVersion || 0)) {
      throw new AppError("Session expired. Please log in again.", 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError("Unauthorized", 401));
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return next();

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).select("name email parentPhone userId userType grade tokenVersion passwordHash stats");
    if (!user || (payload.tv || 0) !== (user.tokenVersion || 0)) return next();

    req.user = user;
    return next();
  } catch {
    return next();
  }
}
