import type { NextConfig } from "next";
const api = process.env.INTERNAL_API_URL ?? "http://localhost:4000";
const config: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/health", destination: `${api}/health` },
      { source: "/ready", destination: `${api}/ready` },
    ];
  },
};
export default config;
