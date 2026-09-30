import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Which release this build is. A page left open compares it with the
    // server's (/api/version) to notice that a newer one has gone live.
    NEXT_PUBLIC_BUILD_VERSION: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  },
};

export default nextConfig;
