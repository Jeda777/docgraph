# syntax=docker/dockerfile:1

# ---------- base ----------
FROM node:26.13.0-alpine AS base
# Toolchain used only if a native dependency (e.g. argon2) needs to compile from source.
# Node no longer bundles corepack, so it is installed first; it then runs the pnpm
# version pinned in the root package.json `packageManager` field.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apk add --no-cache python3 make g++ \
 && npm install -g corepack@0.36.0 \
 && corepack enable pnpm

# ---------- build ----------
FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/common/package.json packages/common/package.json
RUN pnpm install --frozen-lockfile
COPY . .
# Builds apps/web (static frontend) and apps/server (dist/index.js bundle)
RUN pnpm turbo run build --filter=server --filter=web

# ---------- runtime dependencies ----------
# Only native packages stay external in the server bundle; their exact versions
# are emitted during the build to dist/runtime-package.json.
FROM base AS runtime-deps
WORKDIR /runtime
COPY --from=build /app/apps/server/dist/runtime-package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

# ---------- runtime ----------
FROM node:26.13.0-alpine AS runtime
# tini runs as PID 1: it forwards SIGTERM/SIGINT to node (which then stores open documents
# before exiting, see `shutdown` in apps/server/src/index.ts) and reaps zombie processes.
RUN apk add --no-cache tini
ENV NODE_ENV=production
ENV HOST=0.0.0.0
WORKDIR /app
COPY --from=runtime-deps /runtime/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist/index.js ./apps/server/dist/index.js
# SQL migrations applied on start by drizzle-orm's migrator (see src/db/init.ts)
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
# Built frontend served by the server (see STATIC_DIR in apps/server/src/paths.ts)
COPY --from=build /app/apps/web/dist ./apps/web/dist
WORKDIR /app/apps/server
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]