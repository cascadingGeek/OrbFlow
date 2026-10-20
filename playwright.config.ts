import { defineConfig, devices } from "@playwright/test";

// Browser tests over the built bundle (dist/). Run with `npm run test:e2e`,
// which builds first. `npm test` (Jest) never reads dist/.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./e2e/globalSetup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "line",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 900, height: 700 },
      },
    },
  ],
});
