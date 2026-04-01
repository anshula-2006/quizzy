import { motion } from "framer-motion";

export default function FlashcardPlayer({
  flashcards,
  index,
  flipped,
  onFlip,
  onNext,
  onReset
}) {
  const card = flashcards[index];

  return (
    <div className="glass-panel rounded-[36px] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Flashcards mode</p>
          <h3 className="mt-2 text-3xl font-black text-white">Card {index + 1}/{flashcards.length}</h3>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Pick another mode
        </button>
      </div>

      <div className="mt-8 flex justify-center">
        <div className="w-full max-w-2xl [perspective:1400px]">
          <motion.button
            type="button"
            onClick={onFlip}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.55 }}
            className="relative h-[360px] w-full rounded-[36px] text-left [transform-style:preserve-3d]"
          >
            <div className="absolute inset-0 rounded-[36px] border border-white/10 bg-gradient-to-br from-violet-500/20 to-cyan-400/10 p-8 [backface-visibility:hidden]">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-200">Question</p>
              <div className="mt-8 flex h-[230px] items-center justify-center">
                <h4 className="text-center text-3xl font-black leading-tight text-white">{card.front}</h4>
              </div>
            </div>
            <div className="absolute inset-0 rounded-[36px] border border-white/10 bg-gradient-to-br from-cyan-400/20 to-emerald-400/10 p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Answer</p>
              <div className="mt-8 flex h-[230px] items-center justify-center">
                <div className="text-center">
                  <h4 className="text-3xl font-black leading-tight text-white">{card.back}</h4>
                  {card.hint ? <p className="mt-4 text-sm text-white/65">{card.hint}</p> : null}
                </div>
              </div>
            </div>
          </motion.button>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onFlip}
          className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Flip
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-full bg-gradient-to-r from-brand to-accent px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:scale-[1.02]"
        >
          {index === flashcards.length - 1 ? "Restart Deck" : "Next"}
        </button>
      </div>
    </div>
  );
}
