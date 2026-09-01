import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  // Don't load the app's Tailwind PostCSS config into the test runner.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789",
      BETTER_AUTH_URL: "http://localhost:3000",
      ADMIN_EMAILS: "admin@example.com",
      AI_MODEL: "claude-sonnet-5",
      NODE_ENV: "test",
    },
  },
});
