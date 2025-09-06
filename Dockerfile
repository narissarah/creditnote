# Railway Deployment - Enhanced for Shopify Remix App
FROM node:18-alpine

# Install dependencies needed for Prisma, node-gyp, and Shopify apps
RUN apk add --no-cache openssl libc6-compat python3 make g++

WORKDIR /app

# Set environment for production
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies with legacy peer deps (matches working creditcraft pattern)
RUN npm install --legacy-peer-deps --frozen-lockfile

COPY . .

# Generate Prisma client (critical for database access)
RUN npx prisma generate

# Build the application (fresh build every time, no cache)
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
