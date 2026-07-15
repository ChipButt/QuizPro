import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/QuizPro/" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: resolve(__dirname, "index.dev.html"),
    },
  },
}));
