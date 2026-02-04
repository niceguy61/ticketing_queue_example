# Queue Service Dockerfile
FROM node:22-alpine

WORKDIR /app/services/queue-service

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY services/queue-service/package*.json ./
COPY services/queue-service/tsconfig.json ./

# Copy source code
COPY services/queue-service/src ./src

# Install dependencies and build
RUN npm install && \
    npm run build && \
    npm cache clean --force

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
