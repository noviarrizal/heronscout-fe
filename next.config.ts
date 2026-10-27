import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Demo previews are read from disk when there's no database.
  outputFileTracingIncludes: {
    "/p/[slug]": ["./fixtures/previews/**/*"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
