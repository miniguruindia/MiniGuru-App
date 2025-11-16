import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
   remotePatterns: [
    {
      protocol: 'http',
      hostname: '203.18.51.39',
      port: '443'
    }
   ]

  },
  basePath: '/dashboard',
  experimental: {
    serverActions:{
      allowedOrigins : ['http://203.18.51.39:443']
    }
  },
};

export default nextConfig;
