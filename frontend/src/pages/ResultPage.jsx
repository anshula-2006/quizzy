import { Navigate, useNavigate } from "react-router-dom";
import PageFrame from "../components/PageFrame.jsx";
import ResultScreen from "../components/ResultScreen.jsx";
import { useQuizApp } from "../state/QuizAppContext.jsx";

export default function ResultPage() {
  const navigate = useNavigate();
  const { resultState, retryQuiz, clearQuiz } = useQuizApp();

  if (!resultState) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageFrame
      eyebrow="Result"
      title="That run is locked in"
      subtitle="Results only appear after a real attempt. No result card is shown on initial load."
      narrow
    >
      <ResultScreen
        result={resultState}
        onRetry={() => {
          retryQuiz();
          navigate("/quiz");
        }}
        onNewQuiz={() => {
          clearQuiz();
          navigate("/generate");
        }}
      />
    </PageFrame>
  );
}
