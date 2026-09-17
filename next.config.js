/** @type {import('next').NextConfig} */
const { version } = require("./package.json");

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // TypeScript 타입 에러가 있어도 빌드 차단 안 함
  typescript: {
    ignoreBuildErrors: true,
  },
  // ESLint 에러도 빌드 차단 안 함
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
