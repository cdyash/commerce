# Multi-stage Dockerfile for QuickCart Merchant API

# Stage 1: Build console & server
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json ./server/
COPY console/package.json ./console/

RUN pnpm install --frozen-lockfile

COPY server/ ./server/
COPY console/ ./console/

RUN pnpm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json ./server/

RUN pnpm install --prod --frozen-lockfile

# Copy built assets
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/seed ./server/seed
COPY --from=builder /app/console/dist ./console/dist

# Remove source maps
RUN find ./server/dist -name "*.map" -delete 2>/dev/null || true

# Non-root execution
USER node

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "server/dist/server.js"]
