FROM node:20-slim

WORKDIR /app

# Copy package files and install all deps (including devDeps needed for Vite build)
COPY package*.json ./
COPY .npmrc ./
RUN npm install --legacy-peer-deps

# Copy entire project
COPY . .

# Build the React frontend — outputs to /app/dist
RUN npm run build

# Create non-root user for container security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Health check so orchestrators know when the app is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/send-otp', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

EXPOSE 8080

CMD ["node", "backend/server.js"]
