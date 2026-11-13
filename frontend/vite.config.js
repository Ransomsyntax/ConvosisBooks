import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(frontendRoot, "react"),
  base: "/static/books/react/",
  build: {
    outDir: resolve(frontendRoot, "dist"),
    emptyOutDir: true,
  },
});
