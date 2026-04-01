export default function PageFrame({ eyebrow, title, subtitle, children, narrow = false }) {
  return (
    <section className={`mx-auto w-full ${narrow ? "max-w-4xl" : "max-w-6xl"}`}>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-200">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/65">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
