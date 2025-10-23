/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // typescript: { ignoreBuildErrors: true }, // keep strict by default

  async headers() {
    return [
      // Prevent caching for dynamic pages/assets we want to see update immediately
      {
        source: "/((?!_next/).*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      // Let Next.js build assets stay cached and immutable
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

module.exports = nextConfig;
