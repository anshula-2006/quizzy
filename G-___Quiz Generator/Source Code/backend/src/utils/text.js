import { createHash } from "crypto";

export function cleanExtractedText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function hashText(value) {
  const hasher = createHash("sha256");
  if (Buffer.isBuffer(value)) {
    hasher.update(value);
  } else {
    hasher.update(String(value || ""));
  }
  return hasher.digest("hex");
}

export function normalizeShortAnswer(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toClientDoc(doc) {
  if (!doc) return null;
  const copy = { ...doc };
  if (copy._id) {
    copy.id = copy._id.toString();
    delete copy._id;
  }
  if (copy.user && typeof copy.user !== "string") {
    copy.user = copy.user.toString();
  }
  if (copy.quizSession && typeof copy.quizSession !== "string") {
    copy.quizSession = copy.quizSession.toString();
  }
  return copy;
}
