import type { NextConfig } from "next";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/:file*',
        destination: '/:file*', // Serve from public/js/
      },
    ];
  },
};
export default nextConfig;