# syntax=docker/dockerfile:1.6
# Multi-stage Dockerfile for DWIGHT SvelteKit app (adapter-node).

ARG NODE_VERSION=22-alpine

# --- 1. deps (full install incl. dev) ---
FROM node:${NODE_VERSION} AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-workspace

# --- 2. build ---
FROM node:${NODE_VERSION} AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN pnpm exec svelte-kit sync && pnpm exec vite build
# Prune to prod deps for runtime
RUN pnpm prune --prod --ignore-workspace

# --- 3. runtime ---
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null 2>&1 || exit 1
USER node
CMD ["node", "build/index.js"]
