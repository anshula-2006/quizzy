import { motion } from "framer-motion";
import ProgressBar from "./ProgressBar.jsx";

export default function QuestionCard({
  question,
  index,
  total,
  selectedAnswer,
  revealed,
  feedback,
  timer,
  onAnswer,
  onShortSubmit,
  onNext,
  onPrev,
  shortValue,
  setShortValue,
  canGoNext
}) {
  const progress = Math.round(((index + 1) / total) * 100);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.24 }}
      className="glass-panel rounded-[36px] p-6 sm:p-8"
    >
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200">Quiz mode</p>
          <h3 className="mt-3 text-2xl font-black text-white sm:text-4xl">Question {index + 1}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
            {question.type.toUpperCase()}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
            {question.type === "mcq" ? `${timer}s left` : "No timer"}
          </span>
        </div>
      </div>

      <ProgressBar value={progress} label="Progress" />

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[30px] bg-gradient-to-br from-violet-500/18 to-cyan-400/10 p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100/70">Focus prompt</p>
          <h4 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">{question.question}</h4>
          <p className="mt-4 text-sm leading-6 text-white/65">Stay in the zone and answer one challenge at a time.</p>
        </div>

        <div className="space-y-4">
          {question.type === "mcq" ? (
            question.options.map((option, optionIndex) => {
              const optionKey = String.fromCharCode(65 + optionIndex);
              const isCorrect = revealed && question.correct === optionKey;
              const isWrong = revealed && selectedAnswer === optionKey && !feedback?.isCorrect;

              return (
                <button
                  key={optionKey}
                  type="button"
                  onClick={() => onAnswer(optionKey)}
                  disabled={revealed}
                  className={`w-full rounded-[28px] border px-5 py-5 text-left transition ${
                    isCorrect
                      ? "border-emerald-300/60 bg-emerald-400/15 text-white"
                      : isWrong
                        ? "border-rose-300/60 bg-rose-400/15 text-white"
                        : "border-white/10 bg-white/5 text-white hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-cyan-100">
                      {optionKey}
                    </span>
                    <span className="text-base font-semibold">{option}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <textarea
                value={shortValue}
                onChange={(event) => setShortValue(event.target.value)}
                disabled={revealed}
                placeholder="Type your answer here..."
                className="min-h-[180px] w-full rounded-[24px] border border-white/10 bg-slate-950/35 px-5 py-4 text-base text-white outline-none placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={onShortSubmit}
                disabled={revealed || !shortValue.trim()}
                className="mt-4 rounded-full bg-gradient-to-r from-brand to-accent px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Lock Answer
              </button>
            </div>
          )}
        </div>
      </div>

      {feedback ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-6 rounded-[28px] border p-5 ${
            feedback.isCorrect
              ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-50"
              : "border-rose-300/25 bg-rose-400/10 text-rose-50"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-lg font-black">{feedback.isCorrect ? "Correct ✅" : "Wrong ❌"}</span>
            <span className="text-sm font-semibold">
              {question.type === "short" ? `Answer: ${question.shortAnswer}` : `Correct option: ${question.correct}`}
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-white/85">{question.explanation || "No explanation available."}</p>
          {!feedback.isCorrect && question.wrongExplanation ? (
            <p className="mt-3 text-sm leading-6 text-white/75">{question.wrongExplanation}</p>
          ) : null}
        </motion.div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="rounded-full bg-gradient-to-r from-brand to-accent px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </motion.section>
  );
}
