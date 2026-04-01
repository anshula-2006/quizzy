import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageFrame from "../components/PageFrame.jsx";
import QuestionCard from "../components/QuestionCard.jsx";
import { useQuizApp } from "../state/QuizAppContext.jsx";

function timerForQuestion(question, difficulty) {
  if (question.type !== "mcq") return null;
  if (difficulty === "easy") return 36;
  if (difficulty === "tough") return 24;
  if (difficulty === "super") return 20;
  return 30;
}

export default function QuizPage() {
  const navigate = useNavigate();
  const { quizState, answerQuestion, nextQuestion, previousQuestion, finishQuiz } = useQuizApp();
  const [shortValue, setShortValue] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [timer, setTimer] = useState(0);

  const question = quizState?.questions?.[quizState?.currentIndex ?? 0];
  const currentAnswer = quizState?.answers?.[quizState?.currentIndex ?? 0] || null;
  const difficulty = quizState?.request?.settings?.difficulty || "moderate";

  useEffect(() => {
    if (!question) return;
    setRevealed(Boolean(currentAnswer));
    setShortValue(currentAnswer?.selected || "");
    setTimer(timerForQuestion(question, difficulty) ?? 0);
  }, [question, currentAnswer, difficulty]);

  useEffect(() => {
    if (!question || question.type !== "mcq" || revealed) return undefined;
    if (timer <= 0) {
      answerQuestion({ answer: "" });
      setRevealed(true);
      return undefined;
    }
    const id = window.setTimeout(() => setTimer((current) => current - 1), 1000);
    return () => window.clearTimeout(id);
  }, [question, revealed, timer, answerQuestion]);

  const feedback = useMemo(() => currentAnswer, [currentAnswer]);

  if (!quizState?.questions?.length) {
    return <Navigate to="/generate" replace />;
  }

  async function handleNext() {
    const isLast = quizState.currentIndex >= quizState.questions.length - 1;
    if (isLast) {
      await finishQuiz();
      navigate("/result");
      return;
    }
    nextQuestion();
  }

  function handleMcqAnswer(answer) {
    if (revealed) return;
    answerQuestion({ answer });
    setRevealed(true);
  }

  function handleShortSubmit() {
    if (revealed || !shortValue.trim()) return;
    answerQuestion({ answer: shortValue.trim() });
    setRevealed(true);
  }

  return (
    <PageFrame
      eyebrow="Quiz"
      title="One question at a time"
      subtitle="If quiz data does not exist, this page redirects back to the generator."
    >
      <AnimatePresence mode="wait">
        <QuestionCard
          key={quizState.currentIndex}
          question={question}
          index={quizState.currentIndex}
          total={quizState.questions.length}
          selectedAnswer={currentAnswer?.selected || ""}
          revealed={revealed}
          feedback={feedback}
          timer={timer}
          onAnswer={handleMcqAnswer}
          onShortSubmit={handleShortSubmit}
          onNext={handleNext}
          onPrev={previousQuestion}
          shortValue={shortValue}
          setShortValue={setShortValue}
          canGoNext={revealed}
        />
      </AnimatePresence>
    </PageFrame>
  );
}
