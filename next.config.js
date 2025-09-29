/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don’t fail production builds on ESLint warnings/errors.
  eslint: { ignoreDuringBuilds: true },

  // If you ever need to unblock TypeScript errors in prod builds, flip this:
  // typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
