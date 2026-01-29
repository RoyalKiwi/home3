# =============================================================================
# HOMEPAGE3 - Unified Docker Image
# Multi-stage build for Next.js application
# =============================================================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps

WORKDIR /app

# Install dependencies for better-sqlite3 compilation
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies including git
RUN apk add --no-cache python3 make g++ git

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy package files
COPY --from=builder /app/package.json ./package.json

# Copy node_modules from deps
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy migrations
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib

# Copy app directory for pages
COPY --from=builder --chown=nextjs:nodejs /app/app ./app

# Copy components and other source files needed at runtime
COPY --from=builder --chown=nextjs:nodejs /app/components ./components
COPY --from=builder --chown=nextjs:nodejs /app/drivers ./drivers
COPY --from=builder --chown=nextjs:nodejs /app/services ./services

# Copy config files
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/middleware.ts ./middleware.ts

# Create data directory with correct permissions
RUN mkdir -p /app/data/cache /app/data/uploads && \
    chown -R nextjs:nodejs /app/data

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATA_PATH=/app/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start application
CMD ["npm", "start"]
