import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "themes.rockbox.org",
        pathname: "/themes/**",
      },
    ],
  },
};

export default nextConfig;
