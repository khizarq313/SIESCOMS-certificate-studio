import type { NextConfig } from 'next';

const API = process.env.API_URL || 'http://127.0.0.1:4000';

const config: NextConfig = {
  transpilePackages: ['@siescoms/certificate'],
  devIndicators: false,
  // The browser talks to one origin; Next forwards /api to the Express API.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
  experimental: { proxyClientMaxBodySize: '30mb' },
};

export default config;
