import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ABII_PLAYWRIGHT_PORT ?? 4174);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node --conditions=react-server --import ./scripts/register-typescript.mjs ./tests/e2e/fixtures/server.mjs",
    url: `${baseURL}/login`,
    env: { ABII_PLAYWRIGHT_PORT: String(port) },
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
