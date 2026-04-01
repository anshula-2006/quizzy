import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import API_BASE from "../config.js";

const SESSION_KEY = "quizzy-session-v2";
const QUIZ_STATE_KEY = "quizzy-react-quiz-state-v1";
const RESULT_STATE_KEY = "quizzy-react-result-state-v1";
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const DEFAULT_GENERATE_SETTINGS = {
  difficulty: "moderate",
  questionMode: "mcq",
  outputLanguage: "English",
  learnerMode: "student"
};

const QuizAppContext = createContext(null);

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getSession() {
  return safeParse(localStorage.getItem(SESSION_KEY), null);
}

function normalizeQuestion(question) {
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

function normalizeShortAnswer(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function gradeShortAnswer(value, question) {
  const user = normalizeShortAnswer(value);
  const primary = normalizeShortAnswer(question.shortAnswer || question.correct || "");
  const alternates = Array.isArray(question.acceptableAnswers)
    ? question.acceptableAnswers.map((item) => normalizeShortAnswer(item))
    : [];
  return [primary, ...alternates]
    .filter(Boolean)
    .some((candidate) => user === candidate || (candidate.length > 4 && user.includes(candidate)));
}

async function extractContent(inputMode, values) {
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

async function requestQuiz(payload) {
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

async function requestFlashcards(payload) {
  const response = await fetch(`${API_BASE}/generate-flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to generate flashcards.");
  const flashcards = (Array.isArray(data.flashcards) ? data.flashcards : [])
    .map((card) => ({
      front: String(card?.front || "").trim(),
      back: String(card?.back || "").trim(),
      hint: String(card?.hint || "").trim()
    }))
    .filter((card) => card.front && card.back);
  if (!flashcards.length) throw new Error("No flashcards were returned.");
  return flashcards;
}

export function QuizAppProvider({ children }) {
  const [user, setUser] = useState(() => getSession());
  const [quizState, setQuizState] = useState(() => safeParse(sessionStorage.getItem(QUIZ_STATE_KEY), null));
  const [resultState, setResultState] = useState(() => safeParse(sessionStorage.getItem(RESULT_STATE_KEY), null));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (quizState) sessionStorage.setItem(QUIZ_STATE_KEY, JSON.stringify(quizState));
    else sessionStorage.removeItem(QUIZ_STATE_KEY);
  }, [quizState]);

  useEffect(() => {
    if (resultState) sessionStorage.setItem(RESULT_STATE_KEY, JSON.stringify(resultState));
    else sessionStorage.removeItem(RESULT_STATE_KEY);
  }, [resultState]);

  const refreshUser = useCallback(() => {
    setUser(getSession());
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const generateQuiz = useCallback(async ({ inputMode, values, settings }) => {
    setLoading(true);
    try {
      const contentPayload = await extractContent(inputMode, values);
      const requestPayload = {
        ...contentPayload,
        ...DEFAULT_GENERATE_SETTINGS,
        ...settings,
        questionCount: 5
      };
      const quizPayload = await requestQuiz(requestPayload);
      const nextQuizState = {
        quizId: quizPayload.quizId,
        questions: quizPayload.questions,
        currentIndex: 0,
        answers: [],
        score: 0,
        generatedAt: new Date().toISOString(),
        request: {
          inputMode,
          values: {
            topic: values.topic || "",
            url: values.url || ""
          },
          settings: {
            ...DEFAULT_GENERATE_SETTINGS,
            ...settings
          }
        },
        meta: {
          sourceType: contentPayload.sourceType,
          sourceInput: contentPayload.sourceInput
        }
      };
      setQuizState(nextQuizState);
      setResultState(null);
      return nextQuizState;
    } finally {
      setLoading(false);
    }
  }, []);

  const answerQuestion = useCallback((payload) => {
    setQuizState((current) => {
      if (!current) return current;
      const question = current.questions[current.currentIndex];
      if (!question) return current;

      const isCorrect = question.type === "short"
        ? gradeShortAnswer(payload.answer, question)
        : payload.answer === question.correct;

      const answerRecord = {
        question: question.question,
        type: question.type,
        selected: payload.answer,
        correct: question.type === "short" ? question.shortAnswer : question.correct,
        isCorrect,
        explanation: question.explanation || "",
        wrongExplanation: question.wrongExplanation || ""
      };

      const nextAnswers = [...current.answers];
      nextAnswers[current.currentIndex] = answerRecord;

      return {
        ...current,
        answers: nextAnswers,
        score: nextAnswers.filter((answer) => answer?.isCorrect).length
      };
    });
  }, []);

  const nextQuestion = useCallback(() => {
    setQuizState((current) => current
      ? { ...current, currentIndex: Math.min(current.currentIndex + 1, current.questions.length - 1) }
      : current);
  }, []);

  const previousQuestion = useCallback(() => {
    setQuizState((current) => current
      ? { ...current, currentIndex: Math.max(current.currentIndex - 1, 0) }
      : current);
  }, []);

  const retryQuiz = useCallback(() => {
    setQuizState((current) => current
      ? { ...current, currentIndex: 0, answers: [], score: 0 }
      : current);
    setResultState(null);
  }, []);

  const clearQuiz = useCallback(() => {
    setQuizState(null);
  }, []);

  const finishQuiz = useCallback(async () => {
    if (!quizState) return null;

    const attemptedAnswers = quizState.questions.map((question, index) => {
      const existing = quizState.answers[index];
      if (existing) return existing;
      return {
        question: question.question,
        type: question.type,
        selected: "",
        correct: question.type === "short" ? question.shortAnswer : question.correct,
        isCorrect: false,
        explanation: question.explanation || "",
        wrongExplanation: question.wrongExplanation || ""
      };
    });

    let finalResult = {
      score: attemptedAnswers.filter((answer) => answer.isCorrect).length,
      total: quizState.questions.length,
      percentage: quizState.questions.length
        ? Math.round((attemptedAnswers.filter((answer) => answer.isCorrect).length / quizState.questions.length) * 100)
        : 0,
      answers: attemptedAnswers,
      generatedAt: quizState.generatedAt,
      meta: quizState.meta,
      request: quizState.request
    };

    if (user?.token && quizState.quizId) {
      const response = await fetch(`${API_BASE}/submit-quiz`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          quizId: quizState.quizId,
          answers: quizState.questions.map((question, index) => ({
            question: question.question,
            selected: attemptedAnswers[index]?.selected ?? ""
          })),
          sourceType: quizState.meta?.sourceType || "topic",
          sourceInput: quizState.meta?.sourceInput || "",
          settings: {
            ...DEFAULT_GENERATE_SETTINGS,
            ...(quizState.request?.settings || {})
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.evaluation) {
        finalResult = {
          ...finalResult,
          score: Number(data.evaluation.score || finalResult.score),
          total: Number(data.evaluation.total || finalResult.total),
          percentage: Number(data.evaluation.percentage || finalResult.percentage),
          answers: Array.isArray(data.evaluation.answers) ? data.evaluation.answers : finalResult.answers,
          confidence: Number(data.evaluation.confidence || 0)
        };
      }
    }

    setResultState(finalResult);
    return finalResult;
  }, [quizState, user]);

  const generateArcadeFlashcards = useCallback(async ({ inputMode, values, settings }) => {
    setLoading(true);
    try {
      const contentPayload = await extractContent(inputMode, values);
      return await requestFlashcards({
        ...contentPayload,
        ...DEFAULT_GENERATE_SETTINGS,
        ...settings
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const generateArcadeQuiz = useCallback(async ({ inputMode, values, settings, questionCount = 5 }) => {
    setLoading(true);
    try {
      const contentPayload = await extractContent(inputMode, values);
      const quizPayload = await requestQuiz({
        ...contentPayload,
        ...DEFAULT_GENERATE_SETTINGS,
        ...settings,
        questionCount
      });
      return quizPayload.questions;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    refreshUser,
    logout,
    loading,
    quizState,
    resultState,
    generateQuiz,
    answerQuestion,
    nextQuestion,
    previousQuestion,
    retryQuiz,
    clearQuiz,
    finishQuiz,
    generateArcadeFlashcards,
    generateArcadeQuiz
  }), [
    user,
    refreshUser,
    logout,
    loading,
    quizState,
    resultState,
    generateQuiz,
    answerQuestion,
    nextQuestion,
    previousQuestion,
    retryQuiz,
    clearQuiz,
    finishQuiz,
    generateArcadeFlashcards,
    generateArcadeQuiz
  ]);

  return <QuizAppContext.Provider value={value}>{children}</QuizAppContext.Provider>;
}

export function useQuizApp() {
  const context = useContext(QuizAppContext);
  if (!context) throw new Error("useQuizApp must be used inside QuizAppProvider");
  return context;
}
