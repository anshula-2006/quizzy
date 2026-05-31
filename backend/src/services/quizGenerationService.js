import { QuizSession } from "../models/QuizSession.js";
import { createJsonCompletion } from "./aiProviderService.js";
import { resolveFullExtractedText, extractFromWikipedia } from "./contentExtractionService.js";
import { AppError } from "../utils/AppError.js";

function normalizeQuestionType(type) {
  return String(type || "").trim().toLowerCase() === "short" ? "short" : "mcq";
}

function normalizeMcqCorrect(correct, options) {
  const normalizedOptions = Array.isArray(options)
    ? options.slice(0, 4).map((option) => String(option || "").trim()).filter(Boolean)
    : [];
  const raw = String(correct || "").trim();
  
  const exactIndex = normalizedOptions.findIndex((option) => option.toLowerCase() === raw.toLowerCase());
  if (exactIndex >= 0) return ["A", "B", "C", "D"][exactIndex];
  
  const match = raw.match(/^(?:Option\s+)?([A-D])[\).\s]?$/i) || raw.match(/^([A-D])\b/i);
  if (match) return match[1].toUpperCase();

  const letter = raw.charAt(0).toUpperCase();
  if (["A", "B", "C", "D"].includes(letter)) return letter;
  return "A";
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
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
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

      let image = item.image || null;
      if (image && typeof image === "string") {
        image = image.trim();
        if (!image.startsWith("https://upload.wikimedia.org/") || !image.match(/\.(jpg|jpeg|png)$/i)) {
          image = null;
        }
      } else {
        image = null;
      }

      const base = {
        question,
        explanation: String(item.explanation || "").trim(),
        wrongExplanation: item.wrongExplanation ? String(item.wrongExplanation).trim() : null,
        image
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

function hasModeMismatch(questions, questionMode) {
  if (!Array.isArray(questions) || questions.length === 0) return true;
  if (questionMode === "mcq") return questions.some((item) => item.type !== "mcq");
  if (questionMode === "short") return questions.some((item) => item.type !== "short");
  return false;
}

function hasGenerationMismatch(questions, questionMode, questionCount) {
  return hasModeMismatch(questions, questionMode) || questions.length !== questionCount;
}

function buildQuestionBatches(questionCount) {
  if (questionCount <= 20) return [questionCount];

  const batches = [];
  let remaining = questionCount;
  const preferredBatchSize = 15;

  while (remaining > 0) {
    if (remaining <= preferredBatchSize) {
      batches.push(remaining);
      break;
    }

    const next = remaining - preferredBatchSize < 5
      ? remaining - 5
      : preferredBatchSize;
    batches.push(next);
    remaining -= next;
  }

  return batches;
}

async function runLimited(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

function buildQuizPrompt({ topic, text, sourceType, difficulty, learnerMode, questionMode, outputLanguage, questionCount, totalQuestionCount = questionCount, timerEnabled, timerSeconds, variation, userLocalTime, userTimezone }) {
  const today = userLocalTime || new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const locationContext = userTimezone ? ` in the ${userTimezone} timezone` : "";
  const difficultyRule = difficulty === "current_events" ? 'Difficulty: "Current Events". Focus heavily on recent news, dynamic updates, and the latest established context for the topic.' : `Difficulty: "${difficulty}".`;
  const explanationDepthRule = Number(totalQuestionCount) > 20
    ? "For larger quizzes above 20 questions, keep each explanation and wrongExplanation concise but useful, usually 1 sentence each, so the full JSON can be returned completely."
    : "For normal quizzes, explanations may be 2-3 sentences when needed.";
  const isTopicOnly = String(sourceType || "").trim().toLowerCase() === "topic" && !String(text || "").trim();
  const topicOnlyRule = isTopicOnly
    ? '- Topic Mode: Use ONLY the requested Topic as the scope. Do not infer or fetch source articles, boards, institutions, history, or general knowledge adjacent to the words in the topic.\n- If the Topic is "10th class mathematics" or similar, generate Class 10 mathematics questions only, covering age-appropriate algebra, geometry, trigonometry, probability, statistics, and mensuration. Do not ask about education boards, school history, unrelated general knowledge, or college-level mathematics.'
    : '';

  const roleGuide = learnerMode === "focus"
    ? "Focus Mode: Generate highly clear, direct questions with minimal distractions. Emphasize deep understanding, core concepts, and provide extremely detailed step-by-step explanations."
    : learnerMode === "arcade"
      ? "Arcade Mode: Generate fun, punchy, gamified questions. Use engaging scenarios, slightly faster-paced trivia style wording, and enthusiastic explanations."
      : learnerMode === "exam"
        ? "Exam Mode: Generate strict, realistic exam-style questions. Include conceptual traps, multi-step reasoning, formal academic language, and precise distractors."
        : learnerMode === "revision"
          ? "Revision Mode: Target common weak points, edge cases, and frequently missed concepts. Reinforce memory with explicit details on exactly why wrong options are incorrect."
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
      "explanation": "Clear teaching explanation with step-by-step reasoning when useful",
      "wrongExplanation": "Explanation of why a likely wrong answer or misconception is incorrect",
      "image": null
    }
  ]
}

Rules:
- Today's date and time${locationContext} is ${today}. Use this exact date to correctly frame questions about current events, past events, and future schedules.
- Questions must be factually correct and grounded in the provided topic/content.
- Strict Scope: Stay STRICTLY within the boundaries of the requested topic. Do not generate random, generic trivia or unrelated questions under any circumstances.
- Academic Context & Normalization: If the topic implies a specific educational grade, class, or syllabus (e.g., "10th class mathematics", "biology class 12"), strictly interpret it as the standard academic syllabus for that subject and level (e.g., secondary school mathematics, higher secondary biology). Match the concepts and difficulty appropriately to the academic context.
- Context Override: If the provided Content appears completely unrelated to the requested Topic (e.g., due to an automated search mismatch), IGNORE the Content and rely entirely on your internal expert knowledge of the Topic.
${topicOnlyRule}
- Avoid ambiguity and avoid opinion-based prompts.
- Explanation must clearly justify the correct answer.
- The "explanation" MUST act like a tutor: give a clear, factual justification for why the correct answer is right.
- For mathematics, science, coding, grammar, and other skill-based subjects, the "explanation" MUST include concise step-by-step reasoning, not just the final answer.
- The "wrongExplanation" MUST explicitly address a common misconception or clarify exactly why a specific distractor is wrong.
- Avoid generic explanations such as "this is correct because it is the right answer"; explain the concept, rule, or calculation.
- Explanation length: ${explanationDepthRule}
- Focus on highly specific, varied, and insightful facts. Do NOT generate generic, repetitive, or obvious questions.
- For topics involving future dates (e.g., 2026), rely strictly on established structural rules, schedules, term limits, and current contexts rather than substituting past events.
- If the topic involves dates around or after ${today}, rely on established schedules, laws, and the most current data available.
- If unsure, choose safer facts.
- ${difficultyRule}
- Learner mode: "${learnerMode}". ${roleGuide}
- Question mode: "${questionMode}". ${strictModeNote}
- Requested question count: ${questionCount}. Return exactly ${questionCount} questions.
- Timer setting: ${timerEnabled ? `ON, ${timerSeconds} seconds per question` : "OFF"}.
- Output language: "${outputLanguage}".
- Keep JSON keys in English.
- Use plain text math notation only. Do not use LaTeX commands or backslashes in any JSON string.
- Avoid quotation marks inside question, option, answer, and explanation text.
- Diversity requirement: Treat the Variation ID as a unique seed. Even when the topic, source, difficulty, and question count are the same, generate a fresh question set with different wording, examples, numerical values, option order, and subtopic coverage.
- For mathematics and science, vary problem numbers, diagrams described in text, scenarios, and concept combinations between generations.
- Vary the questions every time and avoid repeating the most obvious first questions for a topic.
- Always set image to null for quiz questions.

Current Date: ${today}
Variation ID: ${variation}
Topic: "${topic || "General knowledge"}"
Content: ${text || "Use general knowledge"}
`;
}

function buildFlashcardPrompt({ topic, text, difficulty, learnerMode, outputLanguage, userLocalTime, userTimezone }) {
  const today = userLocalTime || new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const locationContext = userTimezone ? ` in the ${userTimezone} timezone` : "";

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
- Today's date and time${locationContext} is ${today}. Frame your facts and tenses accordingly.
- Strict Scope: Stay STRICTLY within the requested topic scope. Do not deviate into unrelated trivia.
- Academic Context: If the topic implies an educational grade, class, or syllabus, strictly align the definitions, concepts, and terminology with that specific academic level.
- Context Override: If the provided Content appears completely unrelated to the requested Topic, IGNORE the Content and rely entirely on your internal expert knowledge of the Topic.
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
      const output = await createJsonCompletion(prompt, attempt === 0 ? 0.35 : 0.15);
      const rawJson = extractJsonBlock(output);
      const parsed = JSON.parse(normalizeJsonCandidate(rawJson));
      return sanitizer(parsed);
    } catch (error) {
      lastError = error;
    }
  }
  throw new AppError(lastError?.message || "AI generation failed", 502);
}

async function generateQuestionBatch(prompt, questionMode, questionCount) {
  let questions = await parseJsonCompletion(prompt, (parsed) => sanitizeQuestions(parsed?.questions, questionMode, questionCount));

  for (let repairAttempt = 0; repairAttempt < 1 && hasGenerationMismatch(questions, questionMode, questionCount); repairAttempt += 1) {
    questions = await parseJsonCompletion(
      `${prompt}\nPrevious output violated the question count or question mode rules. Regenerate from scratch and return exactly ${questionCount} valid ${questionMode} questions. For MCQ questions, every item must include exactly 4 non-empty options and correct must be only A, B, C, or D. Do not return fewer than ${questionCount} valid questions.`,
      (parsed) => sanitizeQuestions(parsed?.questions, questionMode, questionCount)
    );
  }

  if (hasGenerationMismatch(questions, questionMode, questionCount)) {
    throw new AppError(`Could not generate exactly ${questionCount} valid ${questionMode} questions for this topic. Please try again.`, 502);
  }

  return questions;
}

export async function generateQuizSession({ userId = null, topic = "", text = "", difficulty = "medium", learnerMode = "student", questionMode = "mcq", outputLanguage = "English", extractionId = "", preferFull = false, sourceType = "topic", sourceInput = "", questionCount = 5, timerEnabled = false, timerSeconds = null, variation = null, userLocalTime = "", userTimezone = "" }) {
  const resolvedCount = Math.max(5, Math.min(100, Math.floor(Number(questionCount) || 5)));
  const resolvedTimerSeconds = timerEnabled ? Math.max(15, Math.floor(Number(timerSeconds) || 15)) : null;
  const variationSeed = `${variation || Date.now()}-${userId || "guest"}-${Math.random().toString(36).slice(2)}`;
  let effectiveText = resolveFullExtractedText(extractionId, text, preferFull);
  const isTopicMode = String(sourceType || "").trim().toLowerCase() === "topic";
  if (isTopicMode) {
    sourceType = "topic";
    sourceInput = sourceInput || topic;
  }

  // Automatically fetch Wikipedia context only for legacy non-topic requests.
  if (!effectiveText && topic && !isTopicMode) {
    const wikiData = await extractFromWikipedia(topic);
    if (wikiData && wikiData.text) {
      effectiveText = wikiData.text;
      sourceType = "wikipedia";
      sourceInput = wikiData.url;
    }
  }

  if (!effectiveText && !topic) {
    throw new AppError("Text or topic is required", 400);
  }

  const batches = buildQuestionBatches(resolvedCount);
  const batchResults = await runLimited(batches, 3, async (batchCount, batchIndex) => {
    const prompt = buildQuizPrompt({
      topic,
      text: effectiveText,
      sourceType,
      difficulty,
      learnerMode,
      questionMode,
      outputLanguage,
      questionCount: batchCount,
      totalQuestionCount: resolvedCount,
      timerEnabled: Boolean(timerEnabled),
      timerSeconds: resolvedTimerSeconds,
      variation: `${variationSeed}-batch-${batchIndex + 1}-of-${batches.length}`,
      userLocalTime,
      userTimezone
    });

    return generateQuestionBatch(prompt, questionMode, batchCount);
  });

  const questions = batchResults.flat().slice(0, resolvedCount);
  if (hasGenerationMismatch(questions, questionMode, resolvedCount)) {
    throw new AppError(`Could not generate exactly ${resolvedCount} valid ${questionMode} questions for this topic. Please try again.`, 502);
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
      questionCount: questions.length,
      timerEnabled: Boolean(timerEnabled),
      timerSeconds: resolvedTimerSeconds
    },
    questions
  });

  return {
    quizId: quizSession._id.toString(),
    questions,
    meta: { sourceType, sourceInput }
  };
}

export async function generateFlashcards({ topic = "", text = "", difficulty = "moderate", learnerMode = "student", outputLanguage = "English", userLocalTime = "", userTimezone = "" }) {
  let effectiveText = text;
  let meta = null;

  // Automatically fetch Wikipedia context for bare topics
  if (!effectiveText && topic) {
    const wikiData = await extractFromWikipedia(topic);
    if (wikiData && wikiData.text) {
      effectiveText = wikiData.text;
      meta = { sourceType: "wikipedia", sourceInput: wikiData.url };
    }
  }

  if (!effectiveText && !topic) {
    throw new AppError("Text or topic is required", 400);
  }

  const prompt = buildFlashcardPrompt({ topic, text: effectiveText, difficulty, learnerMode, outputLanguage, userLocalTime, userTimezone });
  const response = await parseJsonCompletion(prompt, (parsed) => parsed);
  const flashcards = Array.isArray(response?.flashcards) ? response.flashcards : [];

  return {
    meta,
    flashcards: flashcards
      .map((card) => {
        let image = card?.image || null;
        if (image && typeof image === "string") {
          image = image.trim();
          if (!image.startsWith("https://upload.wikimedia.org/") || !image.match(/\.(jpg|jpeg|png)$/i)) {
            image = null;
          }
        } else {
          image = null;
        }
        return {
          front: String(card?.front || "").trim(),
          back: String(card?.back || "").trim(),
          hint: String(card?.hint || "").trim(),
          image
        };
      })
      .filter((card) => card.front && card.back)
  };
}
