import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
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
