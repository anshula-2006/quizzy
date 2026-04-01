import { motion } from "framer-motion";

function feedbackText(percentage) {
  if (percentage >= 90) return "Nice! You're sharp 😏";
  if (percentage >= 75) return "Strong run. You're warming up fast.";
  if (percentage >= 60) return "Good momentum. One more round will feel even better.";
  return "You’ve got this. Try again and level up.";
}

export default function ResultScreen({ result, onRetry, onNewQuiz }) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel mx-auto max-w-4xl rounded-[36px] p-8 text-center"
    >
      <span className="inline-flex rounded-full bg-emerald-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-100">
        Quiz complete
      </span>
      <h3 className="mt-5 text-4xl font-black text-white sm:text-6xl">{result.score}/{result.total} 🎯</h3>
      <p className="mt-4 text-lg font-semibold text-white/80">{feedbackText(result.percentage)}</p>
      <p className="mt-2 text-sm leading-6 text-white/60">Accuracy: {result.percentage}%</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Correct</p>
          <strong className="mt-2 block text-2xl font-black text-white">{result.score}</strong>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Wrong</p>
          <strong className="mt-2 block text-2xl font-black text-white">{Math.max(0, result.total - result.score)}</strong>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Confidence</p>
          <strong className="mt-2 block text-2xl font-black text-white">{result.confidence || 0}%</strong>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-gradient-to-r from-brand to-accent px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:scale-[1.02]"
        >
          Retry Quiz
        </button>
        <button
          type="button"
          onClick={onNewQuiz}
          className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          New Quiz
        </button>
      </div>
    </motion.section>
  );
}
