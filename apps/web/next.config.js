/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "better-sqlite3",
    "@clawops/core",
    "@clawops/agents",
    "@clawops/tasks",
    "@clawops/projects",
    "@clawops/ideas",
    "@clawops/habits",
    "@clawops/analytics",
    "@clawops/notifications",
    "@clawops/sync",
  ],
};

module.exports = nextConfig;
