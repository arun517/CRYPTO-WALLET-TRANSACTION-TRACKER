# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages ./packages

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend
COPY turbo.json ./

# Build the application
RUN pnpm --filter backend build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages ./packages

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma schema
COPY apps/backend/prisma ./apps/backend/prisma

# Generate Prisma Client
RUN cd apps/backend && pnpm prisma generate

# Set working directory to backend
WORKDIR /app/apps/backend

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/main.js"]

