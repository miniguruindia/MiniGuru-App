import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.app.github.dev',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      }
    ]
  },
};

export default nextConfig;
