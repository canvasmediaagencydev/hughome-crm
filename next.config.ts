import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";

// Validate all env at the earliest possible point of any Next command
// (build / dev / start). next.config is evaluated before route modules are
// collected, so a missing/invalid env fails here with a clear, named list
// (src/config/env.ts) instead of a later, cryptic "supabaseUrl is required"
// from a Supabase client instantiated at module top-level in an API route.
// MIGRATION_PLAN.md §3 / Sprint 0 item 3: "fail ตอน boot ให้เร็วที่สุด".
import "./src/config/env";

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Basic performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Disable caching for admin pages
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
        ],
      },
    ]
  },

  // Image optimization
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'profile.line-scdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  
  // Enable React strict mode
  reactStrictMode: true,
};

export default withBundleAnalyzer(nextConfig);
