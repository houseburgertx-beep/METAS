import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "/METAS/",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(process.cwd()) } },
  define: {
    "process.env.NEXT_PUBLIC_FIREBASE_API_KEY": JSON.stringify("AIzaSyAgC-IE5bdMih5DLoeX_kY9052fqWQvNtk"),
    "process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN": JSON.stringify("house-gestao-49587.firebaseapp.com"),
    "process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID": JSON.stringify("house-gestao-49587"),
    "process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": JSON.stringify("house-gestao-49587.firebasestorage.app"),
    "process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify("562324931515"),
    "process.env.NEXT_PUBLIC_FIREBASE_APP_ID": JSON.stringify("1:562324931515:web:44a0aa995b116521933a9e"),
  },
  build: {
    outDir: "github-pages",
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(process.cwd(), "github-index.html") },
  },
});
