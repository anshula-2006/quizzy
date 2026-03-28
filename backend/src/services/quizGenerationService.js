import { QuizSession } from "../models/QuizSession.js";
import { createJsonCompletion } from "./aiProviderService.js";
import { resolveFullExtractedText } from "./contentExtractionService.js";
import { AppError } from "../utils/AppError.js";

function normalizeQuestionType(type) {
  return String(type || "").trim().toLowerCase() === "short" ? "short" : "mcq";
}

function normalizeMcqCorrect(correct, options) {
  const normalizedOptions = Array.isArray(options)
    ? options.slice(0, 4).map((option) => String(option || "").trim()).filter(Boolean)
    : [];
  const raw = String(correct || "").trim();
  const letter = raw.charAt(0).toUpperCase();
  if (["A", "B", "C", "D"].includes(letter)) return letter;
  const optionIndex = normalizedOptions.findIndex((option) => option.toLowerCase() === raw.toLowerCase());
  return optionIndex >= 0 ? ["A", "B", "C", "D"][optionIndex] : "A";
}

function extractJsonBlock(rawOutput) {
  const text = String(rawOutput || "").replace(/```json|```/gi, "").trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new AppError("AI returned invalid JSON", 502);
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function normalizeJsonCandidate(jsonText) {
  return String(jsonText || "")
    .replace(/[â€œâ€]/g, "\"")
    .replace(/[â€˜â€™]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/}\s*{/g, "},{")
    .trim();
}

function sanitizeQuestions(rawQuestions, questionMode, questionCount) {
  const sanitized = (Array.isArray(rawQuestions) ? rawQuestions : [])
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

      const type = normalizeQuestionType(item.type);
      if (type === "short") {
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

      const options = Array.isArray(item.options)
        ? item.options.map((option) => String(option || "").trim()).filter(Boolean).slice(0, 4)
        : [];
      if (options.length < 2) return null;

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

  if (questionMode === "mcq") {
    return sanitized.filter((item) => item.type === "mcq").slice(0, questionCount);
  }

  if (questionMode === "short") {
    return sanitized.filter((item) => item.type === "short").slice(0, questionCount);
  }

  const mcqTarget = Math.max(1, Math.round(questionCount * 0.6));
  const shortTarget = Math.max(1, questionCount - mcqTarget);
  const mcqs = sanitized.filter((item) => item.type === "mcq");
  const shorts = sanitized.filter((item) => item.type === "short");
  return [...mcqs.slice(0, mcqTarget), ...shorts.slice(0, shortTarget)].slice(0, questionCount);
}

function hasModeMismatch(questions, questionMode, questionCount) {
  if (!Array.isArray(questions) || questions.length < questionCount) return true;
  if (questionMode === "mcq") return questions.some((item) => item.type !== "mcq");
  if (questionMode === "short") return questions.some((item) => item.type !== "short");
  return false;
}

function buildQuizPrompt({ topic, text, difficulty, learnerMode, questionMode, outputLanguage, questionCount, variation }) {
  const roleGuide = learnerMode === "teacher"
    ? "Teacher mode: include misconception-focused prompts, concise justifications, and assessment wording suitable for class review."
    : learnerMode === "self-study"
      ? "Self-study mode: emphasize clarity, memory cues, and reinforcement before increasing difficulty."
      : "Student mode: prioritize exam readiness, conceptual traps, and timed-practice realism.";

  const strictModeNote = questionMode === "mcq"
    ? `Hard requirement: every question.type MUST be "mcq". Return exactly ${questionCount} MCQ questions.`
    : questionMode === "short"
      ? `Hard requirement: every question.type MUST be "short". Return exactly ${questionCount} short-answer questions.`
      : `Hard requirement: return exactly ${questionCount} questions with roughly 60% MCQ and 40% short-answer questions.`;

  return `
Generate exactly ${questionCount} quiz questions in JSON.
Return ONLY valid JSON.

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
      "explanation": "2-3 sentence clear explanation",
      "wrongExplanation": "1-2 sentence explanation of a likely wrong answer",
      "image": "Direct Wikimedia Commons image URL ending with .jpg or .png, or null"
    }
  ]
}

Rules:
- Questions must be factually correct and grounded in the provided topic/content.
- Avoid ambiguity and avoid opinion-based prompts.
- Explanation must clearly justify the correct answer.
- If unsure, choose safer facts.
- Difficulty: "${difficulty}".
- Learner mode: "${learnerMode}". ${roleGuide}
- Question mode: "${questionMode}". ${strictModeNote}
- Output language: "${outputLanguage}".
- Keep JSON keys in English.
- Vary the questions every time.
- Image URL must start with https://upload.wikimedia.org/ and end with .jpg or .png, otherwise use null.

Variation ID: ${variation}
Topic: "${topic || "General knowledge"}"
Content: ${text || "Use general knowledge"}
`;
}

function buildFlashcardPrompt({ topic, text, difficulty, learnerMode, outputLanguage }) {
  return `
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
- Use the provided topic/content as the primary source.
- Include a hint for each card.
- If image is not confidently relevant, return null.

Topic: "${topic || "General knowledge"}"
Content: ${text || "Use general knowledge"}
`;
}

async function parseJsonCompletion(prompt, sanitizer, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const output = await createJsonCompletion(prompt, attempt === 0 ? 0.8 : 0.3);
      const rawJson = extractJsonBlock(output);
      const parsed = JSON.parse(normalizeJsonCandidate(rawJson));
      return sanitizer(parsed);
    } catch (error) {
      lastError = error;
    }
  }
  throw new AppError(lastError?.message || "AI generation failed", 502);
}

export async function generateQuizSession({ userId = null, topic = "", text = "", difficulty = "moderate", learnerMode = "student", questionMode = "mcq", outputLanguage = "English", extractionId = "", preferFull = false, sourceType = "topic", sourceInput = "", questionCount = 5 }) {
  const resolvedCount = Math.max(1, Math.min(10, Math.floor(Number(questionCount) || 5)));
  const effectiveText = resolveFullExtractedText(extractionId, text, preferFull);

  if (!effectiveText && !topic) {
    throw new AppError("Text or topic is required", 400);
  }

  const prompt = buildQuizPrompt({
    topic,
    text: effectiveText,
    difficulty,
    learnerMode,
    questionMode,
    outputLanguage,
    questionCount: resolvedCount,
    variation: Math.floor(Math.random() * 100000)
  });

  let questions = await parseJsonCompletion(prompt, (parsed) => sanitizeQuestions(parsed?.questions, questionMode, resolvedCount));

  if (hasModeMismatch(questions, questionMode, resolvedCount)) {
    questions = await parseJsonCompletion(
      `${prompt}\nPrevious output violated the question mode rules. Regenerate from scratch and follow them exactly.`,
      (parsed) => sanitizeQuestions(parsed?.questions, questionMode, resolvedCount)
    );
  }

  if (hasModeMismatch(questions, questionMode, resolvedCount)) {
    throw new AppError(`Could not generate ${resolvedCount} valid ${questionMode} questions. Try again.`, 502);
  }

  const quizSession = await QuizSession.create({
    user: userId,
    sourceType,
    sourceInput,
    topic,
    extractedText: effectiveText || "",
    settings: {
      difficulty,
      learnerMode,
      questionMode,
      outputLanguage,
      questionCount: resolvedCount
    },
    questions
  });

  return {
    quizId: quizSession._id.toString(),
    questions
  };
}

export async function generateFlashcards({ topic = "", text = "", difficulty = "moderate", learnerMode = "student", outputLanguage = "English" }) {
  if (!text && !topic) {
    throw new AppError("Text or topic is required", 400);
  }

  const prompt = buildFlashcardPrompt({ topic, text, difficulty, learnerMode, outputLanguage });
  const response = await parseJsonCompletion(prompt, (parsed) => parsed);
  const flashcards = Array.isArray(response?.flashcards) ? response.flashcards : [];

  return {
    flashcards: flashcards
      .map((card) => ({
        front: String(card?.front || "").trim(),
        back: String(card?.back || "").trim(),
        hint: String(card?.hint || "").trim(),
        image: card?.image || null
      }))
      .filter((card) => card.front && card.back)
  };
}
