import { Router } from "express";
import { Flashcard } from "../models/Flashcard.js";
import { Leaderboard } from "../models/Leaderboard.js";
import { QuizHistory } from "../models/QuizHistory.js";
import { UserStats } from "../models/UserStats.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function cleanString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cleanScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 ? score : null;
}

router.post("/save-score", requireAuth, asyncHandler(async (req, res) => {
  // Use authenticated user identity to prevent impersonation
  const username = String(req.user?.email || req.user?.name || "guest").trim().slice(0, 80);
  const score = cleanScore(req.body.score);
  if (!username) return res.status(400).json({ error: "username is required" });
  if (score === null) return res.status(400).json({ error: "score must be a non-negative number" });

  const entry = await Leaderboard.create({ username, score });
  const stats = await UserStats.findOneAndUpdate(
    { username },
    { $inc: { totalScore: score, totalQuizzes: 1 }, $set: { streak: Number(req.body.streak || 0) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  stats.accuracy = stats.totalQuizzes ? Math.round(stats.totalScore / stats.totalQuizzes) : 0;
  await stats.save();

  return res.status(201).json({ ok: true, entry, stats });
}));

router.get("/leaderboard", asyncHandler(async (req, res) => {
  const rows = await Leaderboard.aggregate([
    { $sort: { score: -1, createdAt: 1 } },
    {
      $group: {
        _id: "$username",
        username: { $first: "$username" },
        score: { $max: "$score" },
        createdAt: { $first: "$createdAt" }
      }
    },
    { $sort: { score: -1, createdAt: 1 } },
    { $limit: 50 }
  ]);

  return res.json(rows.map((row, index) => ({
    rank: index + 1,
    username: row.username,
    name: row.username,
    score: row.score,
    leaderboardScore: row.score,
    totalXp: row.score,
    currentStreak: 0,
    createdAt: row.createdAt
  })));
}));

router.post("/save-stats", requireAuth, asyncHandler(async (req, res) => {
  const username = String(req.user?.email || req.user?.name || "guest").trim().slice(0, 80);
  if (!username) return res.status(400).json({ error: "username is required" });

  const payload = {
    totalScore: cleanScore(req.body.totalScore) ?? 0,
    totalQuizzes: cleanScore(req.body.totalQuizzes) ?? 0,
    streak: cleanScore(req.body.streak) ?? 0,
    accuracy: Math.min(100, cleanScore(req.body.accuracy) ?? 0)
  };

  const stats = await UserStats.findOneAndUpdate(
    { username },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.json({ ok: true, stats });
}));

router.get("/stats/:username", requireAuth, asyncHandler(async (req, res) => {
  // Always return stats for the authenticated user only
  const username = String(req.user?.email || req.user?.name || "guest").trim().slice(0, 80);
  const stats = await UserStats.findOne({ username }).lean();
  return res.json(stats || { username, totalScore: 0, totalQuizzes: 0, streak: 0, accuracy: 0 });
}));

router.post("/save-quiz", requireAuth, asyncHandler(async (req, res) => {
  const username = String(req.user?.email || req.user?.name || "guest").trim().slice(0, 80);
  const score = cleanScore(req.body.score);
  if (!username) return res.status(400).json({ error: "username is required" });
  if (score === null) return res.status(400).json({ error: "score must be a non-negative number" });

  const item = await QuizHistory.create({
    username,
    quizTitle: cleanString(req.body.quizTitle, "Quiz").slice(0, 140),
    score,
    date: req.body.date ? new Date(req.body.date) : new Date()
  });

  return res.status(201).json({ ok: true, quiz: item });
}));

router.get("/quiz-history/:username", requireAuth, asyncHandler(async (req, res) => {
  // Return history only for authenticated user
  const username = String(req.user?.email || req.user?.name || "guest").trim().slice(0, 80);
  const items = await QuizHistory.find({ username }).sort({ date: -1 }).limit(100).lean();
  return res.json(items);
}));

router.post("/flashcards", requireAuth, asyncHandler(async (req, res) => {
  const username = String(req.user?.email || req.user?.name || "guest").trim().slice(0, 80);
  if (!username) return res.status(400).json({ error: "username is required" });

  const cards = Array.isArray(req.body.flashcards)
    ? req.body.flashcards
    : [{ question: req.body.question, answer: req.body.answer }];

  const docs = cards
    .map((card) => ({
      username,
      question: cleanString(card.question || card.front || card.prompt).slice(0, 2000),
      answer: cleanString(card.answer || card.back || card.response).slice(0, 4000)
    }))
    .filter((card) => card.question && card.answer);

  if (!docs.length) return res.status(400).json({ error: "at least one flashcard question and answer is required" });
  const saved = await Flashcard.insertMany(docs.map(d => ({ ...d, username })));
  return res.status(201).json({ ok: true, flashcards: saved });
}));

router.get("/flashcards/:username", requireAuth, asyncHandler(async (req, res) => {
  // Return flashcards only for authenticated user
  const username = String(req.user?.email || req.user?.name || "guest").trim().slice(0, 80);
  const items = await Flashcard.find({ username }).sort({ createdAt: -1 }).limit(200).lean();
  return res.json(items);
}));

router.delete("/reset/:username", requireAuth, asyncHandler(async (req, res) => {
  // Reset only the authenticated user's data regardless of supplied username
  const username = String(req.user?.email || req.user?.name || "guest").trim().slice(0, 80);
  await Promise.all([
    UserStats.deleteOne({ username }),
    Leaderboard.deleteMany({ username }),
    QuizHistory.deleteMany({ username }),
    Flashcard.deleteMany({ username })
  ]);
  return res.json({ ok: true });
}));

export default router;
