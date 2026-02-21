import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/": {
        target: "https://quizzy-3lt0.onrender.com",
        changeOrigin: true
      }
    }
  }
});