FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/api/package.json ./packages/api/
RUN pnpm install --frozen-lockfile --filter @clawops/api

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/api/ ./packages/api/
RUN pnpm --filter @clawops/api build

# Runtime
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY packages/api/package.json ./packages/api/
COPY packages/api/drizzle.config.ts ./packages/api/
COPY packages/api/src/db/schema.ts ./packages/api/src/db/schema.ts

RUN mkdir -p /app/data

WORKDIR /app/packages/api

EXPOSE 3001

CMD ["sh", "-c", "pnpm db:push && node dist/server.js"]
