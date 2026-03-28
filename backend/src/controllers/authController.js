import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { signAuthToken } from "../middleware/auth.js";
import { AppError } from "../utils/AppError.js";

function buildAuthPayload(user) {
  return {
    token: signAuthToken(user),
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      stats: user.stats || {}
    }
  };
}

export async function register(req, res) {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "").trim();

  if (!name || !email || !password) throw new AppError("Name, email, and password are required", 400);
  if (password.length < 6) throw new AppError("Password must be at least 6 characters", 400);

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new AppError("Email already registered", 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  res.status(201).json(buildAuthPayload(user));
}

export async function login(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "").trim();

  if (!email || !password) throw new AppError("Email and password are required", 400);

  const user = await User.findOne({ email });
  if (!user) throw new AppError("Invalid email or password", 401);

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new AppError("Invalid email or password", 401);

  res.json(buildAuthPayload(user));
}

export async function me(req, res) {
  res.json({
    user: {
      id: req.user._id.toString(),
      name: req.user.name,
      email: req.user.email,
      stats: req.user.stats || {}
    }
  });
}

export async function changePassword(req, res) {
  const currentPassword = String(req.body?.currentPassword || "").trim();
  const newPassword = String(req.body?.newPassword || "").trim();

  if (!currentPassword || !newPassword) throw new AppError("Current and new password are required", 400);
  if (newPassword.length < 6) throw new AppError("New password must be at least 6 characters", 400);

  const isMatch = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!isMatch) throw new AppError("Current password is incorrect", 401);

  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();

  res.json({
    message: "Password updated",
    ...buildAuthPayload(req.user)
  });
}

export async function logoutAll(req, res) {
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  res.json({ message: "Logged out from all devices" });
}
