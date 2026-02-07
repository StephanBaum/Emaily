/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@emailautomation/database",
    "@emailautomation/shared",
    "@emailautomation/security",
    "@emailautomation/mail-engine",
  ],
  experimental: {
    serverComponentsExternalPackages: [
      "bcrypt",
      "imapflow",
      "nodemailer",
      "mailparser",
    ],
  },
};

module.exports = nextConfig;
