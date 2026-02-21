import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import { resolve } from "path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        login: resolve(rootDir, "login.html"),
        register: resolve(rootDir, "register.html")
      }
    }
  },
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
