import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import { resolve } from "path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const proxyTarget = process.env.VITE_API_PROXY_TARGET || "https://quizzy-3lt0.onrender.com";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        generate: resolve(rootDir, "generate.html"),
        quiz: resolve(rootDir, "quiz.html"),
        result: resolve(rootDir, "result.html"),
        flashcards: resolve(rootDir, "flashcards.html"),
        arcade: resolve(rootDir, "arcade.html"),
        dashboard: resolve(rootDir, "dashboard.html"),
        memory: resolve(rootDir, "games/memory.html"),
        reaction: resolve(rootDir, "games/reaction.html"),
        recall: resolve(rootDir, "games/recall.html"),
        login: resolve(rootDir, "login.html"),
        register: resolve(rootDir, "register.html"),
        scoreboard: resolve(rootDir, "scoreboard.html")
      }
    }
  },
  server: {
    proxy: {
      "/auth": {
        target: proxyTarget,
        changeOrigin: true
      },
      "/extract-content": {
        target: proxyTarget,
        changeOrigin: true
      },
      "/data": {
        target: proxyTarget,
        changeOrigin: true
      },
      "/generate-quiz": {
        target: proxyTarget,
        changeOrigin: true
      },
      "/generate-flashcards": {
        target: proxyTarget,
        changeOrigin: true
      },
      "/submit-quiz": {
        target: proxyTarget,
        changeOrigin: true
      }
    }
  }
});
