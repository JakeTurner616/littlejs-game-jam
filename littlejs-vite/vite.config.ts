  import { defineConfig } from "vite";
  export default defineConfig({
    optimizeDeps: {
      exclude: ["public/*"], // Excludes files within the "public" directory
    },
  });