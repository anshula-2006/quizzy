import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/auth": {
        target: "https://quizzy-3lt0.onrender.com",
        changeOrigin: true
      },
      "/extract-content": {
        target: "https://quizzy-3lt0.onrender.com",
        changeOrigin: true
      },
      "/generate-quiz": {
        target: "https://quizzy-3lt0.onrender.com",
        changeOrigin: true
      }
    }
  }
});
