require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env.local"),
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@emaily/database",
    "@emaily/shared",
    "@emaily/security",
    "@emaily/mail-engine",
    "@emaily/ai-engine",
  ],
  serverExternalPackages: [
    "bcrypt",
    "imapflow",
    "nodemailer",
    "mailparser",
  ],
};

module.exports = nextConfig;
