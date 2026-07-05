import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // Ignored because of internal Next.js 16 ResolvingMetadata error
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
