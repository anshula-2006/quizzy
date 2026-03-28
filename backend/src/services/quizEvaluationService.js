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

  const selected = String(submittedAnswer || "").trim().toUpperCase();
  const correct = String(question.correct || "").trim().toUpperCase();
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
