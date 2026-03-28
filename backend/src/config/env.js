import dotenv from "dotenv";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  groqApiKey: process.env.GROQ_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  groqModel: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  pdfPythonBin: process.env.PDF_PYTHON_BIN || "python",
  pdfPythonTimeoutMs: Number(process.env.PDF_PYTHON_TIMEOUT_MS || 12000),
  maxPdfUploadBytes: Number(process.env.MAX_PDF_UPLOAD_BYTES || 100 * 1024 * 1024),
  quizSessionTtlHours: Number(process.env.QUIZ_SESSION_TTL_HOURS || 6)
};
