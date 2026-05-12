# syntax=docker/dockerfile:1.6
# Multi-stage Dockerfile for DWIGHT SvelteKit app (adapter-node).

ARG NODE_VERSION=22-alpine

# --- 1. prod deps only ---
FROM node:${NODE_VERSION} AS prod-deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# --- 2. build (needs dev deps) ---
FROM node:${NODE_VERSION} AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NODE_ENV=production
RUN pnpm exec svelte-kit sync && pnpm exec vite build

# --- 3. runtime ---
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null 2>&1 || exit 1
USER node
CMD ["node", "build/index.js"]
