import { motion } from "framer-motion";

export default function ArcadeGameCard({ title, emoji, detail, onClick, tone = "violet" }) {
  const toneClass = tone === "cyan"
    ? "from-cyan-400/20 to-sky-400/10 hover:border-cyan-300/50"
    : tone === "emerald"
      ? "from-emerald-400/20 to-lime-400/10 hover:border-emerald-300/50"
      : "from-violet-500/20 to-fuchsia-400/10 hover:border-violet-300/50";

  return (
    <motion.button
      type="button"
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`glass-panel rounded-[30px] bg-gradient-to-br ${toneClass} p-6 text-left transition`}
    >
      <span className="text-4xl">{emoji}</span>
      <h3 className="mt-6 text-2xl font-black text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/65">{detail}</p>
      <span className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
        Play now
      </span>
    </motion.button>
  );
}
