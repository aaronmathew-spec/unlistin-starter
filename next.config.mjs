export default {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: [process.env.NEXT_PUBLIC_SITE_URL || ''] } }
};
