# Ticket Service Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files first for better caching
COPY services/ticket-service/package*.json ./

# Install dependencies
RUN npm install

# Copy tsconfig
COPY services/ticket-service/tsconfig.json ./

# Copy source code
COPY services/ticket-service/src ./src

# Copy database files directly into service
COPY database/connection.ts ./src/database/
COPY database/schema.sql ./src/database/

# Build TypeScript
RUN npm run build

# Clean up
RUN npm cache clean --force

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
