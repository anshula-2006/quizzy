import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import multer from "multer";
import pdfParse from "pdf-parse";
import * as cheerio from "cheerio";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { createHash } from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

dotenv.config({ path: new URL("./.env", import.meta.url) });

const app = express();
const backendDir = fileURLToPath(new URL(".", import.meta.url));
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const MAX_PDF_UPLOAD_BYTES = 100 * 1024 * 1024;
const FAST_PDF_PARSE_MAX_PAGES = 12;
const FAST_EXTRACT_MAX_CHARS = 8000;
const FULL_EXTRACT_MAX_CHARS = 20000;
const PDF_PYTHON_BIN = process.env.PDF_PYTHON_BIN || "python";
const PDF_PYTHON_TIMEOUT_MS = Number(process.env.PDF_PYTHON_TIMEOUT_MS || 12000);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_UPLOAD_BYTES }
});
const EXTRACTION_CACHE_TTL_MS = 10 * 60 * 1000;
const extractionCache = new Map();
const pdfFullExtractionJobs = new Map();
const FULL_PDF_EXTRACTION_DELAY_MS = 2000;

function hashText(value) {
  const hasher = createHash("sha256");
  if (Buffer.isBuffer(value)) hasher.update(value);
  else hasher.update(String(value || ""));
  return hasher.digest("hex");
}

function getCachedExtraction(key) {
  const cached = extractionCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    extractionCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedExtraction(key, value) {
  extractionCache.set(key, {
    value,
    expiresAt: Date.now() + EXTRACTION_CACHE_TTL_MS
  });
}

function getPdfJob(extractionId) {
  const job = pdfFullExtractionJobs.get(extractionId);
  if (!job) return null;
  if (Date.now() > job.expiresAt) {
    pdfFullExtractionJobs.delete(extractionId);
    return null;
  }
  return job;
}

function upsertPdfJob(extractionId, patch) {
  const prev = getPdfJob(extractionId) || {};
  const next = {
    extractionId,
    fullReady: false,
    fullText: "",
    parsing: false,
    error: null,
    expiresAt: Date.now() + EXTRACTION_CACHE_TTL_MS,
    ...prev,
    ...patch
  };
  pdfFullExtractionJobs.set(extractionId, next);
  return next;
}

function scheduleFullPdfExtraction(extractionId, buffer) {
  const existing = getPdfJob(extractionId);
  if (existing?.parsing || existing?.fullReady || existing?.scheduled) return;
  upsertPdfJob(extractionId, { scheduled: true, parsing: false, error: null });
  setTimeout(() => {
    startFullPdfExtraction(extractionId, buffer);
  }, FULL_PDF_EXTRACTION_DELAY_MS);
}

function startFullPdfExtraction(extractionId, buffer) {
  const existing = getPdfJob(extractionId);
  if (existing?.parsing || existing?.fullReady) return;
  upsertPdfJob(extractionId, { scheduled: false, parsing: true, error: null });

  (async () => {
    const startedAt = Date.now();
    try {
      const parsed = await extractPdfText(buffer, { allowFallback: true });
      const clean = cleanExtractedText(parsed.text);
      const text = clean.length > FULL_EXTRACT_MAX_CHARS ? clean.slice(0, FULL_EXTRACT_MAX_CHARS) : clean;
      upsertPdfJob(extractionId, { fullReady: true, fullText: text, parsing: false, error: null });
      console.log(
        `[extract-content/full] ready extractionId=${extractionId} chars=${text.length} engine=${parsed.engine} totalMs=${Date.now() - startedAt}`
      );
    } catch (error) {
      upsertPdfJob(extractionId, { fullReady: false, fullText: "", parsing: false, error: error.message || "Full extraction failed" });
      console.log(`[extract-content/full] failed extractionId=${extractionId} totalMs=${Date.now() - startedAt} error=${error?.message || "unknown"}`);
    }
  })();
}

function isBlockedHostname(hostname) {
  const host = (hostname || "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) return true;
  if (host === "0.0.0.0" || host.startsWith("127.")) return true;
  if (host.startsWith("10.") || host.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function cleanExtractedText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

async function extractPdfTextWithPython(buffer, { maxPages } = {}) {
  return await new Promise((resolve, reject) => {
    const args = ["pdf_service.py"];
    if (Number.isFinite(maxPages) && maxPages > 0) {
      args.push(String(Math.floor(maxPages)));
    }

    const child = spawn(PDF_PYTHON_BIN, args, {
      cwd: backendDir,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn(value);
    };

    const timeout = setTimeout(() => {
      child.kill();
      finish(reject, new Error(`Python PDF extraction timed out after ${PDF_PYTHON_TIMEOUT_MS}ms`));
    }, PDF_PYTHON_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      finish(reject, error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        finish(reject, new Error(stderr.trim() || `Python PDF extraction exited with code ${code}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout || "{}");
        finish(resolve, {
          text: cleanExtractedText(parsed.text),
          engine: parsed.engine || "python"
        });
      } catch (error) {
        finish(reject, new Error(`Invalid Python PDF response: ${error.message}`));
      }
    });

    child.stdin.write(buffer);
    child.stdin.end();
  });
}

async function extractPdfText(buffer, { maxPages, allowFallback = true } = {}) {
  try {
    const result = await extractPdfTextWithPython(buffer, { maxPages });
    return {
      text: result.text,
      engine: result.engine
    };
  } catch (error) {
    if (!allowFallback) throw error;
    const parsed = Number.isFinite(maxPages) && maxPages > 0
      ? await pdfParse(buffer, { max: Math.floor(maxPages) })
      : await pdfParse(buffer);
    return {
      text: cleanExtractedText(parsed.text),
      engine: "pdf-parse"
    };
  }
}

function normalizeQuestionType(type) {
  return String(type || "").trim().toLowerCase() === "short" ? "short" : "mcq";
}

function normalizeMcqCorrect(correct, options) {
  const fallback = "A";
  const normalizedOptions = Array.isArray(options) ? options.slice(0, 4).map((opt) => String(opt || "").trim()).filter(Boolean) : [];
  const raw = String(correct || "").trim();
  const letter = raw.charAt(0).toUpperCase();
  if (["A", "B", "C", "D"].includes(letter)) return letter;
  const optionIndex = normalizedOptions.findIndex((opt) => opt.toLowerCase() === raw.toLowerCase());
  if (optionIndex >= 0) return ["A", "B", "C", "D"][optionIndex];
  return fallback;
}

function sanitizeGeneratedQuestions(rawQuestions, questionMode, questionCount) {
  const mode = ["mcq", "short", "mixed"].includes(questionMode) ? questionMode : "mcq";
  const questions = Array.isArray(rawQuestions) ? rawQuestions : [];

  const sanitized = questions
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const question = String(item.question || "").trim();
      if (!question) return null;
      const base = {
        question,
        explanation: String(item.explanation || "").trim(),
        wrongExplanation: item.wrongExplanation ? String(item.wrongExplanation).trim() : null,
        image: item.image || null
      };
      const rawType = normalizeQuestionType(item.type);

      if (mode === "short") {
        const shortAnswer = String(item.shortAnswer || item.correct || "").trim();
        if (!shortAnswer) return null;
        return {
          ...base,
          type: "short",
          correct: shortAnswer,
          shortAnswer,
          acceptableAnswers: Array.isArray(item.acceptableAnswers)
            ? item.acceptableAnswers.map((answer) => String(answer || "").trim()).filter(Boolean)
            : []
        };
      }

      if (mode === "mcq" && rawType !== "mcq") return null;

      const options = Array.isArray(item.options)
        ? item.options.map((opt) => String(opt || "").trim()).filter(Boolean).slice(0, 4)
        : [];
      if (options.length < 2) {
        if (mode === "mixed" && rawType === "short") {
          const shortAnswer = String(item.shortAnswer || item.correct || "").trim();
          if (!shortAnswer) return null;
          return {
            ...base,
            type: "short",
            correct: shortAnswer,
            shortAnswer,
            acceptableAnswers: Array.isArray(item.acceptableAnswers)
              ? item.acceptableAnswers.map((answer) => String(answer || "").trim()).filter(Boolean)
              : []
          };
        }
        return null;
      }

      return {
        ...base,
        type: "mcq",
        options,
        correct: normalizeMcqCorrect(item.correct, options),
        shortAnswer: null,
        acceptableAnswers: []
      };
    })
    .filter(Boolean);

  if (mode !== "mixed") {
    return sanitized.slice(0, questionCount);
  }

  const mcqs = sanitized.filter((item) => item.type === "mcq");
  const shorts = sanitized.filter((item) => item.type === "short");
  const targetMcqCount = Math.max(1, Math.round(questionCount * 0.6));
  const targetShortCount = Math.max(1, questionCount - targetMcqCount);
  const result = [
    ...mcqs.slice(0, targetMcqCount),
    ...shorts.slice(0, targetShortCount),
    ...mcqs.slice(targetMcqCount),
    ...shorts.slice(targetShortCount)
  ];
  return result.slice(0, questionCount);
}

function hasStrictModeMismatch(questions, questionMode, questionCount) {
  if (!Array.isArray(questions) || questions.length < questionCount) return true;
  if (questionMode === "mcq") return questions.some((item) => item.type !== "mcq");
  if (questionMode === "short") return questions.some((item) => item.type !== "short");
  return false;
}

function extractTextFromHtml(html) {
  const $ = cheerio.load(html || "");
  $("script, style, noscript, nav, footer, header, form, aside, iframe, svg").remove();
  return cleanExtractedText($("body").text());
}

async function extractFromUrl(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only http/https URLs are allowed");
  }
  if (isBlockedHostname(parsedUrl.hostname)) {
    throw new Error("Private/local URLs are not allowed");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: "follow"
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch URL (${response.status})`);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const body = await response.text();
    if (contentType.includes("text/html")) {
      return extractTextFromHtml(body);
    }
    if (contentType.includes("text/plain")) {
      return cleanExtractedText(body);
    }
    throw new Error("Unsupported URL content-type (only HTML/TXT)");
  } finally {
    clearTimeout(timeout);
  }
}

const groqApiKey = process.env.GROQ_API_KEY || "";
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.warn("MONGODB_URI is not set. Auth routes will not work without MongoDB.");
} else {
  mongoose
    .connect(mongoUri)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err.message));
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceType: { type: String, default: "text" },
    sourceInput: { type: String, default: "" },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    answers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const savedQuestionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    question: { type: String, required: true },
    correct: { type: String, default: "" },
    explanation: { type: String, default: "" },
    image: { type: String, default: null }
  },
  { timestamps: true }
);

savedQuestionSchema.index({ user: 1, question: 1, correct: 1 }, { unique: true });

const flashDeckSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "Study Deck" },
    sourceType: { type: String, default: "text" },
    flashcards: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model("QuizAttempt", quizAttemptSchema);
const SavedQuestion = mongoose.models.SavedQuestion || mongoose.model("SavedQuestion", savedQuestionSchema);
const FlashDeck = mongoose.models.FlashDeck || mongoose.model("FlashDeck", flashDeckSchema);

function ensureAuthDb(res) {
  if (!mongoUri) {
    res.status(500).json({ error: "Auth DB is not configured" });
    return false;
  }
  return true;
}

function toClientDoc(doc) {
  if (!doc) return null;
  const copy = { ...doc };
  if (copy._id) {
    copy.id = copy._id.toString();
    delete copy._id;
  }
  if (copy.user && typeof copy.user !== "string") {
    copy.user = copy.user.toString();
  }
  return copy;
}

function signAuthToken(user) {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, name: user.name, tv: user.tokenVersion || 0 },
    secret,
    { expiresIn: "7d" }
  );
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const secret = process.env.JWT_SECRET || "dev-secret-change-me";
    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.sub).select("name email tokenVersion passwordHash");
    if (!user) return res.status(401).json({ error: "Invalid auth token" });
    if ((payload.tv || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

app.post("/auth/register", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const email = (req.body?.email || "").trim().toLowerCase();
    const password = (req.body?.password || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (!mongoUri) {
      return res.status(500).json({ error: "Auth DB is not configured" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    const token = signAuthToken(user);

    return res.status(201).json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const password = (req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (!mongoUri) {
      return res.status(500).json({ error: "Auth DB is not configured" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signAuthToken(user);
    return res.json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Login failed" });
  }
});

app.get("/auth/me", requireAuth, async (req, res) => {
  return res.json({
    user: {
      id: req.user._id.toString(),
      name: req.user.name,
      email: req.user.email
    }
  });
});

app.post("/auth/change-password", requireAuth, async (req, res) => {
  try {
    const currentPassword = (req.body?.currentPassword || "").trim();
    const newPassword = (req.body?.newPassword || "").trim();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const isMatch = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    req.user.passwordHash = await bcrypt.hash(newPassword, 10);
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();

    const token = signAuthToken(req.user);
    return res.json({
      message: "Password updated",
      token,
      user: {
        id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to change password" });
  }
});

app.post("/auth/logout-all", requireAuth, async (req, res) => {
  try {
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    return res.json({ message: "Logged out from all devices" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to logout all sessions" });
  }
});

app.get("/data/bootstrap", requireAuth, async (req, res) => {
  try {
    if (!ensureAuthDb(res)) return;
    const userId = req.user._id;
    const [attempts, savedQuestions, flashDecks] = await Promise.all([
      QuizAttempt.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean(),
      SavedQuestion.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean(),
      FlashDeck.find({ user: userId }).sort({ createdAt: -1 }).limit(30).lean()
    ]);
    return res.json({
      attempts: attempts.map(toClientDoc),
      savedQuestions: savedQuestions.map(toClientDoc),
      flashDecks: flashDecks.map(toClientDoc)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch user data" });
  }
});

app.post("/data/attempts", requireAuth, async (req, res) => {
  try {
    if (!ensureAuthDb(res)) return;
    const payload = req.body || {};
    const created = await QuizAttempt.create({
      user: req.user._id,
      sourceType: payload.sourceType || "text",
      sourceInput: payload.sourceInput || "",
      settings: payload.settings || {},
      score: Number(payload.score || 0),
      total: Number(payload.total || 0),
      percentage: Number(payload.percentage || 0),
      answers: Array.isArray(payload.answers) ? payload.answers : [],
      createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date()
    });
    return res.status(201).json({ attempt: toClientDoc(created.toObject()) });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to save attempt" });
  }
});

app.delete("/data/attempts", requireAuth, async (req, res) => {
  try {
    if (!ensureAuthDb(res)) return;
    await QuizAttempt.deleteMany({ user: req.user._id });
    return res.json({ message: "Attempts cleared" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to clear attempts" });
  }
});

app.post("/data/saved-questions", requireAuth, async (req, res) => {
  try {
    if (!ensureAuthDb(res)) return;
    const payload = req.body || {};
    const question = String(payload.question || "").trim();
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }
    const doc = await SavedQuestion.findOneAndUpdate(
      { user: req.user._id, question, correct: String(payload.correct || "").trim() },
      {
        $setOnInsert: {
          user: req.user._id,
          question,
          correct: String(payload.correct || "").trim(),
          explanation: String(payload.explanation || "").trim(),
          image: payload.image || null
        }
      },
      { upsert: true, new: true }
    ).lean();
    return res.status(201).json({ savedQuestion: toClientDoc(doc) });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to save question" });
  }
});

app.post("/data/flash-decks", requireAuth, async (req, res) => {
  try {
    if (!ensureAuthDb(res)) return;
    const payload = req.body || {};
    const cards = Array.isArray(payload.flashcards) ? payload.flashcards : [];
    if (!cards.length) {
      return res.status(400).json({ error: "Flashcards are required" });
    }
    const created = await FlashDeck.create({
      user: req.user._id,
      title: String(payload.title || "Study Deck").slice(0, 120),
      sourceType: String(payload.sourceType || "text"),
      flashcards: cards
    });
    return res.status(201).json({ flashDeck: toClientDoc(created.toObject()) });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to save flash deck" });
  }
});


app.post("/extract-content", upload.single("pdf"), async (req, res) => {
  const startedAt = Date.now();
  try {
    let sourceType = "";
    let extractedText = "";
    let cacheKey = "";
    let extractionId = "";
    let fullReady = true;

    if (req.file) {
      sourceType = "pdf";
      const isPdfMime = req.file.mimetype === "application/pdf";
      const isPdfName = (req.file.originalname || "").toLowerCase().endsWith(".pdf");
      if (!isPdfMime && !isPdfName) {
        return res.status(400).json({ error: "Only PDF files are allowed" });
      }
      extractionId = `pdf:${hashText(req.file.buffer)}`;
      cacheKey = extractionId;
      const job = getPdfJob(extractionId);
      fullReady = Boolean(job?.fullReady && job?.fullText);
      const cached = getCachedExtraction(cacheKey);
      if (cached) {
        scheduleFullPdfExtraction(extractionId, req.file.buffer);
        console.log(`[extract-content] source=pdf cache=hit chars=${cached.text.length} totalMs=${Date.now() - startedAt}`);
        return res.json({
          ...cached,
          extractionId,
          fullReady
        });
      }
      const parsedPdf = await extractPdfText(req.file.buffer, {
        maxPages: FAST_PDF_PARSE_MAX_PAGES,
        allowFallback: true
      });
      extractedText = cleanExtractedText(parsedPdf.text);
      scheduleFullPdfExtraction(extractionId, req.file.buffer);
      fullReady = Boolean(getPdfJob(extractionId)?.fullReady);
      console.log(
        `[extract-content/pdf-fast] extractionId=${extractionId} chars=${extractedText.length} engine=${parsedPdf.engine} totalMs=${Date.now() - startedAt}`
      );
    } else if (req.body?.url) {
      sourceType = "url";
      cacheKey = `url:${hashText(req.body.url)}`;
      extractionId = cacheKey;
      const cached = getCachedExtraction(cacheKey);
      if (cached) {
        console.log(`[extract-content] source=url cache=hit chars=${cached.text.length} totalMs=${Date.now() - startedAt}`);
        return res.json({ ...cached, extractionId, fullReady: true });
      }
      extractedText = await extractFromUrl(req.body.url);
    } else if (req.body?.text) {
      sourceType = "text";
      cacheKey = `text:${hashText(req.body.text)}`;
      extractionId = cacheKey;
      const cached = getCachedExtraction(cacheKey);
      if (cached) {
        console.log(`[extract-content] source=text cache=hit chars=${cached.text.length} totalMs=${Date.now() - startedAt}`);
        return res.json({ ...cached, extractionId, fullReady: true });
      }
      extractedText = cleanExtractedText(req.body.text);
    } else {
      return res.status(400).json({ error: "Provide pdf, url, or text" });
    }

    if (!extractedText || extractedText.length < 20) {
      return res.status(400).json({
        error: "Not enough extractable text. Provide richer content."
      });
    }

    const maxChars = FAST_EXTRACT_MAX_CHARS;
    const truncated = extractedText.length > maxChars;
    const text = truncated ? extractedText.slice(0, maxChars) : extractedText;

    const payload = {
      sourceType,
      chars: text.length,
      truncated,
      text
    };
    if (sourceType === "pdf") {
      payload.fastMode = true;
      payload.maxParsedPages = FAST_PDF_PARSE_MAX_PAGES;
    }
    if (cacheKey) setCachedExtraction(cacheKey, payload);
    console.log(
      `[extract-content] source=${sourceType} cache=miss chars=${text.length} truncated=${truncated} totalMs=${Date.now() - startedAt}`
    );
    return res.json({
      ...payload,
      extractionId: extractionId || cacheKey,
      fullReady
    });
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    console.log(`[extract-content] failed totalMs=${Date.now() - startedAt} error=${error?.message || "unknown"}`);
    return res.status(500).json({
      error: isTimeout ? "URL request timed out" : error.message || "Extraction failed"
    });
  }
});

app.get("/extract-content-status", (req, res) => {
  const extractionId = String(req.query?.extractionId || "").trim();
  if (!extractionId) {
    return res.status(400).json({ error: "extractionId is required" });
  }

  if (!extractionId.startsWith("pdf:")) {
    return res.json({ extractionId, fullReady: true, parsing: false });
  }

  const job = getPdfJob(extractionId);
  return res.json({
    extractionId,
    fullReady: Boolean(job?.fullReady && job?.fullText),
    parsing: Boolean(job?.parsing),
    scheduled: Boolean(job?.scheduled),
    error: job?.error || null
  });
});

app.post("/generate-quiz", async (req, res) => {
  const startedAt = Date.now();
  const { text, topic, difficulty = "moderate", learnerMode = "student", questionMode = "mcq", outputLanguage = "English", extractionId = "", preferFull = false } = req.body;
  const requestedCount = Number(req.body?.questionCount);
  const questionCount = Number.isFinite(requestedCount)
    ? Math.max(1, Math.min(10, Math.floor(requestedCount)))
    : 5;
  let effectiveText = text;

  if (preferFull && extractionId && extractionId.startsWith("pdf:")) {
    const job = getPdfJob(extractionId);
    if (job?.fullReady && job?.fullText) {
      effectiveText = job.fullText;
    }
  }

  if (!effectiveText && !topic) {
    return res.status(400).json({ error: "Text or topic is required" });
  }
  if (!groq) {
    return res.status(500).json({
      error: "GROQ_API_KEY is not configured on the server"
    });
  }

  const variation = Math.floor(Math.random() * 100000);
  const roleGuide =
    learnerMode === "teacher"
      ? "Teacher mode: include misconception-focused prompts, quick justifications that can be used in class, and assessment-style wording suitable for evaluating a group."
      : learnerMode === "self-study"
        ? "Self-study mode: emphasize clarity, memory cues, and practical reinforcement; keep progression confidence-building before increasing challenge."
        : "Student mode: prioritize exam readiness, timed-practice realism, and conceptual traps commonly seen in tests.";

  let prompt = "";
  const strictModeNote =
    questionMode === "mcq"
      ? `Hard requirement: every question.type MUST be "mcq". Return exactly ${questionCount} MCQ questions and zero short-answer questions.`
      : questionMode === "short"
        ? `Hard requirement: every question.type MUST be "short". Return exactly ${questionCount} short-answer questions and zero MCQ questions.`
        : `Hard requirement: return exactly ${questionCount} questions with a real mix of MCQ and short-answer questions.`;

prompt = `
Generate exactly ${questionCount} quiz questions in JSON format.

Return ONLY valid JSON. No extra text.

Format:
{
  "questions": [
    {
      "question": "Clear and factually accurate question",
      "type": "mcq or short",
      "options": ["Option A", "Option B", "Option C", "Option D"], 
      "correct": "A for MCQ, or short factual answer for short type",
      "shortAnswer": "Required for short type, otherwise null",
      "acceptableAnswers": ["Optional synonyms for short type"],
      "explanation": "2-3 sentence clear explanation justifying why this option is correct",
      "wrongExplanation": "1-2 sentence explanation of why a common wrong answer is wrong (or null)",
      "image": "Direct Wikimedia Commons image URL ending with .jpg or .png, or null"
    }
  ]
}

Rules:
- Questions must be FACTUALLY CORRECT
- Verify answers logically before choosing the correct option
- Avoid opinion-based or ambiguous questions
- Explanation must be at least 2 sentences
- Explanation must clearly justify the correct answer
- wrongExplanation should be concise and directly explain the misconception
- Do NOT guess facts
- If unsure about accuracy, choose a safer factual question

- Difficulty level: "${difficulty}".
  - easy: direct recall and basic understanding
  - moderate: application-focused
  - tough: multi-step reasoning
  - super: very hard and tricky but still fair and factual (no sudden-death behavior)

- Learner mode: "${learnerMode}".
  - student: exam style and concept checks
  - teacher: pedagogy, misconceptions, and assessment framing
  - self-study: practical understanding and memory reinforcement
  - Apply this strict learner guide: ${roleGuide}

- Question type mode: "${questionMode}".
  - mcq: all ${questionCount} must be MCQ with 4 options
  - short: all ${questionCount} must be short-answer with shortAnswer populated
  - mixed: keep approximately 60% MCQ and 40% short-answer
  - ${strictModeNote}

- Output language: "${outputLanguage}".
  - Write the question, options, explanations, and short answers in this language.
  - Keep the JSON keys in English exactly as specified.

- Generate a DIFFERENT set of questions every time.
- Avoid repeating previously common questions.
- Be creative and vary phrasing.

Variation ID: ${variation}
- Image rules:
  - Image URL must start with https://upload.wikimedia.org/
  - Image URL must end with .jpg or .png
  - If no valid image exists, return null

Topic: "${topic || "hard"}"
Content: ${effectiveText || "Use general knowledge"}
`;



  try {
    const generateQuestions = async (userPrompt, temperature) => {
      const aiStartedAt = Date.now();
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: userPrompt }],
        temperature
      });
      console.log(`[generate-quiz] aiMs=${Date.now() - aiStartedAt} questionCount=${questionCount} temperature=${temperature}`);

      const rawOutput = completion?.choices?.[0]?.message?.content || "";
      const firstBrace = rawOutput.indexOf("{");
      const lastBrace = rawOutput.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("AI returned invalid JSON");
      }

      const jsonString = rawOutput.slice(firstBrace, lastBrace + 1);
      const parsedOutput = JSON.parse(jsonString);
      return sanitizeGeneratedQuestions(parsedOutput?.questions, questionMode, questionCount);
    };

    let sanitizedQuestions = await generateQuestions(prompt, 0.9);

    if (hasStrictModeMismatch(sanitizedQuestions, questionMode, questionCount)) {
      const retryPrompt = `${prompt}

Previous output did not satisfy the requested question type rules.
Regenerate from scratch and follow the mode exactly.
`;
      sanitizedQuestions = await generateQuestions(retryPrompt, 0.4);
    }

    if (hasStrictModeMismatch(sanitizedQuestions, questionMode, questionCount)) {
      return res.status(502).json({
        error: `Could not generate ${questionCount} valid ${questionMode} questions. Try again.`
      });
    }

    console.log(
      `[generate-quiz] success totalMs=${Date.now() - startedAt} requested=${questionCount} returned=${sanitizedQuestions.length} mode=${questionMode}`
    );
    return res.json({ questions: sanitizedQuestions });
  } catch (error) {
    console.log(`[generate-quiz] failed totalMs=${Date.now() - startedAt} error=${error?.message || "unknown"}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/generate-flashcards", async (req, res) => {
  const { text, topic, difficulty = "moderate", learnerMode = "student", outputLanguage = "English" } = req.body;

  if (!text && !topic) {
    return res.status(400).json({ error: "Text or topic is required" });
  }
  if (!groq) {
    return res.status(500).json({
      error: "GROQ_API_KEY is not configured on the server"
    });
  }

  const prompt = `
Generate exactly 12 study flashcards in JSON.
Return ONLY valid JSON.

Format:
{
  "flashcards": [
    {
      "front": "Question/prompt side",
      "back": "Concise accurate answer",
      "hint": "Memory cue or clue",
      "image": "Direct Wikimedia Commons image URL ending with .jpg or .png, or null"
    }
  ]
}

Rules:
- learnerMode: "${learnerMode}"
- difficulty: "${difficulty}"
- outputLanguage: "${outputLanguage}"
- Keep answers factually accurate and concise.
- Write the flashcard front, back, and hint in "${outputLanguage}".
- Use topic/text content as primary source.
- Include a hint for each card.
- If image is not confidently relevant, use null.

Topic: "${topic || "general"}"
Content: ${text || "Use general knowledge"}
`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const rawOutput = completion?.choices?.[0]?.message?.content || "";
    const firstBrace = rawOutput.indexOf("{");
    const lastBrace = rawOutput.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    const jsonString = rawOutput.slice(firstBrace, lastBrace + 1);
    const parsedOutput = JSON.parse(jsonString);
    return res.json(parsedOutput);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Flashcard generation failed" });
  }
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `PDF is too large. Maximum size is ${Math.floor(MAX_PDF_UPLOAD_BYTES / (1024 * 1024))}MB.`
    });
  }
  return next(err);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
