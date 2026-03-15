import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: {
    position: 'bottom-right'
  },
  env: {
    APP_VERSION: packageJson.version,
  },
};

export default nextConfig;
