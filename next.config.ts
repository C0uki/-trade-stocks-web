import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ゲーム画面はすべてリクエスト時にセッションを読むので、Cache Components は使わない
  cacheComponents: false,
  serverExternalPackages: ["yahoo-finance2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
