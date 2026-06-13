import type { NextConfig } from "next";
import path from "path";

// LAN IPs for dev access from phones/tablets on the same network.
// Next.js matches these against the Origin header on HMR WebSocket connections.
// Override/extend via DEV_ORIGINS env var (comma-separated hostnames).
const devOrigins = [
  '172.20.10.2',   // iPhone hotspot LAN IP
  ...(process.env.DEV_ORIGINS
    ? process.env.DEV_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : []),
]

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ['better-sqlite3'],
  allowedDevOrigins: devOrigins,
};

export default nextConfig; 