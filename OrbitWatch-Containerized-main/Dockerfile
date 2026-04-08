# ============================================================================
# ORBITWATCH MULTI-STAGE DOCKERFILE
# ============================================================================
# Builds both the React frontend and Node.js relay server
# Use with docker-compose.yml for proper secrets management
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Build React Frontend
# ----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build production frontend
RUN npm run build

# ----------------------------------------------------------------------------
# Stage 2: Frontend Server (nginx)
# ----------------------------------------------------------------------------
FROM nginx:alpine AS frontend

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# ----------------------------------------------------------------------------
# Stage 3: Relay Server (Node.js)
# ----------------------------------------------------------------------------
FROM node:20-alpine AS relay

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S orbitwatch && \
    adduser -S orbitwatch -u 1001 -G orbitwatch

# Copy server file
COPY server.js ./

# Create minimal package.json for relay and install dependencies
# Using node-fetch@2 because v3+ is ESM-only and incompatible with require()
RUN echo '{"name":"orbitwatch-relay","type":"commonjs"}' > package.json && \
    npm install express node-fetch@2 cors --save

# Switch to non-root user
USER orbitwatch

# Expose relay port
EXPOSE 3001

# Health check (use 127.0.0.1 instead of localhost to avoid IPv6 issues)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/v1/health || exit 1

CMD ["node", "server.js"]
