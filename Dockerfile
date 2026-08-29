# QD-020 — Multi-stage Dockerfile for Quad.
#
# Stage 1: build the frontend (Vite produces a dist/ folder of static assets).
# Stage 2: build the backend image (Node + Express + mongoose + the
# frontend dist/ folder copied in to be served as a SPA fallback).
#
# Why multi-stage? The build stage carries ~200MB of dev dependencies
# (vite, eslint, tailwind, pino-pretty, vitest, mongodb-memory-server).
# The runtime image only needs the ~30MB of production dependencies,
# so the final image is ~150MB instead of ~500MB.

# ---- Stage 1: build the frontend --------------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /build

# Copy frontend package files + install deps.
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the frontend source and build.
COPY frontend/ ./
# Build output goes to /build/dist
RUN npm run build

# ---- Stage 2: build the backend image --------------------------------------
FROM node:20-alpine AS backend-build
WORKDIR /app

# Copy backend package files + install PROD deps.
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- Stage 3: runtime image ------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# Install tini for proper PID-1 signal handling (so SIGTERM reaches our
# graceful shutdown handler instead of getting swallowed by Node's
# default signal handling).
RUN apk add --no-cache tini

# Copy the production deps from the build stage.
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/package.json ./package.json

# Copy the backend source.
COPY backend/ ./

# Copy the frontend dist into /app/public so the production catch-all
# in server.js serves it (QD-031).
COPY --from=frontend-build /build/dist ./public

# Run as a non-root user for defense-in-depth.
RUN addgroup -S quad && adduser -S quad -G quad && chown -R quad:quad /app
USER quad

EXPOSE 5000
ENV NODE_ENV=production
ENV PORT=5000

# tini handles PID-1 responsibilities (signal forwarding, zombie reaping).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

# Healthcheck hits /api/ready (QD-018 — readiness endpoint that checks
# Mongo + env vars). If it returns non-200 three times in a row,
# Docker will restart the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/ready || exit 1
