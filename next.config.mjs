// next.config.mjs
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  // options: { remarkPlugins: [], rehypePlugins: [] }
});

const nextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  eslint: {
    // Allow production builds to succeed even if there are ESLint errors.
    // We still run `npm run lint` in CI, but this prevents `next build` from failing.
    ignoreDuringBuilds: true,
  },
  // If you ever need to unblock on TS too, uncomment next block (not needed now):
  // typescript: { ignoreBuildErrors: true },
};

export default withMDX(nextConfig);
