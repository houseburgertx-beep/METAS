import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "/METAS/",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(process.cwd()) } },
  define: {
    "process.env.NEXT_PUBLIC_FIREBASE_API_KEY": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID": JSON.stringify(""),
  },
  build: {
    outDir: "github-pages",
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(process.cwd(), "github-index.html") },
  },
});
