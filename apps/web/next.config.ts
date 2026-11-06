import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const rawApi = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

if (isProd && !rawApi) {
  throw new Error(
    'Production build failed: API_URL environment variable is required for production deployment on Vercel. Please set API_URL in your Vercel project settings (e.g. https://api-eta-six-63.vercel.app).'
  );
}

const API = (rawApi || 'http://127.0.0.1:4000').replace(/\/+$/, '');

const config: NextConfig = {
  transpilePackages: ['@siescoms/certificate'],
  devIndicators: false,
  // The browser talks to one origin; Next forwards /api to the Express API.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
  experimental: { proxyClientMaxBodySize: '4.5mb' },
};

export default config;
