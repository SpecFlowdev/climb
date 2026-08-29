# syntax=docker/dockerfile:1

# ----------------------------- web build stage ------------------------------
FROM node:22-alpine AS web
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---------------------------- server build stage ----------------------------
FROM node:22-alpine AS server
WORKDIR /build/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ------------------------------ runtime image -------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=server /build/server/dist ./dist
COPY --from=web /build/web/dist ./public

RUN addgroup -S climb && adduser -S climb -G climb && chown -R climb:climb /app
USER climb

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1

CMD ["node", "dist/index.js"]
