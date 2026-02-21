import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import multer from "multer";
import pdfParse from "pdf-parse";
import * as cheerio from "cheerio";

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

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});


app.post("/extract-content", upload.single("pdf"), async (req, res) => {
  try {
    let sourceType = "";
    let extractedText = "";

    if (req.file) {
      sourceType = "pdf";
      if (req.file.mimetype !== "application/pdf") {
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

    if (!extractedText || extractedText.length < 50) {
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
