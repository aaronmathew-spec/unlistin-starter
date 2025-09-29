// next.config.mjs
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  // (optional) you can add remark/rehype plugins here
  // options: { remarkPlugins: [], rehypePlugins: [] }
});

const nextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"]
};

export default withMDX(nextConfig);
