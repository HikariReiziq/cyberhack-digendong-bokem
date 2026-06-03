import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["framer-motion"],
  typescript: {
    // WASM SWC (native bindings not available) crashes the TS checker.
    // Run `npx tsc --noEmit` separately to verify types.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
