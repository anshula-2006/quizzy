import { motion } from "framer-motion";
import { useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { useQuizApp } from "../state/QuizAppContext.jsx";

function navClass({ isActive }) {
  return `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive
      ? "bg-white text-slate-950"
      : "border border-white/10 bg-white/5 text-white/75 hover:border-cyan-300/40 hover:text-white"
  }`;
}

export default function AppShell({ children }) {
  const { user, refreshUser, logout, loading } = useQuizApp();

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-20 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute right-[12%] top-24 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="glass-panel sticky top-4 z-30 mb-6 rounded-[28px] px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-accent text-xl font-black text-white">
                Q
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-200">Quizzy</p>
                <h1 className="text-lg font-black text-white sm:text-xl">AI Quiz Generator</h1>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <NavLink to="/" className={navClass} end>Home</NavLink>
              <NavLink to="/generate" className={navClass}>Generate</NavLink>
              <NavLink to="/arcade" className={navClass}>Arcade</NavLink>
              <a href="./scoreboard.html" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-cyan-300/40 hover:text-white">Leaderboard</a>
              {user ? (
                <>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80">
                    {user.name || user.email || "Player"}
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-full border border-rose-300/20 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <a href="./login.html" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-cyan-300/40 hover:text-white">Login</a>
                  <a href="./register.html" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:scale-[1.02]">Register</a>
                </>
              )}
            </div>
          </div>
        </header>

        <motion.main
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.28 }}
          className="flex-1"
        >
          {children}
        </motion.main>
      </div>

      {loading ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm">
          <div className="glass-panel rounded-[28px] px-8 py-6 text-center text-white">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-cyan-300" />
            <p className="mt-4 text-sm font-semibold tracking-[0.18em] text-white/70">Quizzy is loading</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
