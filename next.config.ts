import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Drizzle/postgres client must run in the Node.js runtime, never the Edge runtime.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
