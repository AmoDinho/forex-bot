# ForexAI Trading Agent Dockerfile
# Uses tsx for running TypeScript directly

# ============================================
# Stage 1: Production
# ============================================
FROM node:20-alpine

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

# Install dependencies
RUN yarn install --frozen-lockfile && \
    yarn cache clean

# Copy source code
COPY tsconfig.json ./
COPY src ./src

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

# Start the application using tsx
CMD ["yarn", "start"]
