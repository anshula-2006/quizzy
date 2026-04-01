import { useState } from "react";
import ArcadeGameCard from "../components/ArcadeGameCard.jsx";
import FlashcardPlayer from "../components/FlashcardPlayer.jsx";
import InputSelector from "../components/InputSelector.jsx";
import PageFrame from "../components/PageFrame.jsx";
import RapidQuizPlayer from "../components/RapidQuizPlayer.jsx";
import { useQuizApp } from "../state/QuizAppContext.jsx";

export default function ArcadePage() {
  const { generateArcadeFlashcards, generateArcadeQuiz } = useQuizApp();
  const [mode, setMode] = useState(null);
  const [flashcards, setFlashcards] = useState(null);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quickQuiz, setQuickQuiz] = useState(null);
  const [speedQuiz, setSpeedQuiz] = useState(null);

  function resetArcade() {
    setMode(null);
    setFlashcards(null);
    setFlashIndex(0);
    setFlipped(false);
    setQuickQuiz(null);
    setSpeedQuiz(null);
  }

  async function handleFlashcards(payload) {
    const nextFlashcards = await generateArcadeFlashcards(payload);
    setFlashcards(nextFlashcards);
    setFlashIndex(0);
    setFlipped(false);
  }

  async function handleQuickQuiz(payload) {
    const questions = await generateArcadeQuiz({
      ...payload,
      settings: { ...payload.settings, questionMode: "mcq", difficulty: "moderate" },
      questionCount: 5
    });
    setQuickQuiz(questions.filter((question) => question.type === "mcq"));
  }

  async function handleSpeedQuiz(payload) {
    const questions = await generateArcadeQuiz({
      ...payload,
      settings: { ...payload.settings, questionMode: "mcq", difficulty: "super" },
      questionCount: 5
    });
    setSpeedQuiz(questions.filter((question) => question.type === "mcq"));
  }

  return (
    <PageFrame
      eyebrow="Arcade"
      title="Mini Arcade 🎮"
      subtitle="Play & Learn. The arcade starts empty and only loads a mode after you choose one."
    >
      {!mode ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <ArcadeGameCard
            title="Flashcards Mode"
            emoji="🧠"
            detail="Generate a fresh flashcard deck, then flip one card at a time in the center stage."
            onClick={() => setMode("flashcards")}
          />
          <ArcadeGameCard
            title="Quick Quiz"
            emoji="⚡"
            detail="Short rapid-fire quiz rounds with instant score updates and animated feedback."
            onClick={() => setMode("quick")}
            tone="cyan"
          />
          <ArcadeGameCard
            title="Speed Challenge"
            emoji="⏱"
            detail="A harder arcade mode with less time per question and sharper pressure."
            onClick={() => setMode("speed")}
            tone="emerald"
          />
        </div>
      ) : null}

      {mode === "flashcards" && !flashcards ? (
        <div className="mt-8">
          <InputSelector onSubmit={handleFlashcards} submitLabel="Generate Flashcards" />
        </div>
      ) : null}

      {mode === "flashcards" && flashcards ? (
        <div className="mt-8">
          <FlashcardPlayer
            flashcards={flashcards}
            index={flashIndex}
            flipped={flipped}
            onFlip={() => setFlipped((current) => !current)}
            onNext={() => {
              if (flashIndex >= flashcards.length - 1) {
                setFlashIndex(0);
                setFlipped(false);
                return;
              }
              setFlashIndex((current) => current + 1);
              setFlipped(false);
            }}
            onReset={resetArcade}
          />
        </div>
      ) : null}

      {mode === "quick" && !quickQuiz ? (
        <div className="mt-8">
          <InputSelector
            onSubmit={handleQuickQuiz}
            submitLabel="Start Quick Quiz"
            questionModeOptions={["mcq"]}
            initialQuestionMode="mcq"
          />
        </div>
      ) : null}

      {mode === "quick" && quickQuiz ? (
        <div className="mt-8">
          <RapidQuizPlayer questions={quickQuiz} title="Quick Quiz" timePerQuestion={12} onExit={resetArcade} />
        </div>
      ) : null}

      {mode === "speed" && !speedQuiz ? (
        <div className="mt-8">
          <InputSelector
            onSubmit={handleSpeedQuiz}
            submitLabel="Start Speed Challenge"
            questionModeOptions={["mcq"]}
            initialQuestionMode="mcq"
            helperText="Generate a harder timed run. No default arcade questions appear until you start."
          />
        </div>
      ) : null}

      {mode === "speed" && speedQuiz ? (
        <div className="mt-8">
          <RapidQuizPlayer questions={speedQuiz} title="Speed Challenge" timePerQuestion={7} onExit={resetArcade} />
        </div>
      ) : null}
    </PageFrame>
  );
}
