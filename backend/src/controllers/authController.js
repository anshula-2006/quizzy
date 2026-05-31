import bcrypt from "bcryptjs";
import { FlashDeck } from "../models/FlashDeck.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
import { SavedQuestion } from "../models/SavedQuestion.js";
import { User } from "../models/User.js";
import { signAuthToken } from "../middleware/auth.js";
import { AppError } from "../utils/AppError.js";

function buildAuthPayload(user) {
  return {
    token: signAuthToken(user),
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email || "",
      parentPhone: user.parentPhone || "",
      userId: user.userId || "",
      userType: user.userType || "student",
      grade: user.grade || "",
      stats: user.stats || {}
    }
  };
}

function cleanUserType(value) {
  const userType = String(value || "student").trim();
  return ["student", "teacher", "self_learner"].includes(userType) ? userType : "student";
}

export async function register(req, res) {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const parentPhone = String(req.body?.parentPhone || req.body?.phone || "").replace(/[^\d+]/g, "").trim();
  const userId = String(req.body?.userId || "").trim();
  const password = String(req.body?.password || "").trim();
  const userType = cleanUserType(req.body?.userType);
  const grade = String(req.body?.grade || "").trim().slice(0, 80);

  if (!name || !password) throw new AppError("Name and password are required", 400);
  if (!email && !parentPhone && !userId) throw new AppError("Enter at least one login identifier: email, parent phone number, or roll number", 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("Enter a valid email address", 400);
  if (parentPhone && parentPhone.length < 10) throw new AppError("Enter a valid parent phone number", 400);
  if (userId && userId.length < 2) throw new AppError("Unique ID must be at least 2 characters", 400);
  if (name.length < 2 || name.length > 80) throw new AppError("Name must be between 2 and 80 characters", 400);
  if (password.length < 6) throw new AppError("Password must be at least 6 characters", 400);

  const checks = [];
  if (email) checks.push({ email });
  if (parentPhone) checks.push({ parentPhone });
  if (userId) checks.push({ userId });
  const existingUser = checks.length ? await User.findOne({ $or: checks }) : null;
  if (existingUser) throw new AppError("Account identifier already registered", 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const payload = { name, passwordHash, userType, grade };
  if (email) payload.email = email;
  if (parentPhone) payload.parentPhone = parentPhone;
  if (userId) payload.userId = userId;
  const user = await User.create(payload);
  res.status(201).json(buildAuthPayload(user));
}

export async function login(req, res) {
  const identifier = String(req.body?.identifier || req.body?.email || req.body?.phone || req.body?.userId || "").trim();
  const email = identifier.toLowerCase();
  const phone = identifier.replace(/[^\d+]/g, "").trim();
  const password = String(req.body?.password || "").trim();

  if (!identifier || !password) throw new AppError("Login ID and password are required", 400);

  const query = {
    $or: [
      { email },
      { parentPhone: phone || identifier },
      { userId: identifier }
    ]
  };
  const user = await User.findOne(query);
  if (!user) throw new AppError("Invalid login ID or password", 401);

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new AppError("Invalid login ID or password", 401);

  res.json(buildAuthPayload(user));
}

export async function me(req, res) {
  res.json({
    user: {
      id: req.user._id.toString(),
      name: req.user.name,
      email: req.user.email || "",
      parentPhone: req.user.parentPhone || "",
      userId: req.user.userId || "",
      userType: req.user.userType || "student",
      grade: req.user.grade || "",
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

export async function deleteAccount(req, res) {
  const confirmation = String(req.body?.confirmation || "").trim().toUpperCase();
  const password = String(req.body?.password || "").trim();

  if (confirmation !== "DELETE") {
    throw new AppError('Type "DELETE" to confirm account deletion', 400);
  }

  if (!password) {
    throw new AppError("Password is required to delete your account", 400);
  }

  const isMatch = await bcrypt.compare(password, req.user.passwordHash);
  if (!isMatch) {
    throw new AppError("Password is incorrect", 401);
  }

  await Promise.all([
    QuizAttempt.deleteMany({ user: req.user._id }),
    SavedQuestion.deleteMany({ user: req.user._id }),
    FlashDeck.deleteMany({ user: req.user._id })
  ]);

  await User.deleteOne({ _id: req.user._id });

  res.json({ message: "Account deleted successfully" });
}
