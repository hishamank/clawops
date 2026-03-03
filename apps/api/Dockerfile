# ---- Base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY apps/api/ ./apps/api/
RUN pnpm turbo build --filter=@clawops/api...

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -S clawops && adduser -S clawops -G clawops

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/node_modules ./node_modules

USER clawops

EXPOSE 3001
CMD ["node", "dist/index.js"]
