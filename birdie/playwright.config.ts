import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the demo (mock) writer so they are fast,
 * deterministic and need no Claude credentials.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5199",
    ...devices["iPhone 13"],
    browserName: "chromium",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: [
    {
      command: "PORT=8799 BIRDIE_PROVIDER=mock npx tsx server/src/index.ts",
      url: "http://127.0.0.1:8799/api/health",
      reuseExistingServer: false,
    },
    {
      command: "cd web && BIRDIE_API=http://127.0.0.1:8799 npx vite --port 5199 --host 127.0.0.1 --strictPort",
      url: "http://127.0.0.1:5199",
      reuseExistingServer: false,
    },
  ],
});
