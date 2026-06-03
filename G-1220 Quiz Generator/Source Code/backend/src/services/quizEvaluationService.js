import { QuizSession } from "../models/QuizSession.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
import { AppError } from "../utils/AppError.js";
import { normalizeShortAnswer } from "../utils/text.js";
import { applyGamificationToUser } from "./gamificationService.js";

function gradeShortAnswer(answer, question) {
  const userValue = normalizeShortAnswer(answer);
  const primary = normalizeShortAnswer(question.shortAnswer || question.correct || "");
  const alternates = Array.isArray(question.acceptableAnswers)
    ? question.acceptableAnswers.map((item) => normalizeShortAnswer(item))
    : [];
  const accepted = [primary, ...alternates].filter(Boolean);

  if (!userValue || !accepted.length) {
    return { isCorrect: false, confidence: 0 };
  }

  if (accepted.includes(userValue)) {
    return { isCorrect: true, confidence: 1 };
  }

  const includedMatch = accepted.find((value) => value.length > 4 && userValue.includes(value));
  if (includedMatch) {
    return { isCorrect: true, confidence: 0.72 };
  }

  return { isCorrect: false, confidence: 0.18 };
}

function normalizeAnswerText(value) {
  return String(value || "")
    .trim()
    .replace(/^(?:option\s*)?[A-D][\).:\-\s]+/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeMcqAnswer(value, options = []) {
  const raw = String(value || "").trim();
  const letters = ["A", "B", "C", "D"];
  const letterMatch = raw.match(/^(?:Option\s*)?([A-D])(?:[\).:\-]|\s*$)/i);
  if (letterMatch) return letterMatch[1].toUpperCase();

  const optionIndex = Array.isArray(options)
    ? options.slice(0, 4).findIndex((option) => normalizeAnswerText(option) === normalizeAnswerText(raw))
    : -1;
  return optionIndex >= 0 ? letters[optionIndex] : raw.toUpperCase();
}

function evaluateAnswer(submittedAnswer, question) {
  if (question.type === "short") {
    const shortResult = gradeShortAnswer(submittedAnswer, question);
    return {
      selected: submittedAnswer || "",
      correct: question.shortAnswer || question.correct,
      isCorrect: shortResult.isCorrect,
      confidence: shortResult.confidence
    };
  }

  const selected = normalizeMcqAnswer(submittedAnswer, question.options);
  const correct = normalizeMcqAnswer(question.correct, question.options);
  return {
    selected,
    correct,
    isCorrect: selected === correct,
    confidence: selected === correct ? 1 : 0.05
  };
}

export async function evaluateQuizAttempt({ user, quizId, answers = [], sourceType = "text", sourceInput = "", settings = {} }) {
  const quizSession = await QuizSession.findById(quizId).lean();
  if (!quizSession) {
    throw new AppError("Quiz session not found or expired. Regenerate the quiz and try again.", 404);
  }

  const existingAttempt = await QuizAttempt.findOne({ user: user._id, quizSession: quizSession._id });
  if (existingAttempt) {
    const evaluatedAnswers = Array.isArray(existingAttempt.evaluatedAnswers) ? existingAttempt.evaluatedAnswers : [];
    return {
      attempt: existingAttempt,
      evaluation: {
        score: Number(existingAttempt.score || 0),
        total: Number(existingAttempt.total || 0),
        percentage: Number(existingAttempt.percentage || 0),
        confidence: Number(existingAttempt.confidence || 0),
        answers: evaluatedAnswers
      },
      gamification: {
        updatedStats: user.stats || {},
        unlockedAchievements: [],
        rewards: {
          pointsEarned: Number(existingAttempt.pointsEarned || 0),
          xpEarned: Number(existingAttempt.xpEarned || 0)
        }
      }
    };
  }

  const questions = Array.isArray(quizSession.questions) ? quizSession.questions : [];
  if (!questions.length) {
    throw new AppError("Quiz session has no questions to evaluate.", 400);
  }

  const evaluatedAnswers = questions.map((question, index) => {
    const raw = answers[index] || {};
    const answerValue = raw.selected ?? raw.answer ?? raw.value ?? "";
    const graded = evaluateAnswer(answerValue, question);

    return {
      question: question.question,
      type: question.type,
      selected: graded.selected,
      correct: graded.correct,
      isCorrect: graded.isCorrect,
      confidence: graded.confidence,
      explanation: question.explanation || "",
      wrongExplanation: question.wrongExplanation || "",
      image: question.image || null
    };
  });

  const total = evaluatedAnswers.length;
  const score = evaluatedAnswers.filter((answer) => answer.isCorrect).length;
  const percentage = total ? Math.round((score / total) * 100) : 0;
  const confidence = total
    ? Math.round((evaluatedAnswers.reduce((sum, answer) => sum + Number(answer.confidence || 0), 0) / total) * 100)
    : 0;

  const evaluatedAttempt = {
    sourceType: sourceType || quizSession.sourceType || "text",
    sourceInput: sourceInput || quizSession.sourceInput || "",
    sourceTopic: quizSession.topic || "",
    sourceText: quizSession.extractedText || "",
    settings: { ...quizSession.settings, ...settings },
    answers,
    evaluatedAnswers,
    score,
    total,
    percentage,
    confidence
  };

  const gamification = applyGamificationToUser(user, evaluatedAttempt);

  const createdAttempt = await QuizAttempt.create({
    user: user._id,
    quizSession: quizSession._id,
    sourceType: evaluatedAttempt.sourceType,
    sourceInput: evaluatedAttempt.sourceInput,
    sourceTopic: evaluatedAttempt.sourceTopic,
    sourceText: evaluatedAttempt.sourceText,
    settings: evaluatedAttempt.settings,
    answers,
    evaluatedAnswers,
    score,
    total,
    percentage,
    confidence,
    pointsEarned: gamification.rewards.pointsEarned,
    xpEarned: gamification.rewards.xpEarned,
    streakAfterAttempt: gamification.updatedStats.currentStreak
  });

  await user.save();

  return {
    attempt: createdAttempt,
    evaluation: {
      score,
      total,
      percentage,
      confidence,
      answers: evaluatedAnswers
    },
    gamification
  };
}
