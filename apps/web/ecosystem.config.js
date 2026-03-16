const path = require('path');
const fs = require('fs');

// PM2 config runs from project root, so we need to find server.js dynamically
const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, 'apps/web/.next/standalone');

// Find server.js - it could be at root of standalone or in a nested worktree structure
function findServerJs(dir) {
  const directPath = path.join(dir, 'server.js');
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  
  const worktreeDir = path.join(dir, 'worktrees');
  if (fs.existsSync(worktreeDir)) {
    const subdirs = fs.readdirSync(worktreeDir);
    for (const subdir of subdirs) {
      const candidate = path.join(dir, 'worktrees', subdir, 'apps', 'web', 'server.js');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  
  return directPath; // fallback
}

const serverPath = findServerJs(standaloneDir);

module.exports = {
  apps: [
    {
      name: 'clawops-web',
      cwd: standaloneDir,
      script: 'node',
      args: serverPath,
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.WEB_PORT || 3333,
        CLAWOPS_MODE: 'local',
        CLAWOPS_DB_PATH: process.env.CLAWOPS_DB_PATH || './clawops.db',
      },
      error_file: path.join(projectRoot, 'logs/clawops-web-error.log'),
      out_file: path.join(projectRoot, 'logs/clawops-web-out.log'),
      log_file: path.join(projectRoot, 'logs/clawops-web-combined.log'),
      time: true,
    },
  ],
};
