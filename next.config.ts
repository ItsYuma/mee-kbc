import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "0.0.0.0", "*.local"],
  devIndicators: false,
};

export default nextConfig;
