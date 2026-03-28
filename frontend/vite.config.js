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
