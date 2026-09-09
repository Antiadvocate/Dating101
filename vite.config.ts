import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// base "./" so the built bundle works from a user root or a project subpath with no
// per-repo configuration — same trick Weft uses for GitHub Pages.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@weft": fileURLToPath(new URL("./vendor/weft/src", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: { target: "es2022", chunkSizeWarningLimit: 2400 },
});
