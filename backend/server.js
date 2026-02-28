import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import multer from "multer";
import pdfParse from "pdf-parse";
import * as cheerio from "cheerio";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

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


app.post("/extract-content", upload.single("pdf"), async (req, res) => {
  try {
    let sourceType = "";
    let extractedText = "";

    if (req.file) {
      sourceType = "pdf";
      const isPdfMime = req.file.mimetype === "application/pdf";
      const isPdfName = (req.file.originalname || "").toLowerCase().endsWith(".pdf");
      if (!isPdfMime && !isPdfName) {
        return res.status(400).json({ error: "Only PDF files are allowed" });
      }
      const parsedPdf = await pdfParse(req.file.buffer);
      extractedText = cleanExtractedText(parsedPdf.text);
    } else if (req.body?.url) {
      sourceType = "url";
      extractedText = await extractFromUrl(req.body.url);
    } else if (req.body?.text) {
      sourceType = "text";
      extractedText = cleanExtractedText(req.body.text);
    } else {
      return res.status(400).json({ error: "Provide pdf, url, or text" });
    }

    if (!extractedText || extractedText.length < 20) {
      return res.status(400).json({
        error: "Not enough extractable text. Provide richer content."
      });
    }

    const maxChars = 20000;
    const truncated = extractedText.length > maxChars;
    const text = truncated ? extractedText.slice(0, maxChars) : extractedText;

    return res.json({
      sourceType,
      chars: text.length,
      truncated,
      text
    });
  } catch (error) {
    const isTimeout = error?.name === "AbortError";
    return res.status(500).json({
      error: isTimeout ? "URL request timed out" : error.message || "Extraction failed"
    });
  }
});

app.post("/generate-quiz", async (req, res) => {
  const { text, topic } = req.body;

  if (!text && !topic) {
    return res.status(400).json({ error: "Text or topic is required" });
  }
  if (!groq) {
    return res.status(500).json({
      error: "GROQ_API_KEY is not configured on the server"
    });
  }

  const variation = Math.floor(Math.random() * 100000);

  let prompt = "";

prompt = `
Generate exactly 10 multiple-choice questions in JSON format.

Return ONLY valid JSON. No extra text.

Format:
{
  "questions": [
    {
      "question": "Clear and factually accurate question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": "A",
      "explanation": "2–3 sentence clear explanation justifying why this option is correct",
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
- Do NOT guess facts
- If unsure about accuracy, choose a safer factual question

- Generate a DIFFERENT set of questions every time.
- Avoid repeating previously common questions.
- Be creative and vary phrasing.

Variation ID: ${variation}
- Image rules:
  - Image URL must start with https://upload.wikimedia.org/
  - Image URL must end with .jpg or .png
  - If no valid image exists, return null

Topic: "${topic || "hard"}"
Content: ${text || "Use general knowledge"}
`;



  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",   //  change ONLY this if needed
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9
    });

const rawOutput = completion.choices[0].message.content;

try {
  const firstBrace = rawOutput.indexOf("{");
  const lastBrace = rawOutput.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON found");
  }

  const jsonString = rawOutput.slice(firstBrace, lastBrace + 1);
  const parsedOutput = JSON.parse(jsonString);

  res.json(parsedOutput);
} catch (err) {
  console.error("JSON Parse Error:", rawOutput);
  res.status(500).json({
    error: "AI returned invalid JSON"
  });
}


  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
