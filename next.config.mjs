// @ts-check
// Next.js 15 + React 19 config for @opennextjs/cloudflare deployment.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // OpenNext for Cloudflare handles its own runtime targeting.
  images: { unoptimized: true }
};

export default nextConfig;
