import type { NextConfig } from "next";
import path from "path";

const devOrigins = process.env.DEV_ORIGINS
  ? process.env.DEV_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : []

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ['better-sqlite3'],
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
};

export default nextConfig;
