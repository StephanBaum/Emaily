/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@emailautomation/database",
    "@emailautomation/shared",
  ],
};

module.exports = nextConfig;
