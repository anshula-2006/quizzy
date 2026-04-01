import { useMemo, useState } from "react";

const INPUT_MODES = [
  { id: "text", title: "Topic", detail: "Type a topic or paste notes." },
  { id: "pdf", title: "PDF", detail: "Upload a PDF and extract questions." },
  { id: "url", title: "URL", detail: "Turn an article into a quiz." }
];

export default function InputSelector({
  onSubmit,
  submitLabel,
  showSettings = true,
  questionModeOptions = ["mcq", "mixed"],
  initialQuestionMode = "mcq",
  helperText = "Choose a source, add your content, and generate only when you are ready."
}) {
  const [inputMode, setInputMode] = useState("text");
  const [topic, setTopic] = useState("");
  const [url, setUrl] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [settings, setSettings] = useState({
    difficulty: "moderate",
    questionMode: initialQuestionMode,
    outputLanguage: "English"
  });
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    if (inputMode === "text") return topic.trim().length > 0;
    if (inputMode === "url") return /^https?:\/\//i.test(url.trim());
    return Boolean(pdfFile);
  }, [inputMode, topic, url, pdfFile]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Please add your study source first.");
      return;
    }
    setError("");
    try {
      await onSubmit({
        inputMode,
        values: {
          topic,
          url,
          pdfFile
        },
        settings
      });
    } catch (submitError) {
      setError(submitError.message || "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-[32px] p-6 sm:p-8">
      <div className="grid gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">Step 1</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {INPUT_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setInputMode(mode.id)}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  inputMode === mode.id
                    ? "border-cyan-300/60 bg-cyan-300/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-violet-300/40 hover:text-white"
                }`}
              >
                <span className="block text-sm font-black">{mode.title}</span>
                <span className="mt-1 block text-xs leading-5">{mode.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">Step 2</p>
          <div className="mt-3">
            {inputMode === "text" ? (
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Photosynthesis, recursion, Mughal Empire, your own notes..."
                className="min-h-[180px] w-full rounded-[28px] border border-white/10 bg-slate-950/35 px-5 py-4 text-base text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
              />
            ) : null}

            {inputMode === "url" ? (
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/article"
                className="w-full rounded-[24px] border border-white/10 bg-slate-950/35 px-5 py-4 text-base text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
              />
            ) : null}

            {inputMode === "pdf" ? (
              <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-white/15 bg-slate-950/30 px-6 py-8 text-center text-white/65">
                <span className="text-base font-bold text-white">Upload a PDF</span>
                <span className="mt-2 text-sm">Quizzy only reads the file you choose.</span>
                <span className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
                  {pdfFile ? pdfFile.name : "Choose PDF"}
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
                />
              </label>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-white/50">{helperText}</p>
        </div>

        {showSettings ? (
          <div className="grid gap-4 md:grid-cols-3">
            <label className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Difficulty</span>
              <select
                value={settings.difficulty}
                onChange={(event) => setSettings((current) => ({ ...current, difficulty: event.target.value }))}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-white outline-none"
              >
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="tough">Tough</option>
                <option value="super">Super</option>
              </select>
            </label>

            <label className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Question type</span>
              <select
                value={settings.questionMode}
                onChange={(event) => setSettings((current) => ({ ...current, questionMode: event.target.value }))}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-white outline-none"
              >
                {questionModeOptions.map((option) => (
                  <option key={option} value={option}>{option.toUpperCase()}</option>
                ))}
              </select>
            </label>

            <label className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Language</span>
              <select
                value={settings.outputLanguage}
                onChange={(event) => setSettings((current) => ({ ...current, outputLanguage: event.target.value }))}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-white outline-none"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Bengali">Bengali</option>
                <option value="Tamil">Tamil</option>
                <option value="Telugu">Telugu</option>
                <option value="Marathi">Marathi</option>
              </select>
            </label>
          </div>
        ) : null}

        {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">Step 3</p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-gradient-to-r from-brand to-accent px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
