export default function ProgressBar({ value, label }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
