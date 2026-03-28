import { FlashDeck } from "../models/FlashDeck.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
import { SavedQuestion } from "../models/SavedQuestion.js";
import { User } from "../models/User.js";
import { extractSourceContent, getExtractionJobStatus } from "../services/contentExtractionService.js";
import { buildProfileSummary } from "../services/gamificationService.js";
import { evaluateQuizAttempt } from "../services/quizEvaluationService.js";
import { generateFlashcards, generateQuizSession } from "../services/quizGenerationService.js";
import { toClientDoc } from "../utils/text.js";
import { AppError } from "../utils/AppError.js";

export async function extractContent(req, res) {
  const payload = await extractSourceContent({
    file: req.file,
    text: req.body?.text,
    url: req.body?.url
  });
  res.json(payload);
}

export async function extractionStatus(req, res) {
  res.json(getExtractionJobStatus(String(req.query?.extractionId || "").trim()));
}

export async function generateQuiz(req, res) {
  const payload = await generateQuizSession({
    userId: req.user?._id || null,
    topic: req.body?.topic || "",
    text: req.body?.text || "",
    difficulty: req.body?.difficulty || "moderate",
    learnerMode: req.body?.learnerMode || "student",
    questionMode: req.body?.questionMode || "mcq",
    outputLanguage: req.body?.outputLanguage || "English",
    extractionId: req.body?.extractionId || "",
    preferFull: Boolean(req.body?.preferFull),
    sourceType: req.body?.sourceType || (req.body?.topic ? "topic" : "text"),
    sourceInput: req.body?.sourceInput || req.body?.topic || "",
    questionCount: req.body?.questionCount || 5
  });
  res.json(payload);
}

export async function submitQuiz(req, res) {
  if (!req.body?.quizId) throw new AppError("quizId is required", 400);

  const result = await evaluateQuizAttempt({
    user: req.user,
    quizId: req.body.quizId,
    answers: Array.isArray(req.body?.answers) ? req.body.answers : [],
    sourceType: req.body?.sourceType || "text",
    sourceInput: req.body?.sourceInput || "",
    settings: req.body?.settings || {}
  });

  res.status(201).json({
    attempt: toClientDoc(result.attempt.toObject()),
    evaluation: result.evaluation,
    gamification: {
      ...result.gamification.rewards,
      currentStreak: result.gamification.updatedStats.currentStreak,
      bestStreak: result.gamification.updatedStats.bestStreak,
      totalPoints: result.gamification.updatedStats.totalPoints,
      totalXp: result.gamification.updatedStats.totalXp,
      leaderboardScore: result.gamification.updatedStats.leaderboardScore,
      achievements: result.gamification.updatedStats.achievements,
      unlockedAchievements: result.gamification.unlockedAchievements
    }
  });
}

export async function generateFlashcardsController(req, res) {
  res.json(await generateFlashcards({
    topic: req.body?.topic || "",
    text: req.body?.text || "",
    difficulty: req.body?.difficulty || "moderate",
    learnerMode: req.body?.learnerMode || "student",
    outputLanguage: req.body?.outputLanguage || "English"
  }));
}

export async function bootstrapUserData(req, res) {
  const [attempts, savedQuestions, flashDecks, leaderboard] = await Promise.all([
    QuizAttempt.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean(),
    SavedQuestion.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean(),
    FlashDeck.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
    User.find().sort({ "stats.leaderboardScore": -1, "stats.totalXp": -1, createdAt: 1 }).limit(10).select("name email stats").lean()
  ]);

  res.json({
    attempts: attempts.map(toClientDoc),
    savedQuestions: savedQuestions.map(toClientDoc),
    flashDecks: flashDecks.map(toClientDoc),
    profile: buildProfileSummary(req.user),
    leaderboard: leaderboard.map((item, index) => ({
      rank: index + 1,
      name: item.name,
      email: item.email,
      totalPoints: Number(item.stats?.totalPoints || 0),
      totalXp: Number(item.stats?.totalXp || 0),
      currentStreak: Number(item.stats?.currentStreak || 0),
      bestStreak: Number(item.stats?.bestStreak || 0),
      leaderboardScore: Number(item.stats?.leaderboardScore || 0)
    }))
  });
}

export async function createSavedQuestion(req, res) {
  const question = String(req.body?.question || "").trim();
  if (!question) throw new AppError("Question is required", 400);

  const doc = await SavedQuestion.findOneAndUpdate(
    { user: req.user._id, question, correct: String(req.body?.correct || "").trim() },
    {
      $setOnInsert: {
        user: req.user._id,
        question,
        correct: String(req.body?.correct || "").trim(),
        explanation: String(req.body?.explanation || "").trim(),
        image: req.body?.image || null
      }
    },
    { upsert: true, new: true }
  ).lean();

  res.status(201).json({ savedQuestion: toClientDoc(doc) });
}

export async function createFlashDeck(req, res) {
  const cards = Array.isArray(req.body?.flashcards) ? req.body.flashcards : [];
  if (!cards.length) throw new AppError("Flashcards are required", 400);

  const doc = await FlashDeck.create({
    user: req.user._id,
    title: String(req.body?.title || "Study Deck").slice(0, 120),
    sourceType: String(req.body?.sourceType || "text"),
    flashcards: cards
  });

  res.status(201).json({ flashDeck: toClientDoc(doc.toObject()) });
}

export async function clearAttempts(req, res) {
  await QuizAttempt.deleteMany({ user: req.user._id });
  req.user.stats = {
    ...req.user.stats,
    totalQuizzes: 0,
    totalQuestions: 0,
    totalCorrectAnswers: 0,
    totalPoints: 0,
    totalXp: 0,
    leaderboardScore: 0,
    currentStreak: 0,
    bestStreak: 0,
    bestPercentage: 0,
    achievements: []
  };
  await req.user.save();
  res.json({ message: "Attempts cleared" });
}
