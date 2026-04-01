import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import ProgressBar from "./ProgressBar.jsx";

export default function RapidQuizPlayer({
  questions,
  title,
  timePerQuestion,
  onExit
}) {
  const [index, setIndex] = useState(0);
  const [timer, setTimer] = useState(timePerQuestion);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const question = questions[index];

  useEffect(() => {
    if (revealed) return undefined;
    if (timer <= 0) {
      setRevealed(true);
      return undefined;
    }
    const id = window.setTimeout(() => setTimer((current) => current - 1), 1000);
    return () => window.clearTimeout(id);
  }, [timer, revealed]);

  function handleAnswer(optionKey) {
    if (revealed) return;
    setSelected(optionKey);
    if (optionKey === question.correct) {
      setScore((current) => current + 1);
    }
    setRevealed(true);
  }

  function goNext() {
    if (index === questions.length - 1) {
      setIndex(0);
      setTimer(timePerQuestion);
      setScore(0);
      setSelected(null);
      setRevealed(false);
      return;
    }
    setIndex((current) => current + 1);
    setTimer(timePerQuestion);
    setSelected(null);
    setRevealed(false);
  }

  const progress = Math.round(((index + 1) / questions.length) * 100);

  return (
    <div className="glass-panel rounded-[36px] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">{title}</p>
          <h3 className="mt-2 text-3xl font-black text-white">Score {score}</h3>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Pick another mode
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <ProgressBar value={progress} label="Round progress" />
        <div className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Timer</p>
          <strong className="mt-2 block text-3xl font-black text-white">{timer}s</strong>
        </div>
      </div>

      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8"
      >
        <div className="rounded-[30px] bg-gradient-to-br from-violet-500/18 to-cyan-400/10 p-6">
          <h4 className="text-2xl font-black text-white">{question.question}</h4>
        </div>

        <div className="mt-6 grid gap-4">
          {question.options.map((option, optionIndex) => {
            const optionKey = String.fromCharCode(65 + optionIndex);
            const isCorrect = revealed && optionKey === question.correct;
            const isWrong = revealed && selected === optionKey && optionKey !== question.correct;

            return (
              <button
                key={optionKey}
                type="button"
                disabled={revealed}
                onClick={() => handleAnswer(optionKey)}
                className={`rounded-[26px] border px-5 py-4 text-left transition ${
                  isCorrect
                    ? "border-emerald-300/60 bg-emerald-400/15 text-white"
                    : isWrong
                      ? "border-rose-300/60 bg-rose-400/15 text-white"
                      : "border-white/10 bg-white/5 text-white hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-cyan-100">
                    {optionKey}
                  </span>
                  <span className="font-semibold">{option}</span>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>

      {revealed ? (
        <div className={`mt-6 rounded-[24px] border p-4 ${selected === question.correct ? "border-emerald-300/25 bg-emerald-400/10" : "border-rose-300/25 bg-rose-400/10"}`}>
          <p className="text-sm font-black text-white">{selected === question.correct ? "Correct ✅" : "Wrong ❌"}</p>
          <button
            type="button"
            onClick={goNext}
            className="mt-4 rounded-full bg-gradient-to-r from-brand to-accent px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:scale-[1.02]"
          >
            {index === questions.length - 1 ? "Play Again" : "Next"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
