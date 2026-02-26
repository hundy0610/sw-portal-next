/** @type {import('next').NextConfig} */
const nextConfig = {
  // Notion 이미지 도메인 허용
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.notion.so" },
      { protocol: "https", hostname: "notion.so" },
    ],
  },
};

module.exports = nextConfig;
