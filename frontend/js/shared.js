import API_BASE from "../src/config.js";

export const SESSION_KEY = "quizzy-session-v2";
export const QUIZ_KEY = "quizzy-vanilla-quiz-v1";
export const RESULT_KEY = "quizzy-vanilla-result-v1";
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getQuizState() {
  try {
    const raw = sessionStorage.getItem(QUIZ_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setQuizState(value) {
  if (!value) {
    sessionStorage.removeItem(QUIZ_KEY);
    return;
  }
  sessionStorage.setItem(QUIZ_KEY, JSON.stringify(value));
}

export function getResultState() {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setResultState(value) {
  if (!value) {
    sessionStorage.removeItem(RESULT_KEY);
    return;
  }
  sessionStorage.setItem(RESULT_KEY, JSON.stringify(value));
}

export function clearQuizFlow() {
  sessionStorage.removeItem(QUIZ_KEY);
  sessionStorage.removeItem(RESULT_KEY);
}

export function normalizeQuestion(question) {
  if (!question || typeof question !== "object") return null;
  const type = question.type === "short" ? "short" : "mcq";

  if (type === "mcq") {
    const options = Array.isArray(question.options) && question.options.length >= 2
      ? question.options.slice(0, 4)
      : null;
    const correct = String(question.correct || "A").trim().charAt(0).toUpperCase();
    if (!options) return null;
    return {
      ...question,
      type,
      options,
      correct: ["A", "B", "C", "D"].includes(correct) ? correct : "A"
    };
  }

  return {
    ...question,
    type,
    shortAnswer: question.shortAnswer || question.correct || "",
    acceptableAnswers: Array.isArray(question.acceptableAnswers) ? question.acceptableAnswers : []
  };
}

export function normalizeShortAnswer(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function gradeShortAnswer(value, question) {
  const user = normalizeShortAnswer(value);
  const primary = normalizeShortAnswer(question.shortAnswer || question.correct || "");
  const alternates = Array.isArray(question.acceptableAnswers)
    ? question.acceptableAnswers.map((item) => normalizeShortAnswer(item))
    : [];
  return [primary, ...alternates]
    .filter(Boolean)
    .some((candidate) => user === candidate || (candidate.length > 4 && user.includes(candidate)));
}

export async function extractContent(inputMode, values) {
  if (inputMode === "text") {
    const trimmed = values.topic.trim();
    if (trimmed.length < 50) {
      return {
        topic: trimmed,
        sourceType: "topic",
        sourceInput: trimmed
      };
    }
  }

  if (inputMode === "pdf") {
    const file = values.pdfFile;
    if (!file) throw new Error("Please choose a PDF file.");
    if (file.size > MAX_PDF_BYTES) throw new Error("PDF is too large. Maximum size is 100MB.");

    const formData = new FormData();
    formData.append("pdf", file);
    const response = await fetch(`${API_BASE}/extract-content`, { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not read the PDF.");
    return {
      text: data.text,
      extractionId: data.extractionId || null,
      preferFull: false,
      sourceType: "pdf",
      sourceInput: file.name || "pdf"
    };
  }

  if (inputMode === "url") {
    const response = await fetch(`${API_BASE}/extract-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: values.url.trim() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not read that URL.");
    return {
      text: data.text,
      extractionId: data.extractionId || null,
      preferFull: false,
      sourceType: "url",
      sourceInput: values.url.trim()
    };
  }

  const response = await fetch(`${API_BASE}/extract-content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: values.topic.trim() })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not prepare that content.");
  return {
    text: data.text,
    extractionId: data.extractionId || null,
    preferFull: false,
    sourceType: "text",
    sourceInput: values.topic.trim().slice(0, 140)
  };
}

export async function requestQuiz(payload) {
  const response = await fetch(`${API_BASE}/generate-quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to generate quiz.");
  const questions = (Array.isArray(data.questions) ? data.questions : [])
    .map(normalizeQuestion)
    .filter(Boolean);
  if (!questions.length) throw new Error("No quiz questions were returned.");
  return { quizId: data.quizId || null, questions };
}

export async function submitQuizAttempt(quizState) {
  const session = getSession();
  const answers = quizState.questions.map((question, index) => ({
    question: question.question,
    selected: quizState.answers[index]?.selected ?? ""
  }));

  if (!session?.token || !quizState.quizId) return null;

  const response = await fetch(`${API_BASE}/submit-quiz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`
    },
    body: JSON.stringify({
      quizId: quizState.quizId,
      answers,
      sourceType: quizState.meta?.sourceType || "topic",
      sourceInput: quizState.meta?.sourceInput || "",
      settings: quizState.settings
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to submit quiz.");
  return data;
}

export function buildResultState(quizState, evaluationOverride = null) {
  const answers = quizState.questions.map((question, index) => {
    const answer = quizState.answers[index];
    if (answer) return answer;
    return {
      question: question.question,
      selected: "",
      correct: question.type === "short" ? question.shortAnswer : question.correct,
      isCorrect: false,
      type: question.type,
      explanation: question.explanation || "",
      wrongExplanation: question.wrongExplanation || ""
    };
  });

  const score = answers.filter((answer) => answer.isCorrect).length;
  const total = quizState.questions.length;
  const fallback = {
    score,
    total,
    percentage: total ? Math.round((score / total) * 100) : 0,
    confidence: 0,
    answers
  };

  return {
    ...fallback,
    ...(evaluationOverride || {}),
    generatedAt: quizState.generatedAt,
    meta: quizState.meta,
    settings: quizState.settings
  };
}

export function feedbackText(percentage) {
  if (percentage >= 90) return "Nice! You're sharp 😏";
  if (percentage >= 75) return "Strong run. You're warming up fast.";
  if (percentage >= 60) return "Good momentum. One more round will feel even better.";
  return "You’ve got this. Try again and level up.";
}
