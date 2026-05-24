# Stage 1: Build NestJS application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy application files (including prisma schema)
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the NestJS application
RUN npm run build

# Stage 2: Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install openssl (required by Prisma Client)
RUN apk add --no-cache openssl

# Copy compiled code, prisma schema, and node_modules from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Expose backend port
EXPOSE 3001

# Run migrations to initialize/update the database, then start NestJS server
CMD npx prisma migrate deploy && npm run start:prod
