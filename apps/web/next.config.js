/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@clawops/core"],
};

module.exports = nextConfig;
