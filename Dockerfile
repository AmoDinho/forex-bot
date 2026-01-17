# ForexAI Trading Agent Dockerfile
# Multi-stage build for optimized production image

# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json yarn.lock ./

# Install all dependencies (including devDependencies for build)
RUN yarn install --frozen-lockfile

# Copy source code and config files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN yarn build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

# Add labels for container metadata
LABEL org.opencontainers.image.title="ForexAI Trading Agent"
LABEL org.opencontainers.image.description="Autonomous Forex Trading Agent with AI-powered analysis"
LABEL org.opencontainers.image.version="1.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S forexbot -u 1001

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
RUN chown -R forexbot:nodejs /app

# Switch to non-root user
USER forexbot

# Expose the application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ping || exit 1

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "dist/main.js"]
