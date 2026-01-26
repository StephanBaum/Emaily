/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@email-ai/database", "@email-ai/ai"],
};

module.exports = nextConfig;
