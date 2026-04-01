import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import GeneratePage from "./pages/GeneratePage.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import ResultPage from "./pages/ResultPage.jsx";
import ArcadePage from "./pages/ArcadePage.jsx";

export default function App() {
  const location = useLocation();

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/arcade" element={<ArcadePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  );
}
