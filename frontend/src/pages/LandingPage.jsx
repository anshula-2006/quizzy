import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel grid-bg w-full rounded-[40px] px-6 py-12 text-center sm:px-10 sm:py-16"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-cyan-200">Quizzy</p>
        <h2 className="mt-6 text-balance text-5xl font-black text-white sm:text-7xl">Quizzy 🧠⚡</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/70">Test your brain in seconds</p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/generate"
            className="rounded-full bg-gradient-to-r from-brand to-accent px-8 py-4 text-base font-black text-white transition hover:-translate-y-0.5 hover:scale-[1.02]"
          >
            Start Quiz
          </Link>
          <Link
            to="/arcade"
            className="rounded-full border border-white/10 bg-white/5 px-8 py-4 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            Mini Arcade 🎮
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
