FROM node:20-slim

WORKDIR /app

# Copy package files and install all deps (including devDeps needed for Vite build)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy entire project
COPY . .

# Build the React frontend — outputs to /app/dist
RUN npm run build

# Expose backend port
EXPOSE 8080

# Start the Express backend (serves API + built frontend from /app/dist)
CMD ["node", "backend/server.js"]
