# Stage 1: Build the Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
# Copy frontend package files
COPY frontend/package*.json ./
RUN npm install
# Copy frontend source
COPY frontend .
# Build frontend (produces dist folder)
RUN npm run build

# Stage 2: Setup the Backend
FROM node:20-alpine
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Copy backend source
COPY backend/src ./src

# Copy built frontend files to backend's public directory
# We created this folder structure in index.js: path.join(__dirname, '../public')
COPY --from=frontend-builder /app/frontend/dist ./public

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
