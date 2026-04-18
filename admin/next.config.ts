import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "bug-free-fiesta-69xwgg4jwj6r34gpv-3000.app.github.dev",
        "localhost:3000",
      ],
    },
  },
};
export default nextConfig;
