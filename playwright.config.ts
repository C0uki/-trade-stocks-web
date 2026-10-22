import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 300_000,
  // 開発サーバーは初回アクセス時にページをコンパイルするので待ち時間を長めにする
  expect: { timeout: 60_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : undefined,
    viewport: { width: 1400, height: 1000 },
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: { AUTH_DEV_LOGIN: "1" },
  },
});
