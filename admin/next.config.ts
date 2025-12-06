/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Fix for GitHub Codespaces header mismatch
  experimental: {
    serverActions: {
      // Allow server actions from forwarded hosts
      allowedOrigins: [
        'localhost:3000',
        '*.github.dev',
        'bug-free-fiesta-69xwgg4jwj6r34gpv-3000.app.github.dev',
      ],
    },
  },

  // Trust proxy headers from GitHub Codespaces
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },

  // Image configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Turbopack configuration
  turbopack: {
    root: '.',
  },
};

module.exports = nextConfig;