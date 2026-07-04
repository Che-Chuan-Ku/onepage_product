import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config — runs against the dev server with MSW enabled (backend not yet
 * online). Scenarios derived from specs/activities/*.mmd + specs/ui.
 *
 * PW_PORT: when another project's dev server already occupies :3000
 * (reuseExistingServer would silently test foreign code), set PW_PORT to a
 * free port so Playwright boots THIS repo's dev server there instead, e.g.
 * `PW_PORT=3001 npx playwright test`.
 */
const port = Number(process.env.PW_PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `PORT=${port} npm run dev`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
