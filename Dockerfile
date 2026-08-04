FROM node:20-alpine

WORKDIR /app

# Install backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install
COPY backend/ ./
RUN npx prisma generate

# Install and build frontend
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install
COPY frontend/ ./
RUN npm run build

# Start backend which also serves frontend
WORKDIR /app/backend
EXPOSE 3005
CMD ["node", "server.js"]
