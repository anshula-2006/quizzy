import { useNavigate } from "react-router-dom";
import InputSelector from "../components/InputSelector.jsx";
import PageFrame from "../components/PageFrame.jsx";
import { useQuizApp } from "../state/QuizAppContext.jsx";

export default function GeneratePage() {
  const navigate = useNavigate();
  const { generateQuiz } = useQuizApp();

  async function handleGenerate(payload) {
    await generateQuiz(payload);
    navigate("/quiz");
  }

  return (
    <PageFrame
      eyebrow="Generate"
      title="Build a quiz in three quick steps"
      subtitle="No auto API calls, no preloaded questions, no clutter. Generate only when you choose to."
      narrow
    >
      <InputSelector onSubmit={handleGenerate} submitLabel="Generate Quiz" />
    </PageFrame>
  );
}
