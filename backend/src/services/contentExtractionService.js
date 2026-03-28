import multer from "multer";
import pdfParse from "pdf-parse";
import * as cheerio from "cheerio";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { cleanExtractedText, hashText } from "../utils/text.js";

const backendDir = fileURLToPath(new URL("../../", import.meta.url));
const FAST_PDF_PARSE_MAX_PAGES = 12;
const FAST_EXTRACT_MAX_CHARS = 8000;
const FULL_EXTRACT_MAX_CHARS = 20000;
const EXTRACTION_CACHE_TTL_MS = 10 * 60 * 1000;
const FULL_PDF_EXTRACTION_DELAY_MS = 2000;

const extractionCache = new Map();
const pdfFullExtractionJobs = new Map();

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxPdfUploadBytes }
});

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
  const previous = getPdfJob(extractionId) || {};
  const next = {
    extractionId,
    fullReady: false,
    fullText: "",
    parsing: false,
    scheduled: false,
    error: null,
    expiresAt: Date.now() + EXTRACTION_CACHE_TTL_MS,
    ...previous,
    ...patch
  };
  pdfFullExtractionJobs.set(extractionId, next);
  return next;
}

function isBlockedHostname(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host === "::1" || host.endsWith(".local")) return true;
  if (host === "0.0.0.0" || host.startsWith("127.")) return true;
  if (host.startsWith("10.") || host.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

async function extractPdfTextWithPython(buffer, { maxPages } = {}) {
  return new Promise((resolve, reject) => {
    const args = ["pdf_service.py"];
    if (Number.isFinite(maxPages) && maxPages > 0) {
      args.push(String(Math.floor(maxPages)));
    }

    const child = spawn(env.pdfPythonBin, args, {
      cwd: backendDir,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };

    const timeout = setTimeout(() => {
      child.kill();
      finish(reject, new Error(`Python PDF extraction timed out after ${env.pdfPythonTimeoutMs}ms`));
    }, env.pdfPythonTimeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => finish(reject, error));
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
    return await extractPdfTextWithPython(buffer, { maxPages });
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

function scheduleFullPdfExtraction(extractionId, buffer) {
  const existing = getPdfJob(extractionId);
  if (existing?.parsing || existing?.fullReady || existing?.scheduled) return;

  upsertPdfJob(extractionId, { scheduled: true, error: null });

  setTimeout(async () => {
    const job = getPdfJob(extractionId);
    if (job?.parsing || job?.fullReady) return;

    upsertPdfJob(extractionId, { parsing: true, scheduled: false, error: null });
    try {
      const parsed = await extractPdfText(buffer, { allowFallback: true });
      const text = cleanExtractedText(parsed.text).slice(0, FULL_EXTRACT_MAX_CHARS);
      upsertPdfJob(extractionId, { fullReady: true, fullText: text, parsing: false });
    } catch (error) {
      upsertPdfJob(extractionId, { parsing: false, error: error.message || "Full extraction failed" });
    }
  }, FULL_PDF_EXTRACTION_DELAY_MS);
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
    throw new AppError("Invalid URL format", 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new AppError("Only http/https URLs are allowed", 400);
  }

  if (isBlockedHostname(parsedUrl.hostname)) {
    throw new AppError("Private/local URLs are not allowed", 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: "follow"
    });

    if (!response.ok) {
      throw new AppError(`Failed to fetch URL (${response.status})`, 400);
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const body = await response.text();
    if (contentType.includes("text/html")) return extractTextFromHtml(body);
    if (contentType.includes("text/plain")) return cleanExtractedText(body);
    throw new AppError("Unsupported URL content-type (only HTML/TXT)", 400);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new AppError("URL request timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractSourceContent({ file, text, url }) {
  let sourceType = "";
  let extractedText = "";
  let cacheKey = "";
  let extractionId = "";
  let fullReady = true;

  if (file) {
    sourceType = "pdf";
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfName = String(file.originalname || "").toLowerCase().endsWith(".pdf");
    if (!isPdfMime && !isPdfName) {
      throw new AppError("Only PDF files are allowed", 400);
    }

    extractionId = `pdf:${hashText(file.buffer)}`;
    cacheKey = extractionId;

    const cached = getCachedExtraction(cacheKey);
    const job = getPdfJob(extractionId);
    fullReady = Boolean(job?.fullReady && job?.fullText);

    if (cached) {
      scheduleFullPdfExtraction(extractionId, file.buffer);
      return { ...cached, extractionId, fullReady };
    }

    const parsedPdf = await extractPdfText(file.buffer, {
      maxPages: FAST_PDF_PARSE_MAX_PAGES,
      allowFallback: true
    });
    extractedText = cleanExtractedText(parsedPdf.text);
    scheduleFullPdfExtraction(extractionId, file.buffer);
    fullReady = Boolean(getPdfJob(extractionId)?.fullReady);
  } else if (url) {
    sourceType = "url";
    extractionId = `url:${hashText(url)}`;
    cacheKey = extractionId;
    const cached = getCachedExtraction(cacheKey);
    if (cached) return { ...cached, extractionId, fullReady: true };
    extractedText = await extractFromUrl(url);
  } else if (text) {
    sourceType = "text";
    extractionId = `text:${hashText(text)}`;
    cacheKey = extractionId;
    const cached = getCachedExtraction(cacheKey);
    if (cached) return { ...cached, extractionId, fullReady: true };
    extractedText = cleanExtractedText(text);
  } else {
    throw new AppError("Provide pdf, url, or text", 400);
  }

  if (!extractedText || extractedText.length < 20) {
    throw new AppError("Not enough extractable text. Provide richer content.", 400);
  }

  const truncated = extractedText.length > FAST_EXTRACT_MAX_CHARS;
  const payload = {
    sourceType,
    chars: Math.min(extractedText.length, FAST_EXTRACT_MAX_CHARS),
    truncated,
    text: extractedText.slice(0, FAST_EXTRACT_MAX_CHARS)
  };

  if (sourceType === "pdf") {
    payload.fastMode = true;
    payload.maxParsedPages = FAST_PDF_PARSE_MAX_PAGES;
  }

  setCachedExtraction(cacheKey, payload);

  return {
    ...payload,
    extractionId,
    fullReady
  };
}

export function getExtractionJobStatus(extractionId) {
  if (!extractionId) {
    throw new AppError("extractionId is required", 400);
  }
  if (!String(extractionId).startsWith("pdf:")) {
    return { extractionId, fullReady: true, parsing: false, scheduled: false, error: null };
  }
  const job = getPdfJob(extractionId);
  return {
    extractionId,
    fullReady: Boolean(job?.fullReady && job?.fullText),
    parsing: Boolean(job?.parsing),
    scheduled: Boolean(job?.scheduled),
    error: job?.error || null
  };
}

export function resolveFullExtractedText(extractionId, fallbackText = "", preferFull = false) {
  if (!preferFull || !extractionId || !String(extractionId).startsWith("pdf:")) {
    return fallbackText;
  }
  const job = getPdfJob(extractionId);
  if (job?.fullReady && job?.fullText) {
    return job.fullText;
  }
  return fallbackText;
}
